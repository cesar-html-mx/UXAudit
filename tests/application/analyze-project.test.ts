import { describe, expect, it } from 'vitest';

import {
  ANALYZE_PROJECT_ERROR_CODES,
  AnalyzeProjectError,
  createAnalyzeProject,
  type AnalyzeProjectDependencies,
} from '../../src/application/analyze-project.js';
import {
  SCAN_PROJECT_ERROR_CODES,
  ScanProjectError,
  type ScanProjectResult,
} from '../../src/application/scan-project.js';
import {
  ANALYZED_SOURCE_LANGUAGES,
  COMPONENT_KINDS,
  JSX_NODE_KINDS,
  type AnalysisModel,
  type AnalyzedSourceFile,
} from '../../src/domain/models/analysis-model.js';
import {
  SOURCE_PARSER_ERROR_CODES,
  SOURCE_PARSER_ERROR_STAGES,
  type SourceParserError,
} from '../../src/parsing/parser-contracts.js';
import { SOURCE_KINDS } from '../../src/project/classification/source-candidate.js';

const canonicalProject = '/canonical/project';
const candidate = {
  absolutePath: `${canonicalProject}/src/App.tsx`,
  extension: '.tsx',
  kind: 'file',
  relativePath: 'src/App.tsx',
  sourceKind: SOURCE_KINDS.typescriptJsx,
} as const;

const createScanResult = (): ScanProjectResult => ({
  discovery: {
    exclusions: [],
    files: [
      {
        absolutePath: candidate.absolutePath,
        observedPath: candidate.absolutePath,
        viaSymlink: false,
      },
    ],
    issues: [],
    projectRoot: canonicalProject,
  },
  inventory: {
    entries: [candidate],
    projectRoot: canonicalProject,
  },
  projectPath: canonicalProject,
  sourceCandidates: [candidate],
  summary: {
    discoveredFiles: 1,
    excludedEntries: 0,
    inventoryEntries: 1,
    recoverableErrors: 0,
    sourceCandidates: 1,
  },
});

const location = {
  end: { column: 10, line: 1, offset: 10 },
  filePath: candidate.relativePath,
  start: { column: 0, line: 1, offset: 0 },
} as const;

const analyzedFile: AnalyzedSourceFile = {
  components: [],
  file: {
    componentIds: [],
    filePath: candidate.relativePath,
    jsxNodeIds: [],
    language: ANALYZED_SOURCE_LANGUAGES.typescript,
    location,
    usesJsx: false,
  },
  jsxNodes: [],
};

const model: AnalysisModel = {
  components: [
    {
      id: 'component:src/App.tsx:0',
      jsxNodeIds: [],
      kind: COMPONENT_KINDS.function,
      location,
      name: 'App',
      rootJsxNodeIds: [],
    },
    {
      id: 'component:src/App.tsx:5',
      jsxNodeIds: [],
      kind: COMPONENT_KINDS.arrowFunction,
      location,
      name: 'Secondary',
      rootJsxNodeIds: [],
    },
  ],
  files: [analyzedFile.file],
  jsxNodes: [
    {
      childNodeIds: [],
      componentId: null,
      id: 'jsx:src/App.tsx:1',
      kind: JSX_NODE_KINDS.fragment,
      location,
      parentNodeId: null,
      textContent: { confidence: 'exact', value: '' },
    },
    {
      childNodeIds: [],
      componentId: null,
      id: 'jsx:src/App.tsx:2',
      kind: JSX_NODE_KINDS.fragment,
      location,
      parentNodeId: null,
      textContent: { confidence: 'exact', value: '' },
    },
    {
      childNodeIds: [],
      componentId: null,
      id: 'jsx:src/App.tsx:3',
      kind: JSX_NODE_KINDS.fragment,
      location,
      parentNodeId: null,
      textContent: { confidence: 'exact', value: '' },
    },
  ],
};

const parserError: SourceParserError = {
  code: SOURCE_PARSER_ERROR_CODES.parseFailed,
  filePath: candidate.relativePath,
  message: 'Source syntax could not be parsed.',
  recoverable: true,
  stage: SOURCE_PARSER_ERROR_STAGES.parse,
};

const createDependencies = (
  overrides: Partial<AnalyzeProjectDependencies> = {},
): AnalyzeProjectDependencies => ({
  analyzeCandidates: () =>
    Promise.resolve({
      analyzedFiles: [analyzedFile],
      parserErrors: [parserError],
    }),
  buildModel: () => model,
  scanProject: () => Promise.resolve(createScanResult()),
  ...overrides,
});

describe('analyzeProject', () => {
  it('composes the unchanged scan result, per-file analysis, model, and separate summary', async () => {
    const stages: string[] = [];
    const scanResult = createScanResult();
    const requests: unknown[] = [];
    const analyzeProject = createAnalyzeProject(
      createDependencies({
        analyzeCandidates: (request) => {
          stages.push('analysis');
          requests.push(request);
          return Promise.resolve({
            analyzedFiles: [analyzedFile],
            parserErrors: [parserError],
          });
        },
        buildModel: (files) => {
          stages.push('model');
          expect(files).toBeDefined();
          expect(files).toEqual([analyzedFile]);
          return model;
        },
        scanProject: (request) => {
          stages.push('scan');
          expect(request).toEqual({ projectPath: './project' });
          return Promise.resolve(scanResult);
        },
      }),
    );

    const result = await analyzeProject({ projectPath: './project' });

    expect(stages).toEqual(['scan', 'analysis', 'model']);
    expect(requests).toEqual([
      {
        candidates: scanResult.sourceCandidates,
        projectRoot: canonicalProject,
      },
    ]);
    expect(result).toEqual({
      ...scanResult,
      model,
      parserErrors: [parserError],
      parsingSummary: {
        components: 2,
        failedFiles: 1,
        jsxNodes: 3,
        parsedFiles: 1,
      },
    });
    expect(result.summary).toBe(scanResult.summary);
    expect(result.sourceCandidates).toBe(scanResult.sourceCandidates);
  });

  it('reports an empty parsing result without changing discovery counters', async () => {
    const scanResult = createScanResult();
    const emptyModel: AnalysisModel = { components: [], files: [], jsxNodes: [] };
    const analyzeProject = createAnalyzeProject(
      createDependencies({
        analyzeCandidates: () =>
          Promise.resolve({
            analyzedFiles: [],
            parserErrors: [],
          }),
        buildModel: () => emptyModel,
        scanProject: () => Promise.resolve(scanResult),
      }),
    );

    const result = await analyzeProject({ projectPath: '.' });

    expect(result.summary).toEqual(scanResult.summary);
    expect(result.parsingSummary).toEqual({
      components: 0,
      failedFiles: 0,
      jsxNodes: 0,
      parsedFiles: 0,
    });
  });

  it('propagates the existing scan error unchanged and does not start source analysis', async () => {
    const scanError = new ScanProjectError(
      SCAN_PROJECT_ERROR_CODES.invalidPath,
      'Project path does not exist.',
      new Error('native path details'),
    );
    let analysisInvoked = false;
    const analyzeProject = createAnalyzeProject(
      createDependencies({
        analyzeCandidates: () => {
          analysisInvoked = true;
          return Promise.resolve({ analyzedFiles: [], parserErrors: [] });
        },
        scanProject: () => Promise.reject(scanError),
      }),
    );

    await expect(analyzeProject({ projectPath: 'missing' })).rejects.toBe(scanError);
    expect(analysisInvoked).toBe(false);
  });

  it('maps any fatal source-analysis failure to one stable error without a native cause', async () => {
    const analyzeProject = createAnalyzeProject(
      createDependencies({
        analyzeCandidates: () =>
          Promise.reject(
            new Error(
              'sensitive /absolute/project/path and parser internals \u001b]52;c;payload\u0007',
            ),
          ),
      }),
    );

    try {
      await analyzeProject({ projectPath: '.' });
      throw new Error('Expected source analysis to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(AnalyzeProjectError);
      expect(error).toMatchObject({
        code: ANALYZE_PROJECT_ERROR_CODES.analysisFailed,
        message: 'Project source candidates could not be analyzed.',
        name: 'AnalyzeProjectError',
      });
      expect(error).not.toHaveProperty('cause');
      expect(JSON.stringify(error)).not.toContain('sensitive');
      expect(JSON.stringify(error)).not.toContain('/absolute/project/path');
    }
  });

  it('maps an invalid model to one stable error and preserves no builder detail', async () => {
    const analyzeProject = createAnalyzeProject(
      createDependencies({
        buildModel: () => {
          throw new Error('model included private source data');
        },
      }),
    );

    try {
      await analyzeProject({ projectPath: '.' });
      throw new Error('Expected model construction to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(AnalyzeProjectError);
      expect(error).toMatchObject({
        code: ANALYZE_PROJECT_ERROR_CODES.modelFailed,
        message: 'Project analysis model could not be built.',
        name: 'AnalyzeProjectError',
      });
      expect(error).not.toHaveProperty('cause');
      expect(JSON.stringify(error)).not.toContain('private source data');
    }
  });
});

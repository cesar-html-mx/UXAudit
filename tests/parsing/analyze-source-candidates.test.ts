import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { AnalyzedSourceFile } from '../../src/domain/models/analysis-model.js';
import {
  SourceCandidateAnalysisInvariantError,
  analyzeSourceCandidates,
  createAnalyzeSourceCandidates,
} from '../../src/parsing/analyze-source-candidates.js';
import {
  SOURCE_PARSER_ERROR_CODES,
  SOURCE_PARSER_ERROR_STAGES,
  type SourceParser,
  type SourceParserError,
  type SourceParserResult,
} from '../../src/parsing/parser-contracts.js';
import {
  SOURCE_KINDS,
  type SourceCandidate,
} from '../../src/project/classification/source-candidate.js';

const projectRoot = '/canonical/project';

const createCandidate = (relativePath: string): SourceCandidate => ({
  absolutePath: `${projectRoot}/${relativePath}`,
  extension: '.tsx',
  kind: 'file',
  relativePath,
  sourceKind: SOURCE_KINDS.typescriptJsx,
});

const createAnalyzedFile = (filePath: string): AnalyzedSourceFile => ({
  components: [],
  file: {
    componentIds: [],
    filePath,
    jsxNodeIds: [],
    language: 'typescript',
    location: {
      end: {
        column: 0,
        line: 1,
        offset: 0,
      },
      filePath,
      start: {
        column: 0,
        line: 1,
        offset: 0,
      },
    },
    usesJsx: false,
  },
  jsxNodes: [],
});

const createParserError = (
  filePath: string,
  stage: SourceParserError['stage'],
): SourceParserError => {
  const valuesByStage = {
    [SOURCE_PARSER_ERROR_STAGES.extract]: {
      code: SOURCE_PARSER_ERROR_CODES.extractFailed,
      message: 'Source analysis could not retain a required location.',
    },
    [SOURCE_PARSER_ERROR_STAGES.parse]: {
      code: SOURCE_PARSER_ERROR_CODES.parseFailed,
      message: 'Source file contains invalid or unsupported syntax.',
    },
    [SOURCE_PARSER_ERROR_STAGES.read]: {
      code: SOURCE_PARSER_ERROR_CODES.fileUnreadable,
      message: 'Source file could not be read.',
    },
  } as const;

  return {
    ...valuesByStage[stage],
    filePath,
    recoverable: true,
    stage,
  };
};

const successFor = (filePath: string) =>
  ({
    analyzedFile: createAnalyzedFile(filePath),
    success: true,
  }) as const;

const failureFor = (filePath: string, stage: SourceParserError['stage']) =>
  ({
    error: createParserError(filePath, stage),
    success: false,
  }) as const;

const requireInvariantError = async (operation: () => Promise<unknown>) => {
  let thrownError: unknown;

  try {
    await operation();
  } catch (error) {
    thrownError = error;
  }

  expect(thrownError).toBeInstanceOf(SourceCandidateAnalysisInvariantError);

  if (!(thrownError instanceof SourceCandidateAnalysisInvariantError)) {
    throw new TypeError('Expected a source-candidate analysis invariant error.');
  }

  expect(thrownError).toMatchObject({
    code: 'SOURCE_CANDIDATE_ANALYSIS_INVARIANT_FAILED',
    message: 'Source candidate analysis reached an invalid internal state.',
    name: 'SourceCandidateAnalysisInvariantError',
  });
  expect(thrownError.cause).toBeUndefined();

  return thrownError;
};

describe('createAnalyzeSourceCandidates', () => {
  it('uses the default secure-reader and Babel pipeline while isolating malformed syntax', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'uxaudit-parser-batch-'));

    try {
      const canonicalRoot = await realpath(temporaryRoot);
      const sourceDirectory = join(canonicalRoot, 'src');
      await mkdir(sourceDirectory);
      await writeFile(
        join(sourceDirectory, 'a-malformed.tsx'),
        'export const Broken = () => <main>;\n',
        'utf8',
      );
      await writeFile(
        join(sourceDirectory, 'z-valid.tsx'),
        'export const Valid = () => <main>Ready</main>;\n',
        'utf8',
      );
      const createRealCandidate = (relativePath: string): SourceCandidate => ({
        absolutePath: join(canonicalRoot, ...relativePath.split('/')),
        extension: '.tsx',
        kind: 'file',
        relativePath,
        sourceKind: SOURCE_KINDS.typescriptJsx,
      });
      const candidates = [
        createRealCandidate('src/z-valid.tsx'),
        createRealCandidate('src/a-malformed.tsx'),
      ];

      const result = await analyzeSourceCandidates({
        candidates,
        projectRoot: canonicalRoot,
      });

      expect(result.analyzedFiles).toHaveLength(1);
      expect(result.analyzedFiles[0]).toMatchObject({
        components: [
          {
            name: 'Valid',
          },
        ],
        file: {
          filePath: 'src/z-valid.tsx',
          usesJsx: true,
        },
      });
      expect(result.parserErrors).toEqual([
        expect.objectContaining({
          code: SOURCE_PARSER_ERROR_CODES.parseFailed,
          filePath: 'src/a-malformed.tsx',
          recoverable: true,
          stage: SOURCE_PARSER_ERROR_STAGES.parse,
        }),
      ]);
      expect(candidates.map((sourceCandidate) => sourceCandidate.relativePath)).toEqual([
        'src/z-valid.tsx',
        'src/a-malformed.tsx',
      ]);
    } finally {
      await rm(temporaryRoot, {
        force: true,
        recursive: true,
      });
    }
  });

  it('processes a cloned candidate order sequentially and returns deterministic successes', async () => {
    const candidates = [
      createCandidate('src/zeta.tsx'),
      createCandidate('src/Alpha.tsx'),
      createCandidate('src/beta.tsx'),
    ];
    const originalOrder = [...candidates];
    const calls: string[] = [];
    let activeParsers = 0;
    let maximumActiveParsers = 0;
    const parseSource: SourceParser = async ({ candidate, projectRoot: receivedRoot }) => {
      expect(receivedRoot).toBe(projectRoot);
      activeParsers += 1;
      maximumActiveParsers = Math.max(maximumActiveParsers, activeParsers);
      calls.push(`start:${candidate.relativePath}`);
      await Promise.resolve();
      calls.push(`end:${candidate.relativePath}`);
      activeParsers -= 1;

      return successFor(candidate.relativePath);
    };
    const analyzeCandidates = createAnalyzeSourceCandidates({ parseSource });

    const result = await analyzeCandidates({
      candidates,
      projectRoot,
    });

    expect(candidates).toEqual(originalOrder);
    expect(candidates[0]).toBe(originalOrder[0]);
    expect(maximumActiveParsers).toBe(1);
    expect(calls).toEqual([
      'start:src/Alpha.tsx',
      'end:src/Alpha.tsx',
      'start:src/beta.tsx',
      'end:src/beta.tsx',
      'start:src/zeta.tsx',
      'end:src/zeta.tsx',
    ]);
    expect(result.analyzedFiles.map((file) => file.file.filePath)).toEqual([
      'src/Alpha.tsx',
      'src/beta.tsx',
      'src/zeta.tsx',
    ]);
    expect(result.parserErrors).toEqual([]);
  });

  it('isolates read, parse, and extraction failures and continues with their siblings', async () => {
    const candidates = [
      createCandidate('src/read.tsx'),
      createCandidate('src/parse.tsx'),
      createCandidate('src/extract.tsx'),
      createCandidate('src/valid.tsx'),
    ];
    const calls: string[] = [];
    const resultByPath = new Map<string, SourceParserResult>([
      ['src/extract.tsx', failureFor('src/extract.tsx', SOURCE_PARSER_ERROR_STAGES.extract)],
      ['src/parse.tsx', failureFor('src/parse.tsx', SOURCE_PARSER_ERROR_STAGES.parse)],
      ['src/read.tsx', failureFor('src/read.tsx', SOURCE_PARSER_ERROR_STAGES.read)],
      ['src/valid.tsx', successFor('src/valid.tsx')],
    ]);
    const parseSource: SourceParser = ({ candidate }) => {
      calls.push(candidate.relativePath);
      const result = resultByPath.get(candidate.relativePath);

      if (result === undefined) {
        throw new TypeError('Unexpected source candidate.');
      }

      return Promise.resolve(result);
    };
    const analyzeCandidates = createAnalyzeSourceCandidates({ parseSource });

    const result = await analyzeCandidates({
      candidates,
      projectRoot,
    });

    expect(calls).toEqual(['src/extract.tsx', 'src/parse.tsx', 'src/read.tsx', 'src/valid.tsx']);
    expect(result.analyzedFiles).toEqual([createAnalyzedFile('src/valid.tsx')]);
    expect(result.parserErrors.map(({ filePath, stage }) => ({ filePath, stage }))).toEqual([
      {
        filePath: 'src/extract.tsx',
        stage: SOURCE_PARSER_ERROR_STAGES.extract,
      },
      {
        filePath: 'src/parse.tsx',
        stage: SOURCE_PARSER_ERROR_STAGES.parse,
      },
      {
        filePath: 'src/read.tsx',
        stage: SOURCE_PARSER_ERROR_STAGES.read,
      },
    ]);
  });

  it('propagates a fatal parser failure and does not process later candidates', async () => {
    const fatalError = new Error('fatal parser invariant');
    const calls: string[] = [];
    const parseSource: SourceParser = ({ candidate }) => {
      calls.push(candidate.relativePath);

      if (candidate.relativePath === 'src/broken.tsx') {
        throw fatalError;
      }

      return Promise.resolve(successFor(candidate.relativePath));
    };
    const analyzeCandidates = createAnalyzeSourceCandidates({ parseSource });

    await expect(
      analyzeCandidates({
        candidates: [
          createCandidate('src/after.tsx'),
          createCandidate('src/broken.tsx'),
          createCandidate('src/before.tsx'),
          createCandidate('src/z-after.tsx'),
        ],
        projectRoot,
      }),
    ).rejects.toBe(fatalError);
    expect(calls).toEqual(['src/after.tsx', 'src/before.tsx', 'src/broken.tsx']);
  });

  it('rejects duplicate portable paths before parsing any candidate', async () => {
    const parseSource = vi.fn<SourceParser>();
    const analyzeCandidates = createAnalyzeSourceCandidates({ parseSource });
    const duplicate = createCandidate('src/duplicate.tsx');

    const error = await requireInvariantError(() =>
      analyzeCandidates({
        candidates: [duplicate, { ...duplicate, absolutePath: '/other/duplicate.tsx' }],
        projectRoot,
      }),
    );

    expect(parseSource).not.toHaveBeenCalled();
    expect(JSON.stringify(error)).not.toContain('duplicate.tsx');
    expect(JSON.stringify(error)).not.toContain('/other');
  });

  it.each([
    ['successful analyzed file', () => successFor('src/different.tsx')],
    [
      'recoverable parser error',
      () => failureFor('src/different.tsx', SOURCE_PARSER_ERROR_STAGES.parse),
    ],
  ] as const)('rejects a mismatched path in a %s result', async (_description, createResult) => {
    const parseSource: SourceParser = () => Promise.resolve(createResult());
    const analyzeCandidates = createAnalyzeSourceCandidates({ parseSource });

    const error = await requireInvariantError(() =>
      analyzeCandidates({
        candidates: [createCandidate('src/expected.tsx')],
        projectRoot,
      }),
    );

    expect(JSON.stringify(error)).not.toContain('different.tsx');
    expect(JSON.stringify(error)).not.toContain('expected.tsx');
  });

  it('returns fresh empty arrays without invoking the parser for an empty batch', async () => {
    const parseSource = vi.fn<SourceParser>();
    const analyzeCandidates = createAnalyzeSourceCandidates({ parseSource });

    const first = await analyzeCandidates({
      candidates: [],
      projectRoot,
    });
    const second = await analyzeCandidates({
      candidates: [],
      projectRoot,
    });

    expect(first).toEqual({
      analyzedFiles: [],
      parserErrors: [],
    });
    expect(second).toEqual(first);
    expect(second.analyzedFiles).not.toBe(first.analyzedFiles);
    expect(second.parserErrors).not.toBe(first.parserErrors);
    expect(parseSource).not.toHaveBeenCalled();
  });
});

import { access, lstat, readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format } from 'prettier';
import { describe, expect, it } from 'vitest';

import { initialRuleRegistry } from '../../../src/rules/initial-rule-registry.js';

const fixtureRoot = fileURLToPath(new URL('../../../fixtures/m06-validation/', import.meta.url));
const manifestPath = join(fixtureRoot, 'manifest.json');
const stableRuleIds = [
  'accessibility/button-name',
  'accessibility/img-alt',
  'accessibility/input-label',
  'performance/img-dimensions',
  'performance/img-lazy-loading',
  'seo/ambiguous-link-text',
  'seo/multiple-h1',
  'ux/small-inline-text',
] as const;
const committedProjectIds = ['valid-project', 'invalid-project', 'mixed-project'] as const;
const generatedProjectIds = ['hostile-project', 'large-project'] as const;
const supportedSourcePattern = /\.(?:js|jsx|ts|tsx)$/u;
const caseIdPattern = /data-uxaudit-case=["']([^"']+)["']/gu;

type StableRuleId = (typeof stableRuleIds)[number];
type CommittedProjectId = (typeof committedProjectIds)[number];
type GeneratedProjectId = (typeof generatedProjectIds)[number];

interface ExpectedResult {
  readonly failedFileCount: number;
  readonly findingCounts: Readonly<Record<StableRuleId, number>>;
  readonly findingRuleIds: readonly StableRuleId[];
  readonly parsedFileCount: number;
  readonly parserErrors: readonly ParserErrorProjection[];
  readonly sourceCandidateCount: number;
  readonly totalFindings: number;
}

interface ParserErrorProjection {
  readonly code: string;
  readonly filePath: string;
  readonly message: string;
  readonly recoverable: boolean;
  readonly stage: string;
}

interface CommittedProject {
  readonly directory: string;
  readonly excludedPaths: readonly string[];
  readonly expected: ExpectedResult;
  readonly expectedFindingCases: Readonly<Record<StableRuleId, readonly string[]>>;
  readonly purpose: string;
  readonly sentinelPaths: readonly string[];
  readonly sourceCandidates: readonly string[];
}

interface RuntimeLink {
  readonly expectedDefaultDisposition: string;
  readonly path: string;
  readonly target: string;
  readonly targetAuthority: string;
  readonly type: string;
}

interface HostileProject {
  readonly aliases: readonly string[];
  readonly baseProject: string;
  readonly directoryName: string;
  readonly expected: ExpectedResult;
  readonly expectedFindingCases: Readonly<Record<StableRuleId, readonly string[]>>;
  readonly generatedAtRuntime: boolean;
  readonly portableHostileFilePath: string;
  readonly purpose: string;
  readonly runtimeLinks: readonly RuntimeLink[];
  readonly sentinelPaths: readonly string[];
  readonly sourceTemplateLines: readonly string[];
}

interface LargeProjectGeneration {
  readonly componentNamePattern: string;
  readonly componentsPerFile: number;
  readonly directoryCount: number;
  readonly directoryNamePattern: string;
  readonly fileNamePattern: string;
  readonly filesPerDirectory: number;
  readonly indexOrigin: number;
  readonly packageScriptCommand: string;
  readonly packageScriptName: string;
  readonly paddingWidth: number;
  readonly repeatRuns: number;
  readonly sourceFileCount: number;
  readonly sourceTemplateLines: readonly string[];
}

interface LargeProject {
  readonly aliases: readonly string[];
  readonly directoryName: string;
  readonly expected: ExpectedResult;
  readonly expectedFindingCases: Readonly<Record<StableRuleId, readonly string[]>>;
  readonly generatedAtRuntime: boolean;
  readonly generation: LargeProjectGeneration;
  readonly purpose: string;
  readonly sentinelPaths: readonly string[];
}

interface SentinelContract {
  readonly expectedAfterAudit: string;
  readonly path: string;
  readonly projectId: CommittedProjectId | GeneratedProjectId;
  readonly trigger: string;
}

interface Manifest {
  readonly committedProjects: Readonly<Record<CommittedProjectId, CommittedProject>>;
  readonly contract: {
    readonly additionalProperties: boolean;
    readonly expectedFindingCountRuleKeyPolicy: string;
    readonly parserErrorProjectionFields: readonly string[];
    readonly pathFormat: string;
  };
  readonly corpusId: string;
  readonly generatedProjects: {
    readonly 'hostile-project': HostileProject;
    readonly 'large-project': LargeProject;
  };
  readonly nonExecutionSentinels: readonly SentinelContract[];
  readonly schemaVersion: number;
  readonly stableRuleIds: readonly StableRuleId[];
  readonly volatileFields: readonly string[];
}

interface TreeEntry {
  readonly path: string;
  readonly type: 'directory' | 'file' | 'other' | 'symlink';
}

const expectedSourceCandidates: Readonly<Record<CommittedProjectId, readonly string[]>> = {
  'invalid-project': ['src/violations.tsx'],
  'mixed-project': [
    'src/App.jsx',
    'src/components/Settings.tsx',
    'src/legacy.js',
    'src/malformed.tsx',
    'src/models/settings.ts',
  ],
  'valid-project': ['src/App.tsx'],
};

const expectedExcludedPaths: Readonly<Record<CommittedProjectId, readonly string[]>> = {
  'invalid-project': [],
  'mixed-project': [
    '.next/excluded.tsx',
    'build/excluded.ts',
    'out/excluded.jsx',
    'src/types.d.ts',
    'vite.config.ts',
  ],
  'valid-project': [],
};

const expectedSourceCaseIds: Readonly<
  Record<CommittedProjectId | GeneratedProjectId, readonly string[]>
> = {
  'hostile-project': ['hostile-button-name'],
  'invalid-project': [
    'invalid-ambiguous-link-text',
    'invalid-button-name',
    'invalid-img-alt',
    'invalid-img-dimensions',
    'invalid-img-lazy-loading',
    'invalid-input-label',
    'invalid-multiple-h1',
    'invalid-small-inline-text',
  ],
  'mixed-project': [
    'mixed-ambiguous-link-text',
    'mixed-img-lazy-loading',
    'mixed-input-label',
    'unsupported-ambiguous-link-text',
    'unsupported-button-name',
    'unsupported-img-alt',
    'unsupported-img-dimensions',
    'unsupported-img-lazy-loading',
    'unsupported-input-label',
    'unsupported-multiple-h1',
    'unsupported-small-inline-text',
  ],
  'valid-project': [
    'valid-button-name',
    'valid-image',
    'valid-inline-text',
    'valid-input-label',
    'valid-link-text',
    'valid-single-h1',
  ],
  'large-project': [],
};

const expectedFindingCounts: Readonly<
  Record<CommittedProjectId | GeneratedProjectId, Readonly<Record<StableRuleId, number>>>
> = {
  'hostile-project': {
    'accessibility/button-name': 1,
    'accessibility/img-alt': 0,
    'accessibility/input-label': 0,
    'performance/img-dimensions': 0,
    'performance/img-lazy-loading': 0,
    'seo/ambiguous-link-text': 0,
    'seo/multiple-h1': 0,
    'ux/small-inline-text': 0,
  },
  'invalid-project': {
    'accessibility/button-name': 1,
    'accessibility/img-alt': 1,
    'accessibility/input-label': 1,
    'performance/img-dimensions': 1,
    'performance/img-lazy-loading': 1,
    'seo/ambiguous-link-text': 1,
    'seo/multiple-h1': 1,
    'ux/small-inline-text': 1,
  },
  'large-project': {
    'accessibility/button-name': 0,
    'accessibility/img-alt': 0,
    'accessibility/input-label': 0,
    'performance/img-dimensions': 0,
    'performance/img-lazy-loading': 0,
    'seo/ambiguous-link-text': 0,
    'seo/multiple-h1': 0,
    'ux/small-inline-text': 0,
  },
  'mixed-project': {
    'accessibility/button-name': 0,
    'accessibility/img-alt': 0,
    'accessibility/input-label': 1,
    'performance/img-dimensions': 0,
    'performance/img-lazy-loading': 1,
    'seo/ambiguous-link-text': 1,
    'seo/multiple-h1': 0,
    'ux/small-inline-text': 0,
  },
  'valid-project': {
    'accessibility/button-name': 0,
    'accessibility/img-alt': 0,
    'accessibility/input-label': 0,
    'performance/img-dimensions': 0,
    'performance/img-lazy-loading': 0,
    'seo/ambiguous-link-text': 0,
    'seo/multiple-h1': 0,
    'ux/small-inline-text': 0,
  },
};

const expectedFindingCases: Readonly<
  Record<CommittedProjectId | GeneratedProjectId, Readonly<Record<StableRuleId, readonly string[]>>>
> = {
  'hostile-project': {
    'accessibility/button-name': ['hostile-button-name'],
    'accessibility/img-alt': [],
    'accessibility/input-label': [],
    'performance/img-dimensions': [],
    'performance/img-lazy-loading': [],
    'seo/ambiguous-link-text': [],
    'seo/multiple-h1': [],
    'ux/small-inline-text': [],
  },
  'invalid-project': {
    'accessibility/button-name': ['invalid-button-name'],
    'accessibility/img-alt': ['invalid-img-alt'],
    'accessibility/input-label': ['invalid-input-label'],
    'performance/img-dimensions': ['invalid-img-dimensions'],
    'performance/img-lazy-loading': ['invalid-img-lazy-loading'],
    'seo/ambiguous-link-text': ['invalid-ambiguous-link-text'],
    'seo/multiple-h1': ['invalid-multiple-h1'],
    'ux/small-inline-text': ['invalid-small-inline-text'],
  },
  'large-project': {
    'accessibility/button-name': [],
    'accessibility/img-alt': [],
    'accessibility/input-label': [],
    'performance/img-dimensions': [],
    'performance/img-lazy-loading': [],
    'seo/ambiguous-link-text': [],
    'seo/multiple-h1': [],
    'ux/small-inline-text': [],
  },
  'mixed-project': {
    'accessibility/button-name': [],
    'accessibility/img-alt': [],
    'accessibility/input-label': ['mixed-input-label'],
    'performance/img-dimensions': [],
    'performance/img-lazy-loading': ['mixed-img-lazy-loading'],
    'seo/ambiguous-link-text': ['mixed-ambiguous-link-text'],
    'seo/multiple-h1': [],
    'ux/small-inline-text': [],
  },
  'valid-project': {
    'accessibility/button-name': [],
    'accessibility/img-alt': [],
    'accessibility/input-label': [],
    'performance/img-dimensions': [],
    'performance/img-lazy-loading': [],
    'seo/ambiguous-link-text': [],
    'seo/multiple-h1': [],
    'ux/small-inline-text': [],
  },
};

const toPortablePath = (value: string): string => value.split(sep).join('/');

const sortStrings = (values: readonly string[]): string[] =>
  [...values].sort((left, right) => left.localeCompare(right));

const extractCaseIds = (source: string): string[] =>
  sortStrings([...source.matchAll(caseIdPattern)].map((match) => match[1] ?? ''));

const expectExactKeys = (value: object, keys: readonly string[]): void => {
  expect(Object.keys(value)).toEqual(keys);
};

const readManifest = async (): Promise<{ readonly manifest: Manifest; readonly raw: string }> => {
  const raw = await readFile(manifestPath, 'utf8');

  return {
    manifest: JSON.parse(raw) as Manifest,
    raw,
  };
};

const listTree = async (root: string, current = root): Promise<TreeEntry[]> => {
  const directoryEntries = await readdir(current, { withFileTypes: true });
  const entries: TreeEntry[] = [];

  for (const directoryEntry of directoryEntries) {
    const absolutePath = join(current, directoryEntry.name);
    const path = toPortablePath(relative(root, absolutePath));
    const metadata = await lstat(absolutePath);
    const type: TreeEntry['type'] = metadata.isSymbolicLink()
      ? 'symlink'
      : metadata.isDirectory()
        ? 'directory'
        : metadata.isFile()
          ? 'file'
          : 'other';

    entries.push({ path, type });

    if (type === 'directory') {
      entries.push(...(await listTree(root, absolutePath)));
    }
  }

  return entries.sort((left, right) => left.path.localeCompare(right.path));
};

const getExpected = (
  manifest: Manifest,
  projectId: CommittedProjectId | GeneratedProjectId,
): ExpectedResult =>
  projectId in manifest.committedProjects
    ? manifest.committedProjects[projectId as CommittedProjectId].expected
    : manifest.generatedProjects[projectId as GeneratedProjectId].expected;

describe('M06 controlled-project manifest', () => {
  it('is canonical JSON with a closed, versioned top-level contract and the exact stable catalog', async () => {
    const { manifest, raw } = await readManifest();

    expect(raw).toBe(
      await format(raw, {
        endOfLine: 'lf',
        parser: 'json',
        printWidth: 100,
      }),
    );
    expectExactKeys(manifest, [
      'schemaVersion',
      'corpusId',
      'contract',
      'stableRuleIds',
      'committedProjects',
      'generatedProjects',
      'volatileFields',
      'nonExecutionSentinels',
    ]);
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.corpusId).toBe('M06-CONTROLLED-PROJECTS');
    expectExactKeys(manifest.contract, [
      'additionalProperties',
      'expectedFindingCountRuleKeyPolicy',
      'parserErrorProjectionFields',
      'pathFormat',
    ]);
    expect(manifest.contract).toEqual({
      additionalProperties: false,
      expectedFindingCountRuleKeyPolicy: 'exact-stable-rule-ids',
      parserErrorProjectionFields: ['code', 'filePath', 'message', 'recoverable', 'stage'],
      pathFormat: 'portable-relative-forward-slash',
    });
    expect(manifest.stableRuleIds).toEqual(stableRuleIds);
    expect(new Set(manifest.stableRuleIds).size).toBe(8);
    expect(
      initialRuleRegistry.rules
        .filter((rule) => rule.metadata.status === 'stable')
        .map((rule) => rule.metadata.id),
    ).toEqual(stableRuleIds);
    expect(Object.keys(manifest.committedProjects)).toEqual(committedProjectIds);
    expect(Object.keys(manifest.generatedProjects)).toEqual(generatedProjectIds);
    expect(manifest.volatileFields).toEqual([
      '/projectRoot',
      '/timing/completedAt',
      '/timing/durationMs',
      '/timing/startedAt',
    ]);
  });

  it('closes every committed-project map and locks the exact physical source and exclusion inventory', async () => {
    const { manifest } = await readManifest();

    for (const projectId of committedProjectIds) {
      const project = manifest.committedProjects[projectId];
      const projectRoot = join(fixtureRoot, project.directory);
      const tree = await listTree(projectRoot);
      const actualFiles = tree.filter((entry) => entry.type === 'file').map((entry) => entry.path);
      const expectedFiles = sortStrings([
        'package.json',
        ...expectedSourceCandidates[projectId],
        ...expectedExcludedPaths[projectId],
      ]);

      expectExactKeys(project, [
        'directory',
        'purpose',
        'sourceCandidates',
        'excludedPaths',
        'expected',
        'expectedFindingCases',
        'sentinelPaths',
      ]);
      expect(project.directory).toBe(projectId);
      expect(project.purpose.trim().length).toBeGreaterThan(40);
      expect(project.sourceCandidates).toEqual(expectedSourceCandidates[projectId]);
      expect(project.excludedPaths).toEqual(expectedExcludedPaths[projectId]);
      expect(project.expected.sourceCandidateCount).toBe(project.sourceCandidates.length);
      expect(actualFiles).toEqual(expectedFiles);
      expect(actualFiles.filter((path) => supportedSourcePattern.test(path))).toEqual(
        sortStrings([...project.sourceCandidates, ...project.excludedPaths]),
      );

      for (const filePath of [...project.sourceCandidates, ...project.excludedPaths]) {
        const metadata = await lstat(join(projectRoot, filePath));

        expect(metadata.isFile()).toBe(true);
        expect(metadata.isSymbolicLink()).toBe(false);
      }
    }
  });

  it('locks exact rule-count and finding-case maps and keeps all derived totals coherent', async () => {
    const { manifest } = await readManifest();

    for (const projectId of [...committedProjectIds, ...generatedProjectIds]) {
      const expected = getExpected(manifest, projectId);
      const nonZeroRuleIds = stableRuleIds.filter((ruleId) => expected.findingCounts[ruleId] > 0);

      expectExactKeys(expected, [
        'sourceCandidateCount',
        'parsedFileCount',
        'failedFileCount',
        'findingRuleIds',
        'findingCounts',
        'totalFindings',
        'parserErrors',
      ]);
      expectExactKeys(expected.findingCounts, stableRuleIds);
      expect(expected.findingCounts).toEqual(expectedFindingCounts[projectId]);
      expect(expected.findingRuleIds).toEqual(nonZeroRuleIds);
      expect(expected.totalFindings).toBe(
        stableRuleIds.reduce((total, ruleId) => total + expected.findingCounts[ruleId], 0),
      );
      expect(expected.parsedFileCount + expected.failedFileCount).toBe(
        expected.sourceCandidateCount,
      );

      for (const parserError of expected.parserErrors) {
        expectExactKeys(parserError, ['code', 'filePath', 'message', 'recoverable', 'stage']);
      }
    }

    for (const projectId of [...committedProjectIds, ...generatedProjectIds]) {
      const project =
        projectId in manifest.committedProjects
          ? manifest.committedProjects[projectId as CommittedProjectId]
          : manifest.generatedProjects[projectId as GeneratedProjectId];

      expectExactKeys(project.expectedFindingCases, stableRuleIds);
      expect(project.expectedFindingCases).toEqual(expectedFindingCases[projectId]);
    }

    expect(manifest.committedProjects['mixed-project'].expected.parserErrors).toEqual([
      {
        code: 'SOURCE_PARSE_FAILED',
        filePath: 'src/malformed.tsx',
        message: 'Source file contains invalid or unsupported syntax.',
        recoverable: true,
        stage: 'parse',
      },
    ]);
  });

  it('binds every expected finding case to a unique literal source case without executing fixtures', async () => {
    const { manifest } = await readManifest();
    const allCaseIds: string[] = [];

    for (const projectId of committedProjectIds) {
      const project = manifest.committedProjects[projectId];
      const sources = await Promise.all(
        project.sourceCandidates.map((filePath) =>
          readFile(join(fixtureRoot, project.directory, filePath), 'utf8'),
        ),
      );
      const sourceCaseIds = sortStrings(sources.flatMap((source) => extractCaseIds(source)));
      const findingCaseIds = sortStrings(
        stableRuleIds.flatMap((ruleId) => project.expectedFindingCases[ruleId]),
      );

      expect(sourceCaseIds).toEqual(expectedSourceCaseIds[projectId]);
      expect(sourceCaseIds).toEqual([...new Set(sourceCaseIds)]);
      expect(findingCaseIds.every((caseId) => sourceCaseIds.includes(caseId))).toBe(true);
      allCaseIds.push(...sourceCaseIds);
    }

    const hostileProject = manifest.generatedProjects['hostile-project'];
    const hostileSourceCaseIds = extractCaseIds(hostileProject.sourceTemplateLines.join('\n'));
    const hostileFindingCaseIds = sortStrings(
      stableRuleIds.flatMap((ruleId) => hostileProject.expectedFindingCases[ruleId]),
    );

    expect(hostileSourceCaseIds).toEqual(expectedSourceCaseIds['hostile-project']);
    expect(hostileFindingCaseIds).toEqual(hostileSourceCaseIds);
    allCaseIds.push(...hostileSourceCaseIds);

    const largeProject = manifest.generatedProjects['large-project'];
    const largeSourceCaseIds = extractCaseIds(
      largeProject.generation.sourceTemplateLines.join('\n'),
    );

    expect(largeSourceCaseIds).toEqual(expectedSourceCaseIds['large-project']);
    expect(stableRuleIds.flatMap((ruleId) => largeProject.expectedFindingCases[ruleId])).toEqual(
      [],
    );
    expect(allCaseIds).toEqual([...new Set(allCaseIds)]);
  });

  it('closes and validates the runtime hostile/link and large-project generation parameters', async () => {
    const { manifest } = await readManifest();
    const hostile = manifest.generatedProjects['hostile-project'];
    const large = manifest.generatedProjects['large-project'];

    expectExactKeys(hostile, [
      'aliases',
      'generatedAtRuntime',
      'baseProject',
      'directoryName',
      'purpose',
      'portableHostileFilePath',
      'sourceTemplateLines',
      'runtimeLinks',
      'expected',
      'expectedFindingCases',
      'sentinelPaths',
    ]);
    expect(hostile.aliases).toEqual(['security-project']);
    expect(hostile.generatedAtRuntime).toBe(true);
    expect(hostile.baseProject).toBe('valid-project');
    expect(hostile.directoryName).toBe('security-project');
    expect(hostile.portableHostileFilePath).toBe("src/hostile-&-'quoted'-(script).tsx");
    expect(hostile.sourceTemplateLines.at(-1)).toBe('');
    expect(hostile.sourceTemplateLines.join('\n')).toContain('<script>alert("m06-html")</script>');
    expect(hostile.runtimeLinks).toHaveLength(3);
    expect(hostile.runtimeLinks.map((link) => link.path)).toEqual([
      'src/internal-alias.tsx',
      'src/external-alias.tsx',
      'src/cycle',
    ]);

    for (const link of hostile.runtimeLinks) {
      expectExactKeys(link, [
        'path',
        'target',
        'targetAuthority',
        'type',
        'expectedDefaultDisposition',
      ]);
      expect(['file', 'directory']).toContain(link.type);
      expect(['project', 'outside-project']).toContain(link.targetAuthority);
      expect(link.expectedDefaultDisposition).toBe('skipped');
    }

    expectExactKeys(large, [
      'aliases',
      'generatedAtRuntime',
      'directoryName',
      'purpose',
      'generation',
      'expected',
      'expectedFindingCases',
      'sentinelPaths',
    ]);
    expect(large.aliases).toEqual([]);
    expect(large.generatedAtRuntime).toBe(true);
    expect(large.directoryName).toBe('large-project');
    expectExactKeys(large.generation, [
      'sourceFileCount',
      'directoryCount',
      'filesPerDirectory',
      'componentsPerFile',
      'repeatRuns',
      'directoryNamePattern',
      'fileNamePattern',
      'componentNamePattern',
      'indexOrigin',
      'paddingWidth',
      'sourceTemplateLines',
      'packageScriptName',
      'packageScriptCommand',
    ]);
    expect(large.generation).toMatchObject({
      componentNamePattern: 'LargeComponent{{INDEX_PADDED}}',
      componentsPerFile: 1,
      directoryCount: 12,
      directoryNamePattern: 'src/batch-{{BATCH_PADDED}}',
      fileNamePattern: 'Component-{{INDEX_PADDED}}.tsx',
      filesPerDirectory: 20,
      indexOrigin: 0,
      packageScriptName: 'uxaudit:sentinel',
      paddingWidth: 3,
      repeatRuns: 5,
      sourceFileCount: 240,
    });
    expect(large.generation.sourceFileCount).toBe(
      large.generation.directoryCount * large.generation.filesPerDirectory,
    );
    expect(large.generation.repeatRuns).toBeGreaterThanOrEqual(5);
    expect(large.generation.sourceTemplateLines.at(-1)).toBe('');
    expect(large.generation.sourceTemplateLines.join('\n')).toContain('{{COMPONENT_NAME}}');
    expect(large.generation.sourceTemplateLines.join('\n')).toContain('{{INDEX}}');
    expect(large.generation.packageScriptCommand).toContain('TARGET_PACKAGE_SCRIPT_EXECUTED');
  });

  it('keeps sentinel declarations complete while committing no links, sentinels, or report targets', async () => {
    const { manifest } = await readManifest();
    const tree = await listTree(fixtureRoot);
    const sentinelPairs = manifest.nonExecutionSentinels.map(
      (sentinel) => `${sentinel.projectId}:${sentinel.path}`,
    );
    const expectedSentinelPairs = [
      'valid-project:TARGET_PACKAGE_SCRIPT_EXECUTED',
      'valid-project:TARGET_SOURCE_EXECUTED',
      'invalid-project:TARGET_PACKAGE_SCRIPT_EXECUTED',
      'invalid-project:TARGET_SOURCE_EXECUTED',
      'mixed-project:TARGET_EXCLUDED_SOURCE_EXECUTED',
      'mixed-project:TARGET_PACKAGE_SCRIPT_EXECUTED',
      'mixed-project:TARGET_SOURCE_EXECUTED',
      'hostile-project:TARGET_PACKAGE_SCRIPT_EXECUTED',
      'hostile-project:TARGET_SOURCE_EXECUTED',
      'large-project:TARGET_PACKAGE_SCRIPT_EXECUTED',
    ];

    expect(sentinelPairs).toEqual(expectedSentinelPairs);
    expect(sentinelPairs).toEqual([...new Set(sentinelPairs)]);

    for (const sentinel of manifest.nonExecutionSentinels) {
      const project =
        sentinel.projectId in manifest.committedProjects
          ? manifest.committedProjects[sentinel.projectId as CommittedProjectId]
          : manifest.generatedProjects[sentinel.projectId as GeneratedProjectId];

      expectExactKeys(sentinel, ['projectId', 'path', 'trigger', 'expectedAfterAudit']);
      expect(sentinel.expectedAfterAudit).toBe('absent');
      expect(project.sentinelPaths).toContain(sentinel.path);
    }

    for (const projectId of [...committedProjectIds, ...generatedProjectIds]) {
      const project =
        projectId in manifest.committedProjects
          ? manifest.committedProjects[projectId as CommittedProjectId]
          : manifest.generatedProjects[projectId as GeneratedProjectId];
      const declaredPaths = manifest.nonExecutionSentinels
        .filter((sentinel) => sentinel.projectId === projectId)
        .map((sentinel) => sentinel.path);

      expect(project.sentinelPaths).toEqual(declaredPaths);
    }

    expect(tree.filter((entry) => entry.type === 'symlink')).toEqual([]);
    expect(tree.filter((entry) => entry.type === 'other')).toEqual([]);
    expect(
      tree.filter((entry) => {
        const basename = entry.path.split('/').at(-1) ?? '';

        return (
          basename.startsWith('TARGET_') ||
          basename === 'audit-report.html' ||
          basename === 'audit-report.json' ||
          entry.path.split('/').includes('uxaudit-reports')
        );
      }),
    ).toEqual([]);

    for (const projectId of committedProjectIds) {
      const project = manifest.committedProjects[projectId];
      const packagePath = join(fixtureRoot, project.directory, 'package.json');
      const packageRaw = await readFile(packagePath, 'utf8');
      const packageManifest = JSON.parse(packageRaw) as {
        readonly scripts: Readonly<Record<string, string>>;
      };

      expect(packageRaw).toBe(`${JSON.stringify(packageManifest, null, 2)}\n`);
      expect(packageManifest.scripts['uxaudit:sentinel']).toContain(
        'TARGET_PACKAGE_SCRIPT_EXECUTED',
      );

      for (const sentinelPath of project.sentinelPaths) {
        await expect(access(join(fixtureRoot, project.directory, sentinelPath))).rejects.toThrow();
      }
    }

    expect(dirname(manifestPath)).toBe(fixtureRoot.replace(/\/$/u, ''));
  });
});

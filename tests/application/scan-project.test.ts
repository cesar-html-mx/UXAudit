import { describe, expect, it } from 'vitest';

import {
  SCAN_PROJECT_ERROR_CODES,
  ScanProjectError,
  createScanProject,
  type ScanProjectDependencies,
} from '../../src/application/scan-project.js';
import { SOURCE_KINDS } from '../../src/project/classification/source-candidate.js';
import {
  DISCOVERY_ENTRY_TYPES,
  DISCOVERY_EXCLUSION_REASONS,
  DISCOVERY_ISSUE_CODES,
  DISCOVERY_OPERATIONS,
} from '../../src/project/discovery/discovery-types.js';
import {
  PROJECT_PATH_ERROR_CODES,
  ProjectPathError,
} from '../../src/project/validate-project-path.js';

const canonicalProject = '/canonical/project';

const createDependencies = (
  overrides: Partial<ScanProjectDependencies> = {},
): ScanProjectDependencies => ({
  buildInventory: (projectRoot) => ({ entries: [], projectRoot }),
  classifyCandidates: () => [],
  discoverFiles: (projectRoot) =>
    Promise.resolve({
      exclusions: [],
      files: [],
      issues: [],
      projectRoot,
    }),
  validatePath: () => Promise.resolve(canonicalProject),
  ...overrides,
});

describe('scanProject', () => {
  it('orchestrates validation, discovery, inventory, and classification exactly once', async () => {
    const stages: string[] = [];
    const discoveredFile = {
      absolutePath: `${canonicalProject}/src/App.TSX`,
      observedPath: `${canonicalProject}/src/App.TSX`,
      viaSymlink: false,
    } as const;
    const discovery = {
      exclusions: [
        {
          entryType: DISCOVERY_ENTRY_TYPES.directory,
          reason: DISCOVERY_EXCLUSION_REASONS.directoryName,
          relativePath: 'dist',
        },
      ],
      files: [discoveredFile],
      issues: [
        {
          code: DISCOVERY_ISSUE_CODES.entryDisappeared,
          operation: DISCOVERY_OPERATIONS.inspect,
          recoverable: true,
          relativePath: 'removed.ts',
        },
      ],
      projectRoot: canonicalProject,
    } as const;
    const inventory = {
      entries: [
        {
          absolutePath: discoveredFile.absolutePath,
          extension: '.tsx',
          kind: 'file',
          relativePath: 'src/App.TSX',
        },
      ],
      projectRoot: canonicalProject,
    } as const;
    const candidates = [
      {
        ...inventory.entries[0],
        extension: '.tsx',
        sourceKind: SOURCE_KINDS.typescriptJsx,
      },
    ] as const;
    const scanProject = createScanProject(
      createDependencies({
        buildInventory: (projectRoot, files) => {
          stages.push('inventory');
          expect(projectRoot).toBe(canonicalProject);
          expect(files).toBe(discovery.files);
          return inventory;
        },
        classifyCandidates: (entries) => {
          stages.push('classification');
          expect(entries).toBe(inventory.entries);
          return candidates;
        },
        discoverFiles: (projectRoot) => {
          stages.push('discovery');
          expect(projectRoot).toBe(canonicalProject);
          return Promise.resolve(discovery);
        },
        validatePath: (projectPath) => {
          stages.push('validation');
          expect(projectPath).toBe('relative-project');
          return Promise.resolve(canonicalProject);
        },
      }),
    );

    const result = await scanProject({ projectPath: 'relative-project' });

    expect(stages).toEqual(['validation', 'discovery', 'inventory', 'classification']);
    expect(result).toEqual({
      discovery,
      inventory,
      projectPath: canonicalProject,
      sourceCandidates: candidates,
      summary: {
        discoveredFiles: 1,
        excludedEntries: 1,
        inventoryEntries: 1,
        recoverableErrors: 1,
        sourceCandidates: 1,
      },
    });
  });

  it('maps expected project-path errors to the application input boundary', async () => {
    const projectError = new ProjectPathError(PROJECT_PATH_ERROR_CODES.notFound);
    const scanProject = createScanProject(
      createDependencies({
        validatePath: () => Promise.reject(projectError),
      }),
    );

    await expect(scanProject({ projectPath: 'missing' })).rejects.toMatchObject({
      cause: projectError,
      code: SCAN_PROJECT_ERROR_CODES.invalidPath,
      message: 'Project path does not exist.',
    });
  });

  it('maps unclassified project validation errors to the application internal boundary', async () => {
    const projectError = new ProjectPathError(PROJECT_PATH_ERROR_CODES.validationFailed);
    const scanProject = createScanProject(
      createDependencies({
        validatePath: () => Promise.reject(projectError),
      }),
    );

    await expect(scanProject({ projectPath: 'project' })).rejects.toMatchObject({
      cause: projectError,
      code: SCAN_PROJECT_ERROR_CODES.validationFailed,
      message: 'Project path could not be validated.',
    });
  });

  it('sanitizes unexpected validator failures at the application boundary', async () => {
    const unexpectedError = new Error('native details must stay hidden');
    const scanProject = createScanProject(
      createDependencies({
        validatePath: () => Promise.reject(unexpectedError),
      }),
    );

    try {
      await scanProject({ projectPath: 'project' });
      throw new Error('Expected scan preparation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ScanProjectError);
      expect(error).toMatchObject({
        cause: unexpectedError,
        code: SCAN_PROJECT_ERROR_CODES.validationFailed,
        message: 'Project path could not be validated.',
      });
    }
  });

  it.each([
    [
      'discovery',
      SCAN_PROJECT_ERROR_CODES.discoveryFailed,
      'Project root could not be traversed.',
      (error: Error): Partial<ScanProjectDependencies> => ({
        discoverFiles: () => Promise.reject(error),
      }),
    ],
    [
      'inventory',
      SCAN_PROJECT_ERROR_CODES.inventoryFailed,
      'Project file inventory could not be built.',
      (error: Error): Partial<ScanProjectDependencies> => ({
        buildInventory: () => {
          throw error;
        },
      }),
    ],
    [
      'classification',
      SCAN_PROJECT_ERROR_CODES.classificationFailed,
      'Project source candidates could not be classified.',
      (error: Error): Partial<ScanProjectDependencies> => ({
        classifyCandidates: () => {
          throw error;
        },
      }),
    ],
  ])(
    'maps a fatal %s failure to one stable processing error',
    async (_stage, code, message, override) => {
      const processingError = new Error('native processing details must stay hidden');
      const scanProject = createScanProject(createDependencies(override(processingError)));

      await expect(scanProject({ projectPath: 'project' })).rejects.toMatchObject({
        cause: processingError,
        code,
        message,
      });
    },
  );

  it.each([
    [
      'discovery',
      SCAN_PROJECT_ERROR_CODES.discoveryFailed,
      (dependencies: ScanProjectDependencies): Partial<ScanProjectDependencies> => ({
        discoverFiles: async (projectRoot) => ({
          ...(await dependencies.discoverFiles(projectRoot)),
          projectRoot: '/different/root',
        }),
      }),
    ],
    [
      'inventory',
      SCAN_PROJECT_ERROR_CODES.inventoryFailed,
      (dependencies: ScanProjectDependencies): Partial<ScanProjectDependencies> => ({
        buildInventory: (projectRoot, files) => ({
          ...dependencies.buildInventory(projectRoot, files),
          projectRoot: '/different/root',
        }),
      }),
    ],
  ])(
    'rejects a %s adapter that changes the validated project root',
    async (_stage, code, override) => {
      const dependencies = createDependencies();
      const scanProject = createScanProject({
        ...dependencies,
        ...override(dependencies),
      });

      await expect(scanProject({ projectPath: 'project' })).rejects.toMatchObject({
        code,
      });
    },
  );
});

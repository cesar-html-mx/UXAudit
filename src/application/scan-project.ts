import { classifySourceCandidates } from '../project/classification/classify-source-candidates.js';
import type {
  ClassifySourceCandidates,
  SourceCandidate,
} from '../project/classification/source-candidate.js';
import { discoverProjectFiles } from '../project/discovery/discover-project.js';
import type {
  DiscoverProjectFiles,
  DiscoveryResult,
} from '../project/discovery/discovery-types.js';
import { buildFileInventory } from '../project/inventory/build-file-inventory.js';
import type { BuildFileInventory, FileInventory } from '../project/inventory/inventory-types.js';
import {
  PROJECT_PATH_ERROR_CODES,
  ProjectPathError,
  validateProjectPath,
  type ValidateProjectPath,
} from '../project/validate-project-path.js';

export const SCAN_PROJECT_ERROR_CODES = {
  classificationFailed: 'SCAN_PROJECT_CLASSIFICATION_FAILED',
  discoveryFailed: 'SCAN_PROJECT_DISCOVERY_FAILED',
  invalidPath: 'SCAN_PROJECT_INVALID_PATH',
  inventoryFailed: 'SCAN_PROJECT_INVENTORY_FAILED',
  validationFailed: 'SCAN_PROJECT_VALIDATION_FAILED',
} as const;

export type ScanProjectErrorCode =
  (typeof SCAN_PROJECT_ERROR_CODES)[keyof typeof SCAN_PROJECT_ERROR_CODES];

export class ScanProjectError extends Error {
  public readonly code: ScanProjectErrorCode;

  public constructor(code: ScanProjectErrorCode, message: string, cause: unknown) {
    super(message, { cause });
    this.name = 'ScanProjectError';
    this.code = code;
  }
}

export interface ScanProjectRequest {
  readonly projectPath: string;
}

export interface ScanProjectSummary {
  readonly discoveredFiles: number;
  readonly excludedEntries: number;
  readonly inventoryEntries: number;
  readonly recoverableErrors: number;
  readonly sourceCandidates: number;
}

export interface ScanProjectResult {
  readonly discovery: DiscoveryResult;
  readonly inventory: FileInventory;
  readonly projectPath: string;
  readonly sourceCandidates: readonly SourceCandidate[];
  readonly summary: ScanProjectSummary;
}

export interface ScanProjectDependencies {
  readonly buildInventory: BuildFileInventory;
  readonly classifyCandidates: ClassifySourceCandidates;
  readonly discoverFiles: DiscoverProjectFiles;
  readonly validatePath: ValidateProjectPath;
}

export type ScanProject = (request: ScanProjectRequest) => Promise<ScanProjectResult>;

const toPathValidationError = (error: unknown): ScanProjectError => {
  if (error instanceof ProjectPathError) {
    return new ScanProjectError(
      error.code === PROJECT_PATH_ERROR_CODES.validationFailed
        ? SCAN_PROJECT_ERROR_CODES.validationFailed
        : SCAN_PROJECT_ERROR_CODES.invalidPath,
      error.message,
      error,
    );
  }

  return new ScanProjectError(
    SCAN_PROJECT_ERROR_CODES.validationFailed,
    'Project path could not be validated.',
    error,
  );
};

const toStageError = (
  code: ScanProjectErrorCode,
  message: string,
  error: unknown,
): ScanProjectError => new ScanProjectError(code, message, error);

export const createScanProject =
  ({
    buildInventory,
    classifyCandidates,
    discoverFiles,
    validatePath,
  }: ScanProjectDependencies): ScanProject =>
  async (request) => {
    let projectPath: string;

    try {
      projectPath = await validatePath(request.projectPath);
    } catch (error) {
      throw toPathValidationError(error);
    }

    let discovery: DiscoveryResult;

    try {
      discovery = await discoverFiles(projectPath);

      if (discovery.projectRoot !== projectPath) {
        throw new Error('Discovery changed the validated project root.');
      }
    } catch (error) {
      throw toStageError(
        SCAN_PROJECT_ERROR_CODES.discoveryFailed,
        'Project root could not be traversed.',
        error,
      );
    }

    let inventory: FileInventory;

    try {
      inventory = buildInventory(projectPath, discovery.files);

      if (inventory.projectRoot !== projectPath) {
        throw new Error('Inventory changed the validated project root.');
      }
    } catch (error) {
      throw toStageError(
        SCAN_PROJECT_ERROR_CODES.inventoryFailed,
        'Project file inventory could not be built.',
        error,
      );
    }

    let sourceCandidates: readonly SourceCandidate[];

    try {
      sourceCandidates = classifyCandidates(inventory.entries);
    } catch (error) {
      throw toStageError(
        SCAN_PROJECT_ERROR_CODES.classificationFailed,
        'Project source candidates could not be classified.',
        error,
      );
    }

    return {
      discovery,
      inventory,
      projectPath,
      sourceCandidates,
      summary: {
        discoveredFiles: discovery.files.length,
        excludedEntries: discovery.exclusions.length,
        inventoryEntries: inventory.entries.length,
        recoverableErrors: discovery.issues.length,
        sourceCandidates: sourceCandidates.length,
      },
    };
  };

export const scanProject = createScanProject({
  buildInventory: buildFileInventory,
  classifyCandidates: classifySourceCandidates,
  discoverFiles: discoverProjectFiles,
  validatePath: validateProjectPath,
});

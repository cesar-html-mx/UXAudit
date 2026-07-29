import {
  PROJECT_PATH_ERROR_CODES,
  ProjectPathError,
  validateProjectPath,
  type ValidateProjectPath,
} from '../project/validate-project-path.js';

export const SCAN_PROJECT_ERROR_CODES = {
  invalidPath: 'SCAN_PROJECT_INVALID_PATH',
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

export interface ScanProjectResult {
  readonly projectPath: string;
}

export type ScanProject = (request: ScanProjectRequest) => Promise<ScanProjectResult>;

const toScanProjectError = (error: unknown): ScanProjectError => {
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

export const createScanProject =
  (validatePath: ValidateProjectPath): ScanProject =>
  async (request) => {
    try {
      return {
        projectPath: await validatePath(request.projectPath),
      };
    } catch (error) {
      throw toScanProjectError(error);
    }
  };

export const scanProject = createScanProject(validateProjectPath);

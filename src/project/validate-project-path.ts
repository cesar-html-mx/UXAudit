import { constants as fileSystemConstants } from 'node:fs';
import {
  access as accessPath,
  realpath as getRealPath,
  stat as getPathStats,
} from 'node:fs/promises';
import { resolve } from 'node:path';

export const PROJECT_PATH_ERROR_CODES = {
  empty: 'PROJECT_PATH_EMPTY',
  notFound: 'PROJECT_PATH_NOT_FOUND',
  notDirectory: 'PROJECT_PATH_NOT_DIRECTORY',
  notAccessible: 'PROJECT_PATH_NOT_ACCESSIBLE',
  validationFailed: 'PROJECT_PATH_VALIDATION_FAILED',
} as const;

export type ProjectPathErrorCode =
  (typeof PROJECT_PATH_ERROR_CODES)[keyof typeof PROJECT_PATH_ERROR_CODES];

const PROJECT_PATH_ERROR_MESSAGES: Record<ProjectPathErrorCode, string> = {
  PROJECT_PATH_EMPTY: 'Project path is required.',
  PROJECT_PATH_NOT_FOUND: 'Project path does not exist.',
  PROJECT_PATH_NOT_DIRECTORY: 'Project path must reference a directory.',
  PROJECT_PATH_NOT_ACCESSIBLE: 'Project path cannot be accessed.',
  PROJECT_PATH_VALIDATION_FAILED: 'Project path could not be validated.',
};

export class ProjectPathError extends Error {
  public readonly code: ProjectPathErrorCode;

  public constructor(code: ProjectPathErrorCode, cause?: unknown) {
    super(PROJECT_PATH_ERROR_MESSAGES[code], { cause });
    this.name = 'ProjectPathError';
    this.code = code;
  }
}

export interface ProjectPathStats {
  readonly isDirectory: () => boolean;
}

export interface ProjectPathFileSystem {
  readonly access: (path: string, mode: number) => Promise<void>;
  readonly realpath: (path: string) => Promise<string>;
  readonly stat: (path: string) => Promise<ProjectPathStats>;
}

export type ValidateProjectPath = (projectPath: string) => Promise<string>;

const nodeFileSystem: ProjectPathFileSystem = {
  access: accessPath,
  realpath: getRealPath,
  stat: getPathStats,
};

const getFileSystemErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  return typeof error.code === 'string' ? error.code : undefined;
};

const mapFileSystemError = (error: unknown): ProjectPathError => {
  const code = getFileSystemErrorCode(error);

  if (code === 'ENOENT' || code === 'ENOTDIR') {
    return new ProjectPathError(PROJECT_PATH_ERROR_CODES.notFound, error);
  }

  if (code === 'EACCES' || code === 'EPERM' || code === 'ERR_ACCESS_DENIED') {
    return new ProjectPathError(PROJECT_PATH_ERROR_CODES.notAccessible, error);
  }

  return new ProjectPathError(PROJECT_PATH_ERROR_CODES.validationFailed, error);
};

export const createProjectPathValidator =
  (fileSystem: ProjectPathFileSystem): ValidateProjectPath =>
  async (projectPath) => {
    if (projectPath.trim().length === 0) {
      throw new ProjectPathError(PROJECT_PATH_ERROR_CODES.empty);
    }

    let canonicalPath: string;

    try {
      canonicalPath = await fileSystem.realpath(resolve(projectPath));
    } catch (error) {
      throw mapFileSystemError(error);
    }

    let stats: ProjectPathStats;

    try {
      stats = await fileSystem.stat(canonicalPath);
    } catch (error) {
      throw mapFileSystemError(error);
    }

    if (!stats.isDirectory()) {
      throw new ProjectPathError(PROJECT_PATH_ERROR_CODES.notDirectory);
    }

    try {
      await fileSystem.access(canonicalPath, fileSystemConstants.R_OK | fileSystemConstants.X_OK);
    } catch (error) {
      throw mapFileSystemError(error);
    }

    return canonicalPath;
  };

export const validateProjectPath = createProjectPathValidator(nodeFileSystem);

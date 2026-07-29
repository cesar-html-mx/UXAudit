import { constants as fileSystemConstants } from 'node:fs';
import {
  lstat as getLinkStats,
  open as openPath,
  realpath as getRealPath,
  stat as getPathStats,
} from 'node:fs/promises';
import {
  isAbsolute as isAbsolutePath,
  relative as getRelativePath,
  resolve as resolvePath,
} from 'node:path';
import { TextDecoder } from 'node:util';

import { isPathWithinRoot, toProjectRelativePath } from '../project/project-paths.js';
import {
  SOURCE_PARSER_ERROR_CODES,
  SOURCE_PARSER_ERROR_STAGES,
  type SourceParserError,
  type SourceParserRequest,
} from './parser-contracts.js';

export const MAX_SOURCE_FILE_BYTES = 1_048_576;
export const SOURCE_READ_CHUNK_BYTES = 65_536;

export const SOURCE_ROOT_AUTHORIZATION_ERROR_CODES = Object.freeze({
  unavailable: 'SOURCE_ROOT_UNAVAILABLE',
} as const);

export type SourceRootAuthorizationErrorCode =
  (typeof SOURCE_ROOT_AUTHORIZATION_ERROR_CODES)[keyof typeof SOURCE_ROOT_AUTHORIZATION_ERROR_CODES];

export class SourceRootAuthorizationError extends Error {
  public readonly code = SOURCE_ROOT_AUTHORIZATION_ERROR_CODES.unavailable;

  public constructor() {
    super('Project root could not be authorized for source reading.');
    this.name = 'SourceRootAuthorizationError';
  }
}

export class SourceCandidateReadInvariantError extends Error {
  public readonly code = 'SOURCE_CANDIDATE_READ_INVARIANT_FAILED';

  public constructor() {
    super('Source candidate reading reached an invalid internal state.');
    this.name = 'SourceCandidateReadInvariantError';
  }
}

export interface SourceFileStats {
  readonly ctimeNs: bigint;
  readonly dev: bigint;
  readonly ino: bigint;
  readonly isDirectory: () => boolean;
  readonly isFile: () => boolean;
  readonly mtimeNs: bigint;
  readonly size: bigint;
}

export interface SourceReaderFileHandle {
  readonly close: () => Promise<void>;
  readonly read: (
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ) => Promise<{ readonly bytesRead: number }>;
  readonly stat: () => Promise<SourceFileStats>;
}

export interface SourceReaderFileSystem {
  readonly lstat: (path: string) => Promise<SourceFileStats>;
  readonly open: (path: string, flags: number) => Promise<SourceReaderFileHandle>;
  readonly realpath: (path: string) => Promise<string>;
  readonly stat: (path: string) => Promise<SourceFileStats>;
}

export interface SourceCandidateReadSuccess {
  readonly sourceText: string;
  readonly success: true;
}

export interface SourceCandidateReadFailure {
  readonly error: SourceParserError;
  readonly success: false;
}

export type SourceCandidateReadResult = SourceCandidateReadFailure | SourceCandidateReadSuccess;

export type SourceCandidateReader = (
  request: SourceParserRequest,
) => Promise<SourceCandidateReadResult>;

interface AuthorizedRoot {
  readonly canonicalPath: string;
  readonly stats: SourceFileStats;
}

class CandidateReadError extends Error {
  public readonly code: SourceParserError['code'];

  public constructor(code: SourceParserError['code']) {
    super();
    this.name = 'CandidateReadError';
    this.code = code;
  }
}

class InvalidSourceEncodingError extends Error {
  public constructor() {
    super();
    this.name = 'InvalidSourceEncodingError';
  }
}

const nodeFileSystem: SourceReaderFileSystem = {
  lstat: (path) => getLinkStats(path, { bigint: true }),
  open: async (path, flags) => {
    const handle = await openPath(path, flags);

    return {
      close: async () => handle.close(),
      read: async (buffer, offset, length, position) => {
        const result = await handle.read(buffer, offset, length, position);

        return {
          bytesRead: result.bytesRead,
        };
      },
      stat: () => handle.stat({ bigint: true }),
    };
  },
  realpath: getRealPath,
  stat: (path) => getPathStats(path, { bigint: true }),
};

const windowsDrivePrefixPattern = /^[A-Za-z]:/u;

const getFileSystemErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  return typeof error.code === 'string' ? error.code : undefined;
};

const areEquivalentPaths = (left: string, right: string): boolean =>
  getRelativePath(left, right) === '' && getRelativePath(right, left) === '';

const isPortableDescendantPath = (path: string): boolean => {
  if (
    path.length === 0 ||
    path === '.' ||
    path.includes('\\') ||
    path.startsWith('/') ||
    windowsDrivePrefixPattern.test(path) ||
    isAbsolutePath(path)
  ) {
    return false;
  }

  return path
    .split('/')
    .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
};

const hasValidStats = (stats: SourceFileStats): boolean =>
  typeof stats.dev === 'bigint' &&
  stats.dev >= 0n &&
  typeof stats.ino === 'bigint' &&
  stats.ino >= 0n &&
  typeof stats.size === 'bigint' &&
  stats.size >= 0n &&
  typeof stats.mtimeNs === 'bigint' &&
  stats.mtimeNs >= 0n &&
  typeof stats.ctimeNs === 'bigint' &&
  stats.ctimeNs >= 0n;

const hasSameIdentity = (left: SourceFileStats, right: SourceFileStats): boolean =>
  left.dev === right.dev && left.ino === right.ino;

const hasSameSnapshot = (left: SourceFileStats, right: SourceFileStats): boolean =>
  hasSameIdentity(left, right) &&
  left.size === right.size &&
  left.mtimeNs === right.mtimeNs &&
  left.ctimeNs === right.ctimeNs;

const authorizeRoot = async (
  fileSystem: SourceReaderFileSystem,
  projectRoot: string,
): Promise<AuthorizedRoot> => {
  try {
    if (!isAbsolutePath(projectRoot) || resolvePath(projectRoot) !== projectRoot) {
      throw new SourceRootAuthorizationError();
    }

    const canonicalPath = await fileSystem.realpath(projectRoot);

    if (!areEquivalentPaths(projectRoot, canonicalPath)) {
      throw new SourceRootAuthorizationError();
    }

    const stats = await fileSystem.stat(canonicalPath);

    if (!hasValidStats(stats) || !stats.isDirectory()) {
      throw new SourceRootAuthorizationError();
    }

    return {
      canonicalPath,
      stats,
    };
  } catch (error) {
    throw error instanceof SourceRootAuthorizationError
      ? error
      : new SourceRootAuthorizationError();
  }
};

const reauthorizeRoot = async (
  fileSystem: SourceReaderFileSystem,
  projectRoot: string,
  authorizedRoot: AuthorizedRoot,
): Promise<void> => {
  const currentRoot = await authorizeRoot(fileSystem, projectRoot);

  if (
    !areEquivalentPaths(authorizedRoot.canonicalPath, currentRoot.canonicalPath) ||
    !hasSameIdentity(authorizedRoot.stats, currentRoot.stats)
  ) {
    throw new SourceRootAuthorizationError();
  }
};

const toReadError = (filePath: string, code: SourceParserError['code']): SourceParserError => {
  const messages: Readonly<Record<SourceParserError['code'], string>> = {
    SOURCE_EXTRACTION_FAILED: 'Source analysis could not be completed.',
    SOURCE_EXTRACTION_LIMIT_EXCEEDED: 'Source analysis exceeded its resource limit.',
    SOURCE_FILE_CHANGED: 'Source file changed while it was being read.',
    SOURCE_FILE_INVALID_ENCODING: 'Source file is not valid UTF-8.',
    SOURCE_FILE_NOT_REGULAR: 'Source candidate is not a regular file.',
    SOURCE_FILE_OUTSIDE_ROOT: 'Source candidate is outside the authorized project root.',
    SOURCE_FILE_READ_FAILED: 'Source file could not be read.',
    SOURCE_FILE_TOO_LARGE: 'Source file exceeds the 1 MiB size limit.',
    SOURCE_FILE_UNREADABLE: 'Source file cannot be accessed.',
    SOURCE_PARSE_FAILED: 'Source file contains invalid or unsupported syntax.',
  };

  return {
    code,
    filePath,
    message: messages[code],
    recoverable: true,
    stage: SOURCE_PARSER_ERROR_STAGES.read,
  };
};

const mapCandidateErrorCode = (error: unknown): SourceParserError['code'] => {
  if (error instanceof CandidateReadError) {
    return error.code;
  }

  if (error instanceof InvalidSourceEncodingError) {
    return SOURCE_PARSER_ERROR_CODES.invalidEncoding;
  }

  const code = getFileSystemErrorCode(error);

  if (code === 'EACCES' || code === 'EPERM' || code === 'ERR_ACCESS_DENIED') {
    return SOURCE_PARSER_ERROR_CODES.fileUnreadable;
  }

  if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'ELOOP') {
    return SOURCE_PARSER_ERROR_CODES.fileChanged;
  }

  return SOURCE_PARSER_ERROR_CODES.fileReadFailed;
};

const throwCandidateError = (code: SourceParserError['code']): never => {
  throw new CandidateReadError(code);
};

const assertRegularSnapshot = (
  stats: SourceFileStats,
  expected?: SourceFileStats,
): SourceFileStats => {
  if (!hasValidStats(stats)) {
    return throwCandidateError(SOURCE_PARSER_ERROR_CODES.fileChanged);
  }

  if (!stats.isFile()) {
    return throwCandidateError(SOURCE_PARSER_ERROR_CODES.fileNotRegular);
  }

  if (stats.size > BigInt(MAX_SOURCE_FILE_BYTES)) {
    return throwCandidateError(SOURCE_PARSER_ERROR_CODES.fileTooLarge);
  }

  if (expected !== undefined && !hasSameSnapshot(expected, stats)) {
    return throwCandidateError(SOURCE_PARSER_ERROR_CODES.fileChanged);
  }

  return stats;
};

const validateCandidateDeclaration = (
  authorizedRoot: string,
  absolutePath: string,
  relativePath: string,
): void => {
  if (!isPortableDescendantPath(relativePath)) {
    throw new SourceCandidateReadInvariantError();
  }

  if (
    !isAbsolutePath(absolutePath) ||
    resolvePath(absolutePath) !== absolutePath ||
    !isPathWithinRoot(authorizedRoot, absolutePath) ||
    areEquivalentPaths(authorizedRoot, absolutePath) ||
    toProjectRelativePath(authorizedRoot, absolutePath) !== relativePath
  ) {
    throwCandidateError(SOURCE_PARSER_ERROR_CODES.fileOutsideRoot);
  }
};

const validateCanonicalCandidate = (
  authorizedRoot: string,
  expectedPath: string,
  canonicalPath: string,
): void => {
  if (!isPathWithinRoot(authorizedRoot, canonicalPath)) {
    throwCandidateError(SOURCE_PARSER_ERROR_CODES.fileOutsideRoot);
  }

  if (!areEquivalentPaths(expectedPath, canonicalPath)) {
    throwCandidateError(SOURCE_PARSER_ERROR_CODES.fileChanged);
  }
};

const getOpenFlags = (platform: NodeJS.Platform): number =>
  platform === 'win32'
    ? fileSystemConstants.O_RDONLY
    : fileSystemConstants.O_RDONLY |
      fileSystemConstants.O_NOFOLLOW |
      fileSystemConstants.O_NONBLOCK;

const readBoundedBytes = async (
  handle: SourceReaderFileHandle,
  expectedSize: bigint,
): Promise<Uint8Array> => {
  const buffer = new Uint8Array(MAX_SOURCE_FILE_BYTES + 1);
  let totalBytes = 0;

  while (totalBytes < buffer.byteLength) {
    const requestedBytes = Math.min(SOURCE_READ_CHUNK_BYTES, buffer.byteLength - totalBytes);
    const { bytesRead } = await handle.read(buffer, totalBytes, requestedBytes, totalBytes);

    if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || bytesRead > requestedBytes) {
      throwCandidateError(SOURCE_PARSER_ERROR_CODES.fileReadFailed);
    }

    if (bytesRead === 0) {
      break;
    }

    totalBytes += bytesRead;
  }

  if (totalBytes > MAX_SOURCE_FILE_BYTES) {
    throwCandidateError(SOURCE_PARSER_ERROR_CODES.fileTooLarge);
  }

  if (BigInt(totalBytes) !== expectedSize) {
    throwCandidateError(SOURCE_PARSER_ERROR_CODES.fileChanged);
  }

  return buffer.subarray(0, totalBytes);
};

const decodeSourceBytes = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
  } catch {
    throw new InvalidSourceEncodingError();
  }
};

export const createSourceCandidateReader =
  (
    fileSystem: SourceReaderFileSystem,
    platform: NodeJS.Platform = process.platform,
  ): SourceCandidateReader =>
  async ({ candidate, projectRoot }) => {
    const authorizedRoot = await authorizeRoot(fileSystem, projectRoot);
    let handle: SourceReaderFileHandle | undefined;
    let result: SourceCandidateReadResult | undefined;
    let fatalError: SourceCandidateReadInvariantError | SourceRootAuthorizationError | undefined;

    try {
      validateCandidateDeclaration(
        authorizedRoot.canonicalPath,
        candidate.absolutePath,
        candidate.relativePath,
      );

      const initialStats = assertRegularSnapshot(await fileSystem.lstat(candidate.absolutePath));
      const canonicalCandidate = await fileSystem.realpath(candidate.absolutePath);

      validateCanonicalCandidate(
        authorizedRoot.canonicalPath,
        candidate.absolutePath,
        canonicalCandidate,
      );
      assertRegularSnapshot(await fileSystem.stat(canonicalCandidate), initialStats);
      await reauthorizeRoot(fileSystem, projectRoot, authorizedRoot);

      handle = await fileSystem.open(candidate.absolutePath, getOpenFlags(platform));

      const openedStats = assertRegularSnapshot(await handle.stat(), initialStats);

      await reauthorizeRoot(fileSystem, projectRoot, authorizedRoot);

      const openedCanonicalCandidate = await fileSystem.realpath(candidate.absolutePath);

      validateCanonicalCandidate(
        authorizedRoot.canonicalPath,
        candidate.absolutePath,
        openedCanonicalCandidate,
      );
      assertRegularSnapshot(await fileSystem.stat(openedCanonicalCandidate), openedStats);

      const bytes = await readBoundedBytes(handle, openedStats.size);
      const finalHandleStats = assertRegularSnapshot(await handle.stat(), openedStats);
      const finalCanonicalCandidate = await fileSystem.realpath(candidate.absolutePath);

      validateCanonicalCandidate(
        authorizedRoot.canonicalPath,
        candidate.absolutePath,
        finalCanonicalCandidate,
      );
      assertRegularSnapshot(await fileSystem.stat(finalCanonicalCandidate), finalHandleStats);
      await reauthorizeRoot(fileSystem, projectRoot, authorizedRoot);

      result = {
        sourceText: decodeSourceBytes(bytes),
        success: true,
      };
    } catch (error) {
      if (
        error instanceof SourceCandidateReadInvariantError ||
        error instanceof SourceRootAuthorizationError
      ) {
        fatalError = error;
      } else {
        try {
          await reauthorizeRoot(fileSystem, projectRoot, authorizedRoot);
          result = {
            error: toReadError(candidate.relativePath, mapCandidateErrorCode(error)),
            success: false,
          };
        } catch {
          fatalError = new SourceRootAuthorizationError();
        }
      }
    } finally {
      if (handle !== undefined) {
        try {
          await handle.close();
        } catch {
          if (fatalError === undefined && (result === undefined || result.success)) {
            result = {
              error: toReadError(candidate.relativePath, SOURCE_PARSER_ERROR_CODES.fileReadFailed),
              success: false,
            };
          }
        }
      }
    }

    if (fatalError !== undefined) {
      throw fatalError;
    }

    return (
      result ?? {
        error: toReadError(candidate.relativePath, SOURCE_PARSER_ERROR_CODES.fileReadFailed),
        success: false,
      }
    );
  };

export const readSourceCandidate = createSourceCandidateReader(nodeFileSystem);

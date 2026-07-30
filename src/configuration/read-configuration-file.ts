import { constants as fileSystemConstants } from 'node:fs';
import {
  lstat as getLinkStats,
  open as openPath,
  realpath as getRealPath,
  stat as getPathStats,
} from 'node:fs/promises';
import {
  isAbsolute as isAbsolutePath,
  join as joinPath,
  relative as getRelativePath,
  resolve as resolvePath,
  sep as pathSeparator,
} from 'node:path';
import { TextDecoder, types as utilityTypes } from 'node:util';

import {
  CONFIGURATION_ERROR_CODES,
  CONFIGURATION_FILE_NAME,
  ConfigurationError,
} from './configuration.js';

export const MAX_CONFIGURATION_FILE_BYTES = 65_536;
export const CONFIGURATION_READ_CHUNK_BYTES = 65_536;

export interface ConfigurationFileStats {
  readonly ctimeNs: bigint;
  readonly dev: bigint;
  readonly ino: bigint;
  readonly isDirectory: () => boolean;
  readonly isFile: () => boolean;
  readonly mtimeNs: bigint;
  readonly size: bigint;
}

export interface ConfigurationReaderFileHandle {
  readonly close: () => Promise<void>;
  readonly read: (
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ) => Promise<{ readonly bytesRead: number }>;
  readonly stat: () => Promise<ConfigurationFileStats>;
}

export interface ConfigurationReaderFileSystem {
  readonly lstat: (path: string) => Promise<ConfigurationFileStats>;
  readonly open: (path: string, flags: number) => Promise<ConfigurationReaderFileHandle>;
  readonly realpath: (path: string) => Promise<string>;
  readonly stat: (path: string) => Promise<ConfigurationFileStats>;
}

export interface ConfigurationFileReadRequest {
  /**
   * An explicit path is user-authorized and may resolve outside `projectRoot`.
   * When omitted, only the conventional file at the canonical root is eligible.
   */
  readonly configurationPath?: string;
  readonly projectRoot: string;
}

export type ConfigurationFileReader = (
  request: ConfigurationFileReadRequest,
) => Promise<string | null>;

export type ReadConfigurationFile = ConfigurationFileReader;

interface AuthorizedConfigurationPath {
  readonly canonicalPath: string;
  readonly initialStats: ConfigurationFileStats;
  readonly requestedPath: string;
}

interface AuthorizedProjectRoot {
  readonly canonicalPath: string;
  readonly initialStats: ConfigurationFileStats;
}

class ConfigurationFileChangedError extends Error {
  public constructor() {
    super();
    this.name = 'ConfigurationFileChangedError';
  }
}

class InvalidConfigurationEncodingError extends Error {
  public constructor() {
    super();
    this.name = 'InvalidConfigurationEncodingError';
  }
}

const nodeFileSystem: ConfigurationReaderFileSystem = {
  lstat: (path) => getLinkStats(path, { bigint: true }),
  open: async (path, flags) => {
    const handle = await openPath(path, flags);

    return {
      close: async () => handle.close(),
      read: async (buffer, offset, length, position) => {
        const { bytesRead } = await handle.read(buffer, offset, length, position);

        return {
          bytesRead,
        };
      },
      stat: () => handle.stat({ bigint: true }),
    };
  },
  realpath: getRealPath,
  stat: (path) => getPathStats(path, { bigint: true }),
};

const isNonProxyObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null && !utilityTypes.isProxy(value);

const getFileSystemErrorCode = (error: unknown): string | undefined => {
  if (!isNonProxyObject(error)) {
    return undefined;
  }

  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, 'code');

    return descriptor !== undefined && 'value' in descriptor && typeof descriptor.value === 'string'
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
};

const areEquivalentPaths = (left: string, right: string): boolean =>
  getRelativePath(left, right) === '' && getRelativePath(right, left) === '';

const isPathWithinRoot = (rootPath: string, candidatePath: string): boolean => {
  const relativePath = getRelativePath(rootPath, candidatePath);

  return (
    relativePath.length > 0 &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${pathSeparator}`) &&
    !isAbsolutePath(relativePath)
  );
};

const hasValidStats = (stats: ConfigurationFileStats): boolean =>
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

const hasSameSnapshot = (left: ConfigurationFileStats, right: ConfigurationFileStats): boolean =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.size === right.size &&
  left.mtimeNs === right.mtimeNs &&
  left.ctimeNs === right.ctimeNs;

const throwConfigurationError = (
  code: ConstructorParameters<typeof ConfigurationError>[0],
): never => {
  throw new ConfigurationError(code);
};

const assertRegularConfigurationFile = (
  stats: ConfigurationFileStats,
  expected?: ConfigurationFileStats,
): ConfigurationFileStats => {
  if (!hasValidStats(stats)) {
    throw new ConfigurationFileChangedError();
  }

  if (!stats.isFile()) {
    return throwConfigurationError(CONFIGURATION_ERROR_CODES.fileNotRegular);
  }

  if (stats.size > BigInt(MAX_CONFIGURATION_FILE_BYTES)) {
    return throwConfigurationError(CONFIGURATION_ERROR_CODES.fileTooLarge);
  }

  if (expected !== undefined && !hasSameSnapshot(expected, stats)) {
    throw new ConfigurationFileChangedError();
  }

  return stats;
};

const authorizeCanonicalRoot = async (
  fileSystem: ConfigurationReaderFileSystem,
  projectRoot: string,
): Promise<AuthorizedProjectRoot> => {
  try {
    if (!isAbsolutePath(projectRoot) || resolvePath(projectRoot) !== projectRoot) {
      return throwConfigurationError(CONFIGURATION_ERROR_CODES.unsafePath);
    }

    const canonicalRoot = await fileSystem.realpath(projectRoot);
    const rootStats = await fileSystem.stat(canonicalRoot);

    if (
      !areEquivalentPaths(projectRoot, canonicalRoot) ||
      !hasValidStats(rootStats) ||
      !rootStats.isDirectory()
    ) {
      return throwConfigurationError(CONFIGURATION_ERROR_CODES.unsafePath);
    }

    return {
      canonicalPath: canonicalRoot,
      initialStats: rootStats,
    };
  } catch (error) {
    if (isNonProxyObject(error) && error instanceof ConfigurationError) {
      throw error;
    }

    return throwConfigurationError(CONFIGURATION_ERROR_CODES.fileReadFailed);
  }
};

const assertCanonicalRootUnchanged = async (
  fileSystem: ConfigurationReaderFileSystem,
  projectRoot: string,
  authorizedRoot: AuthorizedProjectRoot,
): Promise<void> => {
  try {
    const canonicalRoot = await fileSystem.realpath(projectRoot);
    const rootStats = await fileSystem.stat(canonicalRoot);

    if (
      !areEquivalentPaths(canonicalRoot, authorizedRoot.canonicalPath) ||
      !hasValidStats(rootStats) ||
      !rootStats.isDirectory() ||
      rootStats.dev !== authorizedRoot.initialStats.dev ||
      rootStats.ino !== authorizedRoot.initialStats.ino
    ) {
      return throwConfigurationError(CONFIGURATION_ERROR_CODES.unsafePath);
    }
  } catch (error) {
    if (isNonProxyObject(error) && error instanceof ConfigurationError) {
      throw error;
    }

    return throwConfigurationError(CONFIGURATION_ERROR_CODES.fileReadFailed);
  }
};

const authorizeConfigurationPath = async (
  fileSystem: ConfigurationReaderFileSystem,
  requestedPath: string,
  canonicalRoot: string | undefined,
): Promise<AuthorizedConfigurationPath> => {
  const initialStats = assertRegularConfigurationFile(await fileSystem.lstat(requestedPath));
  const canonicalPath = await fileSystem.realpath(requestedPath);

  if (
    canonicalRoot !== undefined &&
    (!isPathWithinRoot(canonicalRoot, canonicalPath) ||
      !areEquivalentPaths(requestedPath, canonicalPath))
  ) {
    return throwConfigurationError(CONFIGURATION_ERROR_CODES.unsafePath);
  }

  assertRegularConfigurationFile(await fileSystem.stat(canonicalPath), initialStats);

  return {
    canonicalPath,
    initialStats,
    requestedPath,
  };
};

const assertConfigurationPathUnchanged = async (
  fileSystem: ConfigurationReaderFileSystem,
  authorizedPath: AuthorizedConfigurationPath,
): Promise<void> => {
  const currentCanonicalPath = await fileSystem.realpath(authorizedPath.requestedPath);

  if (!areEquivalentPaths(currentCanonicalPath, authorizedPath.canonicalPath)) {
    throw new ConfigurationFileChangedError();
  }

  assertRegularConfigurationFile(
    await fileSystem.lstat(authorizedPath.requestedPath),
    authorizedPath.initialStats,
  );
  assertRegularConfigurationFile(
    await fileSystem.stat(authorizedPath.canonicalPath),
    authorizedPath.initialStats,
  );
};

const getOpenFlags = (platform: NodeJS.Platform): number =>
  platform === 'win32'
    ? fileSystemConstants.O_RDONLY
    : fileSystemConstants.O_RDONLY |
      fileSystemConstants.O_NOFOLLOW |
      fileSystemConstants.O_NONBLOCK;

const readBoundedBytes = async (
  handle: ConfigurationReaderFileHandle,
  expectedSize: bigint,
): Promise<Uint8Array> => {
  const buffer = new Uint8Array(MAX_CONFIGURATION_FILE_BYTES + 1);
  let totalBytes = 0;

  while (totalBytes < buffer.byteLength) {
    const requestedBytes = Math.min(CONFIGURATION_READ_CHUNK_BYTES, buffer.byteLength - totalBytes);
    const { bytesRead } = await handle.read(buffer, totalBytes, requestedBytes, totalBytes);

    if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || bytesRead > requestedBytes) {
      throw new ConfigurationFileChangedError();
    }

    if (bytesRead === 0) {
      break;
    }

    totalBytes += bytesRead;
  }

  if (totalBytes > MAX_CONFIGURATION_FILE_BYTES) {
    return throwConfigurationError(CONFIGURATION_ERROR_CODES.fileTooLarge);
  }

  if (BigInt(totalBytes) !== expectedSize) {
    throw new ConfigurationFileChangedError();
  }

  return buffer.subarray(0, totalBytes);
};

const decodeConfigurationBytes = (bytes: Uint8Array): string => {
  try {
    // The default BOM handling removes one initial UTF-8 BOM, which JSON permits at this boundary.
    return new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: false,
    }).decode(bytes);
  } catch {
    throw new InvalidConfigurationEncodingError();
  }
};

const mapReadError = (error: unknown, explicitPath: boolean): ConfigurationError => {
  if (isNonProxyObject(error) && error instanceof ConfigurationError) {
    return error;
  }

  if (isNonProxyObject(error) && error instanceof InvalidConfigurationEncodingError) {
    return new ConfigurationError(CONFIGURATION_ERROR_CODES.fileInvalidEncoding);
  }

  const nativeCode = getFileSystemErrorCode(error);

  if (explicitPath && (nativeCode === 'ENOENT' || nativeCode === 'ENOTDIR')) {
    return new ConfigurationError(CONFIGURATION_ERROR_CODES.explicitFileNotFound);
  }

  if (nativeCode === 'ELOOP') {
    return new ConfigurationError(CONFIGURATION_ERROR_CODES.fileNotRegular);
  }

  return new ConfigurationError(CONFIGURATION_ERROR_CODES.fileReadFailed);
};

const isMissingDefaultFile = (error: unknown): boolean =>
  getFileSystemErrorCode(error) === 'ENOENT';

export const createConfigurationFileReader =
  (
    fileSystem: ConfigurationReaderFileSystem,
    platform: NodeJS.Platform = process.platform,
  ): ConfigurationFileReader =>
  async ({ configurationPath, projectRoot }) => {
    const explicitPath = configurationPath !== undefined;
    let authorizedRoot: AuthorizedProjectRoot | undefined;
    let requestedPath: string;

    if (explicitPath) {
      requestedPath = resolvePath(configurationPath);
    } else {
      authorizedRoot = await authorizeCanonicalRoot(fileSystem, projectRoot);

      requestedPath = joinPath(authorizedRoot.canonicalPath, CONFIGURATION_FILE_NAME);
    }

    let authorizedPath: AuthorizedConfigurationPath;

    try {
      authorizedPath = await authorizeConfigurationPath(
        fileSystem,
        requestedPath,
        authorizedRoot?.canonicalPath,
      );
    } catch (error) {
      if (!explicitPath && isMissingDefaultFile(error)) {
        if (authorizedRoot === undefined) {
          return throwConfigurationError(CONFIGURATION_ERROR_CODES.fileReadFailed);
        }

        await assertCanonicalRootUnchanged(fileSystem, projectRoot, authorizedRoot);
        return null;
      }

      throw mapReadError(error, explicitPath);
    }

    let handle: ConfigurationReaderFileHandle | undefined;
    let result: string | undefined;
    let readError: ConfigurationError | undefined;

    try {
      if (authorizedRoot !== undefined) {
        await assertCanonicalRootUnchanged(fileSystem, projectRoot, authorizedRoot);
      }

      handle = await fileSystem.open(authorizedPath.canonicalPath, getOpenFlags(platform));
      const openedStats = assertRegularConfigurationFile(
        await handle.stat(),
        authorizedPath.initialStats,
      );

      if (authorizedRoot !== undefined) {
        await assertCanonicalRootUnchanged(fileSystem, projectRoot, authorizedRoot);
      }
      await assertConfigurationPathUnchanged(fileSystem, authorizedPath);

      const bytes = await readBoundedBytes(handle, openedStats.size);

      assertRegularConfigurationFile(await handle.stat(), openedStats);
      await assertConfigurationPathUnchanged(fileSystem, authorizedPath);
      if (authorizedRoot !== undefined) {
        await assertCanonicalRootUnchanged(fileSystem, projectRoot, authorizedRoot);
      }

      result = decodeConfigurationBytes(bytes);
    } catch (error) {
      readError = mapReadError(error, explicitPath);
    } finally {
      if (handle !== undefined) {
        try {
          await handle.close();
        } catch {
          readError ??= new ConfigurationError(CONFIGURATION_ERROR_CODES.fileReadFailed);
        }
      }
    }

    if (readError !== undefined) {
      throw readError;
    }

    return result ?? throwConfigurationError(CONFIGURATION_ERROR_CODES.fileReadFailed);
  };

export const readConfigurationFile = createConfigurationFileReader(nodeFileSystem);

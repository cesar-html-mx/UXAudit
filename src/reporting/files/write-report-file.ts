import { Buffer } from 'node:buffer';
import { constants as fileSystemConstants } from 'node:fs';
import {
  lstat as getLinkStats,
  mkdir as makeDirectory,
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
import { types as utilityTypes } from 'node:util';

import { REPORT_FILE_NAMES } from '../../configuration/configuration.js';
import { isSafeOutputDirectory } from '../../configuration/configuration-validation.js';

export const REPORT_WRITE_CHUNK_BYTES = 65_536;

export const REPORT_WRITE_ERROR_CODES = Object.freeze({
  invalidRequest: 'REPORT_WRITE_INVALID',
  pathUnsafe: 'REPORT_WRITE_PATH_UNSAFE',
  targetExists: 'REPORT_WRITE_TARGET_EXISTS',
  writeFailed: 'REPORT_WRITE_FAILED',
} as const);

export type ReportWriteErrorCode =
  (typeof REPORT_WRITE_ERROR_CODES)[keyof typeof REPORT_WRITE_ERROR_CODES];

const REPORT_WRITE_ERROR_MESSAGES: Readonly<Record<ReportWriteErrorCode, string>> = Object.freeze({
  [REPORT_WRITE_ERROR_CODES.invalidRequest]: 'Report write request is invalid.',
  [REPORT_WRITE_ERROR_CODES.pathUnsafe]:
    'The report path could not be authorized within the project root.',
  [REPORT_WRITE_ERROR_CODES.targetExists]:
    'The report target already exists and was not overwritten.',
  [REPORT_WRITE_ERROR_CODES.writeFailed]: 'The report file could not be written.',
});

export class ReportWriteError extends Error {
  public readonly code: ReportWriteErrorCode;

  public constructor(code: ReportWriteErrorCode) {
    super(REPORT_WRITE_ERROR_MESSAGES[code]);
    this.name = 'ReportWriteError';
    this.code = code;
  }
}

export type FileReportFormat = keyof typeof REPORT_FILE_NAMES;

export interface ReportFileWriteRequest {
  readonly content: string;
  readonly format: FileReportFormat;
  readonly projectRoot: string;
  readonly relativePath: string;
}

export interface WrittenReport {
  readonly format: FileReportFormat;
  readonly relativePath: string;
}

export interface ReportFileStats {
  readonly ctimeNs: bigint;
  readonly dev: bigint;
  readonly ino: bigint;
  readonly isDirectory: () => boolean;
  readonly isFile: () => boolean;
  readonly mtimeNs: bigint;
  readonly size: bigint;
}

export interface ReportWriterFileHandle {
  readonly close: () => Promise<void>;
  readonly stat: () => Promise<ReportFileStats>;
  readonly sync: () => Promise<void>;
  readonly write: (
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ) => Promise<{ readonly bytesWritten: number }>;
}

export interface ReportWriterFileSystem {
  readonly lstat: (path: string) => Promise<ReportFileStats>;
  readonly mkdir: (
    path: string,
    options: { readonly mode: number; readonly recursive: false },
  ) => Promise<void>;
  readonly open: (path: string, flags: number, mode: number) => Promise<ReportWriterFileHandle>;
  readonly realpath: (path: string) => Promise<string>;
  readonly stat: (path: string) => Promise<ReportFileStats>;
}

export type ReportFileWriter = (request: ReportFileWriteRequest) => Promise<WrittenReport>;

interface AuthorizedDirectory {
  readonly canonicalPath: string;
  readonly stats: ReportFileStats;
}

interface NormalizedWriteRequest extends ReportFileWriteRequest {
  readonly outputDirectory: string;
}

const DIRECTORY_MODE = 0o700;
const REPORT_FILE_MODE = 0o600;
const requestKeys = new Set(['content', 'format', 'projectRoot', 'relativePath']);

const nodeFileSystem: ReportWriterFileSystem = {
  lstat: (path) => getLinkStats(path, { bigint: true }),
  mkdir: async (path, options) => {
    await makeDirectory(path, options);
  },
  open: async (path, flags, mode) => {
    const handle = await openPath(path, flags, mode);

    return {
      close: async () => handle.close(),
      stat: () => handle.stat({ bigint: true }),
      sync: async () => handle.sync(),
      write: async (buffer, offset, length, position) => {
        const { bytesWritten } = await handle.write(buffer, offset, length, position);

        return { bytesWritten };
      },
    };
  },
  realpath: getRealPath,
  stat: (path) => getPathStats(path, { bigint: true }),
};

const isNonProxyObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null && !utilityTypes.isProxy(value);

const isReportWriteError = (error: unknown): error is ReportWriteError =>
  isNonProxyObject(error) && error instanceof ReportWriteError;

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

const throwReportWriteError = (code: ReportWriteErrorCode): never => {
  throw new ReportWriteError(code);
};

const normalizeWriteError = (error: unknown): ReportWriteError =>
  isReportWriteError(error) ? error : new ReportWriteError(REPORT_WRITE_ERROR_CODES.writeFailed);

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

const hasValidStats = (stats: ReportFileStats): boolean =>
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

const hasSameIdentity = (left: ReportFileStats, right: ReportFileStats): boolean =>
  left.dev === right.dev && left.ino === right.ino;

const hasSameSnapshot = (left: ReportFileStats, right: ReportFileStats): boolean =>
  hasSameIdentity(left, right) &&
  left.size === right.size &&
  left.mtimeNs === right.mtimeNs &&
  left.ctimeNs === right.ctimeNs;

const requireWriteRequest = (value: unknown): NormalizedWriteRequest => {
  if (
    !isNonProxyObject(value) ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return throwReportWriteError(REPORT_WRITE_ERROR_CODES.invalidRequest);
  }

  const ownKeys = Reflect.ownKeys(value);

  if (
    ownKeys.length !== requestKeys.size ||
    ownKeys.some((key) => typeof key !== 'string' || !requestKeys.has(key))
  ) {
    return throwReportWriteError(REPORT_WRITE_ERROR_CODES.invalidRequest);
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);

  for (const key of requestKeys) {
    const descriptor = descriptors[key];

    if (descriptor === undefined || !('value' in descriptor) || descriptor.enumerable !== true) {
      return throwReportWriteError(REPORT_WRITE_ERROR_CODES.invalidRequest);
    }
  }

  const content: unknown = descriptors['content']?.value;
  const format: unknown = descriptors['format']?.value;
  const projectRoot: unknown = descriptors['projectRoot']?.value;
  const relativePath: unknown = descriptors['relativePath']?.value;

  if (
    typeof content !== 'string' ||
    !content.isWellFormed() ||
    typeof format !== 'string' ||
    !Object.hasOwn(REPORT_FILE_NAMES, format) ||
    typeof projectRoot !== 'string' ||
    typeof relativePath !== 'string'
  ) {
    return throwReportWriteError(REPORT_WRITE_ERROR_CODES.invalidRequest);
  }

  const normalizedFormat = format as FileReportFormat;
  const expectedSuffix = `/${REPORT_FILE_NAMES[normalizedFormat]}`;

  if (!relativePath.endsWith(expectedSuffix)) {
    return throwReportWriteError(REPORT_WRITE_ERROR_CODES.invalidRequest);
  }

  const outputDirectory = relativePath.slice(0, -expectedSuffix.length);

  if (
    !isSafeOutputDirectory(outputDirectory) ||
    relativePath !== `${outputDirectory}${expectedSuffix}`
  ) {
    return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
  }

  return {
    content,
    format: normalizedFormat,
    outputDirectory,
    projectRoot,
    relativePath,
  };
};

const requireDirectoryStats = (
  observed: ReportFileStats,
  expected?: ReportFileStats,
): ReportFileStats => {
  if (
    !hasValidStats(observed) ||
    !observed.isDirectory() ||
    (expected !== undefined && !hasSameIdentity(observed, expected))
  ) {
    return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
  }

  return observed;
};

const authorizeDirectory = async (
  fileSystem: ReportWriterFileSystem,
  rootPath: string,
  directoryPath: string,
  expected?: ReportFileStats,
): Promise<AuthorizedDirectory> => {
  try {
    const linkStats = requireDirectoryStats(await fileSystem.lstat(directoryPath), expected);
    const canonicalPath = await fileSystem.realpath(directoryPath);

    if (
      !areEquivalentPaths(directoryPath, canonicalPath) ||
      (!areEquivalentPaths(rootPath, canonicalPath) && !isPathWithinRoot(rootPath, canonicalPath))
    ) {
      return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
    }

    const pathStats = requireDirectoryStats(await fileSystem.stat(canonicalPath), linkStats);

    return {
      canonicalPath,
      stats: pathStats,
    };
  } catch (error) {
    if (isReportWriteError(error)) {
      throw error;
    }

    return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
  }
};

const authorizeRoot = async (
  fileSystem: ReportWriterFileSystem,
  projectRoot: string,
): Promise<AuthorizedDirectory> => {
  if (!isAbsolutePath(projectRoot) || resolvePath(projectRoot) !== projectRoot) {
    return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
  }

  return await authorizeDirectory(fileSystem, projectRoot, projectRoot);
};

const reauthorizeDirectories = async (
  fileSystem: ReportWriterFileSystem,
  rootPath: string,
  directories: readonly AuthorizedDirectory[],
): Promise<void> => {
  for (const directory of directories) {
    await authorizeDirectory(fileSystem, rootPath, directory.canonicalPath, directory.stats);
  }
};

const mapDirectoryCreationError = async (
  fileSystem: ReportWriterFileSystem,
  rootPath: string,
  directories: readonly AuthorizedDirectory[],
  error: unknown,
): Promise<never> => {
  await reauthorizeDirectories(fileSystem, rootPath, directories);

  const code = getFileSystemErrorCode(error);

  if (code === 'EEXIST' || code === 'ELOOP' || code === 'ENOENT' || code === 'ENOTDIR') {
    return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
  }

  throw normalizeWriteError(error);
};

const ensureOutputDirectory = async (
  fileSystem: ReportWriterFileSystem,
  root: AuthorizedDirectory,
  outputDirectory: string,
): Promise<readonly AuthorizedDirectory[]> => {
  const directories: AuthorizedDirectory[] = [root];
  let parent = root;

  for (const segment of outputDirectory.split('/')) {
    await reauthorizeDirectories(fileSystem, root.canonicalPath, directories);

    const directoryPath = joinPath(parent.canonicalPath, segment);

    if (!isPathWithinRoot(root.canonicalPath, directoryPath)) {
      return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
    }

    let initialStats: ReportFileStats;

    try {
      initialStats = await fileSystem.lstat(directoryPath);
    } catch (error) {
      if (getFileSystemErrorCode(error) !== 'ENOENT') {
        return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
      }

      await reauthorizeDirectories(fileSystem, root.canonicalPath, directories);

      try {
        await fileSystem.mkdir(directoryPath, {
          mode: DIRECTORY_MODE,
          recursive: false,
        });
      } catch (mkdirError) {
        return await mapDirectoryCreationError(
          fileSystem,
          root.canonicalPath,
          directories,
          mkdirError,
        );
      }

      try {
        initialStats = await fileSystem.lstat(directoryPath);
      } catch {
        return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
      }
    }

    const authorized = await authorizeDirectory(
      fileSystem,
      root.canonicalPath,
      directoryPath,
      initialStats,
    );

    directories.push(authorized);
    await reauthorizeDirectories(fileSystem, root.canonicalPath, directories);
    parent = authorized;
  }

  return directories;
};

const getOpenFlags = (platform: NodeJS.Platform): number =>
  platform === 'win32'
    ? fileSystemConstants.O_WRONLY | fileSystemConstants.O_CREAT | fileSystemConstants.O_EXCL
    : fileSystemConstants.O_WRONLY |
      fileSystemConstants.O_CREAT |
      fileSystemConstants.O_EXCL |
      fileSystemConstants.O_NOFOLLOW;

const openExclusiveReport = async (
  fileSystem: ReportWriterFileSystem,
  platform: NodeJS.Platform,
  rootPath: string,
  directories: readonly AuthorizedDirectory[],
  targetPath: string,
): Promise<ReportWriterFileHandle> => {
  await reauthorizeDirectories(fileSystem, rootPath, directories);

  try {
    return await fileSystem.open(targetPath, getOpenFlags(platform), REPORT_FILE_MODE);
  } catch (error) {
    await reauthorizeDirectories(fileSystem, rootPath, directories);

    const code = getFileSystemErrorCode(error);

    if (code === 'EEXIST' || code === 'ELOOP') {
      return throwReportWriteError(REPORT_WRITE_ERROR_CODES.targetExists);
    }

    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
    }

    throw normalizeWriteError(error);
  }
};

const requireInitialHandleStats = (stats: ReportFileStats): ReportFileStats => {
  if (!hasValidStats(stats) || !stats.isFile() || stats.size !== 0n) {
    return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
  }

  return stats;
};

const requireWrittenHandleStats = (
  stats: ReportFileStats,
  initialStats: ReportFileStats,
  expectedBytes: number,
): ReportFileStats => {
  if (!hasValidStats(stats) || !stats.isFile() || !hasSameIdentity(stats, initialStats)) {
    return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
  }

  if (stats.size !== BigInt(expectedBytes)) {
    return throwReportWriteError(REPORT_WRITE_ERROR_CODES.writeFailed);
  }

  return stats;
};

const authorizeTarget = async (
  fileSystem: ReportWriterFileSystem,
  rootPath: string,
  targetPath: string,
  handleStats: ReportFileStats,
): Promise<void> => {
  try {
    const linkStats = await fileSystem.lstat(targetPath);

    if (!hasValidStats(linkStats) || !linkStats.isFile()) {
      return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
    }

    const canonicalPath = await fileSystem.realpath(targetPath);

    if (
      !areEquivalentPaths(targetPath, canonicalPath) ||
      !isPathWithinRoot(rootPath, canonicalPath)
    ) {
      return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
    }

    const pathStats = await fileSystem.stat(canonicalPath);

    if (
      !hasValidStats(pathStats) ||
      !pathStats.isFile() ||
      !hasSameSnapshot(linkStats, pathStats) ||
      !hasSameSnapshot(pathStats, handleStats)
    ) {
      return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
    }
  } catch (error) {
    if (isReportWriteError(error)) {
      throw error;
    }

    return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
  }
};

const writeAllBytes = async (handle: ReportWriterFileHandle, bytes: Uint8Array): Promise<void> => {
  let offset = 0;

  while (offset < bytes.byteLength) {
    const requestedBytes = Math.min(REPORT_WRITE_CHUNK_BYTES, bytes.byteLength - offset);
    const { bytesWritten } = await handle.write(bytes, offset, requestedBytes, offset);

    if (!Number.isSafeInteger(bytesWritten) || bytesWritten <= 0 || bytesWritten > requestedBytes) {
      return throwReportWriteError(REPORT_WRITE_ERROR_CODES.writeFailed);
    }

    offset += bytesWritten;
  }
};

export const createReportFileWriter =
  (
    fileSystem: ReportWriterFileSystem,
    platform: NodeJS.Platform = process.platform,
  ): ReportFileWriter =>
  async (request) => {
    const normalized = requireWriteRequest(request);
    const root = await authorizeRoot(fileSystem, normalized.projectRoot);
    const directories = await ensureOutputDirectory(fileSystem, root, normalized.outputDirectory);
    const outputDirectory = directories.at(-1);

    if (outputDirectory === undefined) {
      return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
    }

    const targetPath = joinPath(
      outputDirectory.canonicalPath,
      REPORT_FILE_NAMES[normalized.format],
    );

    if (!isPathWithinRoot(root.canonicalPath, targetPath)) {
      return throwReportWriteError(REPORT_WRITE_ERROR_CODES.pathUnsafe);
    }

    const handle = await openExclusiveReport(
      fileSystem,
      platform,
      root.canonicalPath,
      directories,
      targetPath,
    );
    let finalStats: ReportFileStats | undefined;
    let pendingError: ReportWriteError | undefined;

    try {
      const initialStats = requireInitialHandleStats(await handle.stat());

      await reauthorizeDirectories(fileSystem, root.canonicalPath, directories);
      await authorizeTarget(fileSystem, root.canonicalPath, targetPath, initialStats);

      const bytes = Buffer.from(normalized.content, 'utf8');

      await writeAllBytes(handle, bytes);
      await handle.sync();
      finalStats = requireWrittenHandleStats(await handle.stat(), initialStats, bytes.byteLength);

      await reauthorizeDirectories(fileSystem, root.canonicalPath, directories);
      await authorizeTarget(fileSystem, root.canonicalPath, targetPath, finalStats);
      await reauthorizeDirectories(fileSystem, root.canonicalPath, directories);
    } catch (error) {
      pendingError = normalizeWriteError(error);
    } finally {
      try {
        await handle.close();
      } catch (error) {
        pendingError ??= normalizeWriteError(error);
      }
    }

    if (pendingError !== undefined) {
      throw pendingError;
    }

    if (finalStats === undefined) {
      return throwReportWriteError(REPORT_WRITE_ERROR_CODES.writeFailed);
    }

    await reauthorizeDirectories(fileSystem, root.canonicalPath, directories);
    await authorizeTarget(fileSystem, root.canonicalPath, targetPath, finalStats);

    return Object.freeze({
      format: normalized.format,
      relativePath: normalized.relativePath,
    });
  };

export const writeReportFile = createReportFileWriter(nodeFileSystem);

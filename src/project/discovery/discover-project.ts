import {
  lstat as getLinkStats,
  readdir as readDirectory,
  realpath as getRealPath,
  stat as getPathStats,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { compareOrdinal, isPathWithinRoot, toProjectRelativePath } from '../project-paths.js';
import { DEFAULT_DISCOVERY_CONFIGURATION, SYMLINK_POLICIES } from './discovery-config.js';
import {
  DISCOVERY_ENTRY_TYPES,
  DISCOVERY_EXCLUSION_REASONS,
  DISCOVERY_ISSUE_CODES,
  DISCOVERY_OPERATIONS,
  ProjectDiscoveryError,
  type DiscoveredFile,
  type DiscoverProjectFiles,
  type DiscoveryEntryType,
  type DiscoveryExclusion,
  type DiscoveryExclusionReason,
  type DiscoveryIssue,
} from './discovery-types.js';

export interface DiscoveryPathStats {
  readonly isDirectory: () => boolean;
  readonly isFile: () => boolean;
  readonly isSymbolicLink: () => boolean;
}

export interface ProjectDiscoveryFileSystem {
  readonly lstat: (path: string) => Promise<DiscoveryPathStats>;
  readonly readDirectory: (path: string) => Promise<readonly string[]>;
  readonly realpath: (path: string) => Promise<string>;
  readonly stat: (path: string) => Promise<DiscoveryPathStats>;
}

interface DirectoryWorkItem {
  readonly absolutePath: string;
  readonly observedPath: string;
  readonly viaSymlink: boolean;
}

const nodeFileSystem: ProjectDiscoveryFileSystem = {
  lstat: getLinkStats,
  readDirectory: async (path) => readDirectory(path, { encoding: 'utf8' }),
  realpath: getRealPath,
  stat: getPathStats,
};

const getFileSystemErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  return typeof error.code === 'string' ? error.code : undefined;
};

const toIssueCode = (error: unknown): DiscoveryIssue['code'] => {
  const code = getFileSystemErrorCode(error);

  if (code === 'ENOENT' || code === 'ENOTDIR') {
    return DISCOVERY_ISSUE_CODES.entryDisappeared;
  }

  if (code === 'EACCES' || code === 'EPERM' || code === 'ERR_ACCESS_DENIED') {
    return DISCOVERY_ISSUE_CODES.notAccessible;
  }

  return code === 'ELOOP' ? DISCOVERY_ISSUE_CODES.symlinkLoop : DISCOVERY_ISSUE_CODES.ioFailed;
};

const toEntryType = (stats: DiscoveryPathStats): DiscoveryEntryType => {
  if (stats.isSymbolicLink()) {
    return DISCOVERY_ENTRY_TYPES.symbolicLink;
  }

  if (stats.isDirectory()) {
    return DISCOVERY_ENTRY_TYPES.directory;
  }

  return stats.isFile() ? DISCOVERY_ENTRY_TYPES.file : DISCOVERY_ENTRY_TYPES.other;
};

const sortExclusions = (exclusions: DiscoveryExclusion[]): void => {
  exclusions.sort(
    (left, right) =>
      compareOrdinal(left.relativePath, right.relativePath) ||
      compareOrdinal(left.reason, right.reason) ||
      compareOrdinal(left.entryType, right.entryType),
  );
};

const sortIssues = (issues: DiscoveryIssue[]): void => {
  issues.sort(
    (left, right) =>
      compareOrdinal(left.relativePath, right.relativePath) ||
      compareOrdinal(left.operation, right.operation) ||
      compareOrdinal(left.code, right.code),
  );
};

const sortFiles = (files: DiscoveredFile[]): void => {
  files.sort(
    (left, right) =>
      compareOrdinal(left.observedPath, right.observedPath) ||
      compareOrdinal(left.absolutePath, right.absolutePath),
  );
};

const getCanonicalExclusionReason = (
  projectRoot: string,
  canonicalPath: string,
  stats: DiscoveryPathStats,
  excludedDirectoryNames: ReadonlySet<string>,
  excludedFileNames: ReadonlySet<string>,
): DiscoveryExclusionReason | undefined => {
  const relativePath = toProjectRelativePath(projectRoot, canonicalPath);
  const segments = relativePath === '.' ? [] : relativePath.split('/');
  const directorySegments = stats.isDirectory() ? segments : segments.slice(0, -1);

  if (directorySegments.some((segment) => excludedDirectoryNames.has(segment))) {
    return DISCOVERY_EXCLUSION_REASONS.directoryName;
  }

  const fileName = segments.at(-1);

  return stats.isFile() && fileName !== undefined && excludedFileNames.has(fileName)
    ? DISCOVERY_EXCLUSION_REASONS.fileName
    : undefined;
};

const getObservedExclusionReason = (
  name: string,
  stats: DiscoveryPathStats,
  excludedDirectoryNames: ReadonlySet<string>,
  excludedFileNames: ReadonlySet<string>,
): DiscoveryExclusionReason | undefined => {
  if ((stats.isDirectory() || stats.isSymbolicLink()) && excludedDirectoryNames.has(name)) {
    return DISCOVERY_EXCLUSION_REASONS.directoryName;
  }

  return (stats.isFile() || stats.isSymbolicLink()) && excludedFileNames.has(name)
    ? DISCOVERY_EXCLUSION_REASONS.fileName
    : undefined;
};

export const createProjectDiscoverer =
  (fileSystem: ProjectDiscoveryFileSystem): DiscoverProjectFiles =>
  async (projectRoot, configuration = DEFAULT_DISCOVERY_CONFIGURATION) => {
    const authorizedRoot = resolve(projectRoot);
    const excludedDirectoryNames = new Set(configuration.excludedDirectoryNames);
    const excludedFileNames = new Set(configuration.excludedFileNames);
    const exclusions: DiscoveryExclusion[] = [];
    const files: DiscoveredFile[] = [];
    const issues: DiscoveryIssue[] = [];

    let canonicalRoot: string;

    try {
      canonicalRoot = await fileSystem.realpath(authorizedRoot);

      if (
        !isPathWithinRoot(authorizedRoot, canonicalRoot) ||
        !isPathWithinRoot(canonicalRoot, authorizedRoot)
      ) {
        throw new ProjectDiscoveryError();
      }

      const rootStats = await fileSystem.stat(canonicalRoot);

      if (!rootStats.isDirectory()) {
        throw new ProjectDiscoveryError();
      }
    } catch (error) {
      throw error instanceof ProjectDiscoveryError ? error : new ProjectDiscoveryError(error);
    }

    const directories: DirectoryWorkItem[] = [
      {
        absolutePath: canonicalRoot,
        observedPath: canonicalRoot,
        viaSymlink: false,
      },
    ];
    const visitedDirectories = new Set([canonicalRoot]);

    for (const directory of directories) {
      let currentDirectoryPath: string;

      try {
        currentDirectoryPath = await fileSystem.realpath(directory.absolutePath);

        if (
          !isPathWithinRoot(canonicalRoot, currentDirectoryPath) ||
          !isPathWithinRoot(directory.absolutePath, currentDirectoryPath) ||
          !isPathWithinRoot(currentDirectoryPath, directory.absolutePath)
        ) {
          throw new Error('Directory identity changed');
        }

        const currentStats = await fileSystem.stat(currentDirectoryPath);

        if (!currentStats.isDirectory()) {
          throw new Error('Directory identity changed');
        }
      } catch (error) {
        if (directory.absolutePath === canonicalRoot) {
          throw new ProjectDiscoveryError(error);
        }

        issues.push({
          code: toIssueCode(error),
          operation: DISCOVERY_OPERATIONS.inspect,
          recoverable: true,
          relativePath: toProjectRelativePath(canonicalRoot, directory.observedPath),
        });
        continue;
      }

      let names: readonly string[];

      try {
        names = await fileSystem.readDirectory(currentDirectoryPath);
      } catch (error) {
        if (directory.absolutePath === canonicalRoot) {
          throw new ProjectDiscoveryError(error);
        }

        issues.push({
          code: toIssueCode(error),
          operation: DISCOVERY_OPERATIONS.readDirectory,
          recoverable: true,
          relativePath: toProjectRelativePath(canonicalRoot, directory.observedPath),
        });
        continue;
      }

      for (const name of [...names].sort(compareOrdinal)) {
        const operationPath = join(currentDirectoryPath, name);
        const observedPath = join(directory.observedPath, name);
        const relativePath = toProjectRelativePath(canonicalRoot, observedPath);

        let linkStats: DiscoveryPathStats;

        try {
          linkStats = await fileSystem.lstat(operationPath);
        } catch (error) {
          issues.push({
            code: toIssueCode(error),
            operation: DISCOVERY_OPERATIONS.inspect,
            recoverable: true,
            relativePath,
          });
          continue;
        }

        const entryType = toEntryType(linkStats);
        const observedExclusion = getObservedExclusionReason(
          name,
          linkStats,
          excludedDirectoryNames,
          excludedFileNames,
        );

        if (observedExclusion !== undefined) {
          exclusions.push({
            entryType,
            reason: observedExclusion,
            relativePath,
          });
          continue;
        }

        if (
          linkStats.isSymbolicLink() &&
          configuration.symlinkPolicy !== SYMLINK_POLICIES.followWithinRoot
        ) {
          exclusions.push({
            entryType,
            reason: DISCOVERY_EXCLUSION_REASONS.symlinkPolicy,
            relativePath,
          });
          continue;
        }

        let canonicalPath: string;

        try {
          canonicalPath = await fileSystem.realpath(operationPath);
        } catch (error) {
          issues.push({
            code: toIssueCode(error),
            operation: DISCOVERY_OPERATIONS.resolvePath,
            recoverable: true,
            relativePath,
          });
          continue;
        }

        if (!isPathWithinRoot(canonicalRoot, canonicalPath)) {
          exclusions.push({
            entryType,
            reason: DISCOVERY_EXCLUSION_REASONS.outsideRoot,
            relativePath,
          });
          continue;
        }

        let targetStats: DiscoveryPathStats;

        try {
          targetStats = await fileSystem.stat(canonicalPath);
        } catch (error) {
          issues.push({
            code: toIssueCode(error),
            operation: DISCOVERY_OPERATIONS.inspect,
            recoverable: true,
            relativePath,
          });
          continue;
        }

        const canonicalExclusion = getCanonicalExclusionReason(
          canonicalRoot,
          canonicalPath,
          targetStats,
          excludedDirectoryNames,
          excludedFileNames,
        );

        if (canonicalExclusion !== undefined) {
          exclusions.push({
            entryType,
            reason: canonicalExclusion,
            relativePath,
          });
          continue;
        }

        const viaSymlink = directory.viaSymlink || linkStats.isSymbolicLink();

        if (targetStats.isDirectory()) {
          if (visitedDirectories.has(canonicalPath)) {
            exclusions.push({
              entryType,
              reason: DISCOVERY_EXCLUSION_REASONS.alreadyVisited,
              relativePath,
            });
            continue;
          }

          visitedDirectories.add(canonicalPath);
          directories.push({
            absolutePath: canonicalPath,
            observedPath,
            viaSymlink,
          });
          continue;
        }

        if (targetStats.isFile()) {
          files.push({
            absolutePath: canonicalPath,
            observedPath,
            viaSymlink,
          });
          continue;
        }

        exclusions.push({
          entryType,
          reason: DISCOVERY_EXCLUSION_REASONS.unsupportedEntry,
          relativePath,
        });
      }
    }

    sortExclusions(exclusions);
    sortFiles(files);
    sortIssues(issues);

    return {
      exclusions,
      files,
      issues,
      projectRoot: canonicalRoot,
    };
  };

export const discoverProjectFiles = createProjectDiscoverer(nodeFileSystem);

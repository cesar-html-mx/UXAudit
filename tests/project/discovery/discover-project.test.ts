import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix, resolve, win32 } from 'node:path';
import process from 'node:process';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_DISCOVERY_CONFIGURATION,
  SYMLINK_POLICIES,
  type DiscoveryConfiguration,
} from '../../../src/project/discovery/discovery-config.js';
import {
  createProjectDiscoverer,
  discoverProjectFiles,
  type DiscoveryPathStats,
  type ProjectDiscoveryFileSystem,
} from '../../../src/project/discovery/discover-project.js';
import {
  DISCOVERY_ENTRY_TYPES,
  DISCOVERY_EXCLUSION_REASONS,
  DISCOVERY_ISSUE_CODES,
  DISCOVERY_OPERATIONS,
  PROJECT_DISCOVERY_ERROR_CODES,
  ProjectDiscoveryError,
} from '../../../src/project/discovery/discovery-types.js';
import { isPathWithinRoot, toProjectRelativePath } from '../../../src/project/project-paths.js';

const createdDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'uxaudit-discovery-'));
  createdDirectories.push(directory);
  return realpath(directory);
};

const createDirectoryLink = async (target: string, linkPath: string): Promise<void> => {
  await symlink(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
};

const createStats = (
  kind: 'directory' | 'file' | 'other' | 'symbolic-link',
): DiscoveryPathStats => ({
  isDirectory: () => kind === 'directory',
  isFile: () => kind === 'file',
  isSymbolicLink: () => kind === 'symbolic-link',
});

const createFileSystemError = (code: string): Error & { readonly code: string } =>
  Object.assign(new Error('native details must stay hidden'), { code });

const createFakeFileSystem = (
  overrides: Partial<ProjectDiscoveryFileSystem>,
): ProjectDiscoveryFileSystem => ({
  lstat: () => Promise.reject(createFileSystemError('ENOENT')),
  readDirectory: () => Promise.resolve([]),
  realpath: (path) => Promise.resolve(path),
  stat: () => Promise.resolve(createStats('directory')),
  ...overrides,
});

afterEach(async () => {
  await Promise.all(
    createdDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('discoverProjectFiles', () => {
  it('recursively discovers a stable tree while pruning default and configured exclusions', async () => {
    const root = await createTemporaryDirectory();
    await Promise.all([
      mkdir(join(root, 'dist'), { recursive: true }),
      mkdir(join(root, 'ignored'), { recursive: true }),
      mkdir(join(root, 'node_modules', 'dependency'), { recursive: true }),
      mkdir(join(root, 'src', 'nested'), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(root, 'README.md'), '# Fixture\n', 'utf8'),
      writeFile(join(root, 'custom.ignore.ts'), 'ignored file\n', 'utf8'),
      writeFile(join(root, 'dist', 'bundle.js'), 'generated\n', 'utf8'),
      writeFile(join(root, 'ignored', 'hidden.ts'), 'hidden\n', 'utf8'),
      writeFile(join(root, 'node_modules', 'dependency', 'index.js'), 'dependency\n', 'utf8'),
      writeFile(join(root, 'src', 'b.ts'), 'export {};\n', 'utf8'),
      writeFile(join(root, 'src', 'nested', 'a.tsx'), 'export const A = () => null;\n', 'utf8'),
      writeFile(join(root, 'vite.config.ts'), 'export default {};\n', 'utf8'),
    ]);

    const configuration = {
      ...DEFAULT_DISCOVERY_CONFIGURATION,
      excludedDirectoryNames: [
        ...DEFAULT_DISCOVERY_CONFIGURATION.excludedDirectoryNames,
        'ignored',
      ],
      excludedFileNames: [...DEFAULT_DISCOVERY_CONFIGURATION.excludedFileNames, 'custom.ignore.ts'],
    };
    const first = await discoverProjectFiles(root, configuration);
    const second = await discoverProjectFiles(root, configuration);
    const relativeFiles = first.files.map((file) => toProjectRelativePath(root, file.absolutePath));

    expect(relativeFiles).toEqual(['README.md', 'src/b.ts', 'src/nested/a.tsx']);
    expect(first.exclusions).toEqual([
      {
        entryType: DISCOVERY_ENTRY_TYPES.file,
        reason: DISCOVERY_EXCLUSION_REASONS.fileName,
        relativePath: 'custom.ignore.ts',
      },
      {
        entryType: DISCOVERY_ENTRY_TYPES.directory,
        reason: DISCOVERY_EXCLUSION_REASONS.directoryName,
        relativePath: 'dist',
      },
      {
        entryType: DISCOVERY_ENTRY_TYPES.directory,
        reason: DISCOVERY_EXCLUSION_REASONS.directoryName,
        relativePath: 'ignored',
      },
      {
        entryType: DISCOVERY_ENTRY_TYPES.directory,
        reason: DISCOVERY_EXCLUSION_REASONS.directoryName,
        relativePath: 'node_modules',
      },
      {
        entryType: DISCOVERY_ENTRY_TYPES.file,
        reason: DISCOVERY_EXCLUSION_REASONS.fileName,
        relativePath: 'vite.config.ts',
      },
    ]);
    expect(first.issues).toEqual([]);
    expect(second).toEqual(first);
  });

  it('does not follow an internal directory link under the secure default policy', async () => {
    const root = await createTemporaryDirectory();
    const realDirectory = join(root, 'real');
    await mkdir(realDirectory);
    await writeFile(join(realDirectory, 'component.tsx'), 'export {};\n', 'utf8');
    await createDirectoryLink(realDirectory, join(root, 'alias'));

    const result = await discoverProjectFiles(root);
    const invalidPolicyResult = await discoverProjectFiles(root, {
      ...DEFAULT_DISCOVERY_CONFIGURATION,
      symlinkPolicy: 'invalid-runtime-value',
    } as unknown as DiscoveryConfiguration);

    expect(result.files.map((file) => toProjectRelativePath(root, file.absolutePath))).toEqual([
      'real/component.tsx',
    ]);
    expect(result.exclusions).toContainEqual({
      entryType: DISCOVERY_ENTRY_TYPES.symbolicLink,
      reason: DISCOVERY_EXCLUSION_REASONS.symlinkPolicy,
      relativePath: 'alias',
    });
    expect(invalidPolicyResult).toEqual(result);
  });

  it('follows only internal links, prevents cycles, and records broken or external links', async () => {
    const root = resolve('virtual-project');
    const outside = resolve('outside-project');
    const alias = join(root, 'alias');
    const broken = join(root, 'broken');
    const dependencyAlias = join(root, 'dependency-alias');
    const dependencyTarget = join(root, 'node_modules', 'dependency');
    const external = join(root, 'external');
    const nativeLoop = join(root, 'native-loop');
    const source = join(root, 'src');
    const cycle = join(source, 'cycle');
    const sourceFile = join(source, 'component.tsx');
    const directories = new Map<string, readonly string[]>([
      [root, ['src', 'native-loop', 'external', 'dependency-alias', 'broken', 'alias']],
      [source, ['component.tsx', 'cycle']],
    ]);
    const linkPaths = new Set([alias, broken, dependencyAlias, external, nativeLoop, cycle]);
    const canonicalPaths = new Map<string, string>([
      [root, root],
      [alias, source],
      [dependencyAlias, dependencyTarget],
      [external, outside],
      [source, source],
      [cycle, root],
      [sourceFile, sourceFile],
    ]);
    const stats = new Map<string, DiscoveryPathStats>([
      [root, createStats('directory')],
      [source, createStats('directory')],
      [dependencyTarget, createStats('directory')],
      [sourceFile, createStats('file')],
    ]);
    const fileSystem = createFakeFileSystem({
      lstat: (path) => {
        if (linkPaths.has(path)) {
          return Promise.resolve(createStats('symbolic-link'));
        }

        const value = stats.get(path);
        return value === undefined
          ? Promise.reject(createFileSystemError('ENOENT'))
          : Promise.resolve(value);
      },
      readDirectory: (path) => Promise.resolve(directories.get(path) ?? []),
      realpath: (path) => {
        if (path === broken || path === nativeLoop) {
          return Promise.reject(createFileSystemError(path === nativeLoop ? 'ELOOP' : 'ENOENT'));
        }

        return Promise.resolve(canonicalPaths.get(path) ?? path);
      },
      stat: (path) => {
        const value = stats.get(path);
        return value === undefined
          ? Promise.reject(createFileSystemError('ENOENT'))
          : Promise.resolve(value);
      },
    });
    const discover = createProjectDiscoverer(fileSystem);

    const result = await discover(root, {
      ...DEFAULT_DISCOVERY_CONFIGURATION,
      symlinkPolicy: SYMLINK_POLICIES.followWithinRoot,
    });

    expect(result.files).toEqual([
      {
        absolutePath: sourceFile,
        observedPath: join(alias, 'component.tsx'),
        viaSymlink: true,
      },
    ]);
    expect(result.exclusions).toEqual([
      {
        entryType: DISCOVERY_ENTRY_TYPES.symbolicLink,
        reason: DISCOVERY_EXCLUSION_REASONS.alreadyVisited,
        relativePath: 'alias/cycle',
      },
      {
        entryType: DISCOVERY_ENTRY_TYPES.symbolicLink,
        reason: DISCOVERY_EXCLUSION_REASONS.directoryName,
        relativePath: 'dependency-alias',
      },
      {
        entryType: DISCOVERY_ENTRY_TYPES.symbolicLink,
        reason: DISCOVERY_EXCLUSION_REASONS.outsideRoot,
        relativePath: 'external',
      },
      {
        entryType: DISCOVERY_ENTRY_TYPES.directory,
        reason: DISCOVERY_EXCLUSION_REASONS.alreadyVisited,
        relativePath: 'src',
      },
    ]);
    expect(result.issues).toEqual([
      {
        code: DISCOVERY_ISSUE_CODES.entryDisappeared,
        operation: DISCOVERY_OPERATIONS.resolvePath,
        recoverable: true,
        relativePath: 'broken',
      },
      {
        code: DISCOVERY_ISSUE_CODES.symlinkLoop,
        operation: DISCOVERY_OPERATIONS.resolvePath,
        recoverable: true,
        relativePath: 'native-loop',
      },
    ]);
  });

  it('records a descendant directory failure and continues with its siblings', async () => {
    const root = resolve('virtual-project');
    const inaccessible = join(root, 'inaccessible');
    const readable = join(root, 'readable');
    const sourceFile = join(readable, 'index.ts');
    const stats = new Map<string, DiscoveryPathStats>([
      [root, createStats('directory')],
      [inaccessible, createStats('directory')],
      [readable, createStats('directory')],
      [sourceFile, createStats('file')],
    ]);
    const fileSystem = createFakeFileSystem({
      lstat: (path) => Promise.resolve(stats.get(path) ?? createStats('other')),
      readDirectory: (path) => {
        if (path === root) {
          return Promise.resolve(['readable', 'inaccessible']);
        }

        if (path === inaccessible) {
          return Promise.reject(createFileSystemError('EACCES'));
        }

        return Promise.resolve(path === readable ? ['index.ts'] : []);
      },
      stat: (path) => Promise.resolve(stats.get(path) ?? createStats('other')),
    });
    const discover = createProjectDiscoverer(fileSystem);

    const result = await discover(root);

    expect(result.files).toEqual([
      {
        absolutePath: sourceFile,
        observedPath: sourceFile,
        viaSymlink: false,
      },
    ]);
    expect(result.issues).toEqual([
      {
        code: DISCOVERY_ISSUE_CODES.notAccessible,
        operation: DISCOVERY_OPERATIONS.readDirectory,
        recoverable: true,
        relativePath: 'inaccessible',
      },
    ]);
  });

  it('isolates entry races, target failures, and unsupported filesystem entries', async () => {
    const root = resolve('virtual-project');
    const missing = join(root, 'missing');
    const special = join(root, 'special');
    const statusFailure = join(root, 'status-failure');
    const fileSystem = createFakeFileSystem({
      lstat: (path) => {
        if (path === missing) {
          return Promise.reject(createFileSystemError('ENOENT'));
        }

        return Promise.resolve(createStats(path === special ? 'other' : 'file'));
      },
      readDirectory: (path) =>
        Promise.resolve(path === root ? ['status-failure', 'special', 'missing'] : []),
      stat: (path) =>
        path === statusFailure
          ? Promise.reject(new Error('unclassified status failure'))
          : Promise.resolve(path === special ? createStats('other') : createStats('directory')),
    });
    const discover = createProjectDiscoverer(fileSystem);

    const result = await discover(root);

    expect(result.files).toEqual([]);
    expect(result.exclusions).toEqual([
      {
        entryType: DISCOVERY_ENTRY_TYPES.other,
        reason: DISCOVERY_EXCLUSION_REASONS.unsupportedEntry,
        relativePath: 'special',
      },
    ]);
    expect(result.issues).toEqual([
      {
        code: DISCOVERY_ISSUE_CODES.entryDisappeared,
        operation: DISCOVERY_OPERATIONS.inspect,
        recoverable: true,
        relativePath: 'missing',
      },
      {
        code: DISCOVERY_ISSUE_CODES.ioFailed,
        operation: DISCOVERY_OPERATIONS.inspect,
        recoverable: true,
        relativePath: 'status-failure',
      },
    ]);
  });

  it('rejects a descendant whose canonical identity changes before enumeration', async () => {
    const root = resolve('virtual-project');
    const stale = join(root, 'stale');
    let staleResolutionCount = 0;
    const fileSystem = createFakeFileSystem({
      lstat: () => Promise.resolve(createStats('directory')),
      readDirectory: (path) => Promise.resolve(path === root ? ['stale'] : []),
      realpath: (path) => {
        if (path === stale) {
          staleResolutionCount += 1;

          if (staleResolutionCount > 1) {
            return Promise.reject(createFileSystemError('ENOTDIR'));
          }
        }

        return Promise.resolve(path);
      },
    });
    const discover = createProjectDiscoverer(fileSystem);

    const result = await discover(root);

    expect(result.files).toEqual([]);
    expect(result.issues).toEqual([
      {
        code: DISCOVERY_ISSUE_CODES.entryDisappeared,
        operation: DISCOVERY_OPERATIONS.inspect,
        recoverable: true,
        relativePath: 'stale',
      },
    ]);
  });

  it('checks a retargeted directory before inspecting metadata outside the root', async () => {
    const root = resolve('virtual-project');
    const child = join(root, 'child');
    const outside = resolve('outside-project');
    const inspectedPaths: string[] = [];
    let childResolutionCount = 0;
    const fileSystem = createFakeFileSystem({
      lstat: () => Promise.resolve(createStats('directory')),
      readDirectory: (path) => Promise.resolve(path === root ? ['child'] : []),
      realpath: (path) => {
        if (path === child) {
          childResolutionCount += 1;
          return Promise.resolve(childResolutionCount === 1 ? child : outside);
        }

        return Promise.resolve(path);
      },
      stat: (path) => {
        inspectedPaths.push(path);
        return Promise.resolve(createStats('directory'));
      },
    });
    const discover = createProjectDiscoverer(fileSystem);

    const result = await discover(root);

    expect(result.issues).toEqual([
      {
        code: DISCOVERY_ISSUE_CODES.ioFailed,
        operation: DISCOVERY_OPERATIONS.inspect,
        recoverable: true,
        relativePath: 'child',
      },
    ]);
    expect(inspectedPaths).not.toContain(outside);
  });

  it('treats an unreadable authorized root as a typed fatal error', async () => {
    const root = resolve('virtual-project');
    const nativeError = createFileSystemError('EACCES');
    const discover = createProjectDiscoverer(
      createFakeFileSystem({
        readDirectory: () => Promise.reject(nativeError),
      }),
    );

    try {
      await discover(root);
      throw new Error('Expected project discovery to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectDiscoveryError);
      expect(error).toMatchObject({
        cause: nativeError,
        code: PROJECT_DISCOVERY_ERROR_CODES.rootUnavailable,
        message: 'Project root could not be traversed.',
      });
    }
  });

  it('rejects a root that is no longer a directory without wrapping its typed error', async () => {
    const root = resolve('virtual-project');
    const discover = createProjectDiscoverer(
      createFakeFileSystem({
        stat: () => Promise.resolve(createStats('file')),
      }),
    );

    await expect(discover(root)).rejects.toMatchObject({
      code: PROJECT_DISCOVERY_ERROR_CODES.rootUnavailable,
      message: 'Project root could not be traversed.',
    });
  });

  it('fails if the root changes type between validation and enumeration', async () => {
    const root = resolve('virtual-project');
    let statCount = 0;
    const discover = createProjectDiscoverer(
      createFakeFileSystem({
        stat: () => {
          statCount += 1;
          return Promise.resolve(createStats(statCount === 1 ? 'directory' : 'file'));
        },
      }),
    );

    await expect(discover(root)).rejects.toMatchObject({
      code: PROJECT_DISCOVERY_ERROR_CODES.rootUnavailable,
      message: 'Project root could not be traversed.',
    });
  });

  it('wraps a native failure while revalidating the authorized root', async () => {
    const root = resolve('virtual-project');
    const nativeError = createFileSystemError('ENOENT');
    const discover = createProjectDiscoverer(
      createFakeFileSystem({
        realpath: () => Promise.reject(nativeError),
      }),
    );

    await expect(discover(root)).rejects.toMatchObject({
      cause: nativeError,
      code: PROJECT_DISCOVERY_ERROR_CODES.rootUnavailable,
    });
  });
});

describe('project path containment', () => {
  it('rejects sibling prefixes and accepts the root and real descendants', () => {
    expect(isPathWithinRoot('/project', '/project', posix)).toBe(true);
    expect(isPathWithinRoot('/project', '/project/src/file.ts', posix)).toBe(true);
    expect(isPathWithinRoot('/project', '/project-evil/file.ts', posix)).toBe(false);
    expect(isPathWithinRoot('/project', '/outside/file.ts', posix)).toBe(false);
  });

  it('rejects another Windows drive and preserves portable relative separators', () => {
    expect(isPathWithinRoot('C:\\project', 'C:\\project\\src\\file.ts', win32)).toBe(true);
    expect(isPathWithinRoot('C:\\project', 'C:\\project-evil\\file.ts', win32)).toBe(false);
    expect(isPathWithinRoot('C:\\project', 'D:\\project\\file.ts', win32)).toBe(false);
    expect(toProjectRelativePath('C:\\project', 'C:\\project\\src\\file.ts', win32)).toBe(
      'src/file.ts',
    );
  });
});

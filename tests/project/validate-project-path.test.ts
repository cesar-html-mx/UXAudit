import { constants as fileSystemConstants } from 'node:fs';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  PROJECT_PATH_ERROR_CODES,
  ProjectPathError,
  createProjectPathValidator,
  validateProjectPath,
  type ProjectPathFileSystem,
  type ProjectPathStats,
} from '../../src/project/validate-project-path.js';

const createdDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'uxaudit-project-path-'));
  createdDirectories.push(directory);
  return directory;
};

const directoryStats: ProjectPathStats = {
  isDirectory: () => true,
};

const createFileSystem = (
  overrides: Partial<ProjectPathFileSystem> = {},
): ProjectPathFileSystem => ({
  access: () => Promise.resolve(),
  realpath: () => Promise.resolve('/canonical/project'),
  stat: () => Promise.resolve(directoryStats),
  ...overrides,
});

const createFileSystemError = (code: unknown): Error & { readonly code: unknown } =>
  Object.assign(new Error('native details must stay hidden'), { code });

afterEach(async () => {
  await Promise.all(
    createdDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('validateProjectPath', () => {
  it('returns the canonical path for an accessible directory', async () => {
    const directory = await createTemporaryDirectory();

    await expect(validateProjectPath(directory)).resolves.toBe(await realpath(directory));
  });

  it('rejects an empty or whitespace-only path before file-system access', async () => {
    let accessed = false;
    const validate = createProjectPathValidator(
      createFileSystem({
        realpath: () => {
          accessed = true;
          return Promise.resolve('/unexpected');
        },
      }),
    );

    await expect(validate(' \t ')).rejects.toMatchObject({
      code: PROJECT_PATH_ERROR_CODES.empty,
      message: 'Project path is required.',
    });
    expect(accessed).toBe(false);
  });

  it('rejects a missing path with a typed error', async () => {
    const directory = await createTemporaryDirectory();

    await expect(validateProjectPath(join(directory, 'missing'))).rejects.toMatchObject({
      code: PROJECT_PATH_ERROR_CODES.notFound,
      message: 'Project path does not exist.',
    });
  });

  it('rejects a regular file', async () => {
    const directory = await createTemporaryDirectory();
    const filePath = join(directory, 'package.json');
    await writeFile(filePath, '{}\n', 'utf8');

    await expect(validateProjectPath(filePath)).rejects.toMatchObject({
      code: PROJECT_PATH_ERROR_CODES.notDirectory,
      message: 'Project path must reference a directory.',
    });
  });

  it('checks the canonical directory with read and search access modes', async () => {
    const calls: (readonly [string, number])[] = [];
    const validate = createProjectPathValidator(
      createFileSystem({
        access: (path, mode) => {
          calls.push([path, mode]);
          return Promise.resolve();
        },
        realpath: (path) => {
          expect(path).toBe(resolve('relative-project'));
          return Promise.resolve('/canonical/project');
        },
      }),
    );

    await expect(validate('relative-project')).resolves.toBe('/canonical/project');
    expect(calls).toEqual([
      ['/canonical/project', fileSystemConstants.R_OK | fileSystemConstants.X_OK],
    ]);
  });

  it.each(['EACCES', 'EPERM', 'ERR_ACCESS_DENIED'])(
    'maps %s access failures without exposing native details',
    async (code) => {
      const nativeError = createFileSystemError(code);
      const validate = createProjectPathValidator(
        createFileSystem({
          access: () => Promise.reject(nativeError),
        }),
      );

      const rejection = validate('project');

      await expect(rejection).rejects.toMatchObject({
        code: PROJECT_PATH_ERROR_CODES.notAccessible,
        message: 'Project path cannot be accessed.',
      });
      await expect(rejection).rejects.toHaveProperty('cause', nativeError);
    },
  );

  it('maps access denial while resolving the canonical root', async () => {
    const validate = createProjectPathValidator(
      createFileSystem({
        realpath: () => Promise.reject(createFileSystemError('EACCES')),
      }),
    );

    await expect(validate('project')).rejects.toMatchObject({
      code: PROJECT_PATH_ERROR_CODES.notAccessible,
      message: 'Project path cannot be accessed.',
    });
  });

  it.each(['ENOENT', 'ENOTDIR'])('maps %s races to a not-found error', async (code) => {
    const validate = createProjectPathValidator(
      createFileSystem({
        stat: () => Promise.reject(createFileSystemError(code)),
      }),
    );

    await expect(validate('project')).rejects.toMatchObject({
      code: PROJECT_PATH_ERROR_CODES.notFound,
      message: 'Project path does not exist.',
    });
  });

  it.each([new Error('failure without a code'), createFileSystemError(123)])(
    'maps unknown validation failures to a stable typed error',
    async (nativeError) => {
      const validate = createProjectPathValidator(
        createFileSystem({
          realpath: () => Promise.reject(nativeError),
        }),
      );

      try {
        await validate('project');
        throw new Error('Expected validation to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(ProjectPathError);
        expect(error).toMatchObject({
          cause: nativeError,
          code: PROJECT_PATH_ERROR_CODES.validationFailed,
          message: 'Project path could not be validated.',
        });
      }
    },
  );
});

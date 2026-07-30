import { constants as fileSystemConstants } from 'node:fs';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CONFIGURATION_ERROR_CODES,
  CONFIGURATION_FILE_NAME,
  ConfigurationError,
} from '../../src/configuration/configuration.js';
import {
  CONFIGURATION_READ_CHUNK_BYTES,
  MAX_CONFIGURATION_FILE_BYTES,
  createConfigurationFileReader,
  readConfigurationFile,
  type ConfigurationFileStats,
  type ConfigurationReaderFileHandle,
  type ConfigurationReaderFileSystem,
} from '../../src/configuration/read-configuration-file.js';

const projectRoot = resolve(tmpdir(), 'uxaudit-configuration-reader-project');
const defaultPath = join(projectRoot, CONFIGURATION_FILE_NAME);
const externalPath = resolve(projectRoot, '..', 'uxaudit-configuration-reader-external.json');
const defaultBytes = new TextEncoder().encode('{"color":false}\n');

type StatsType = 'directory' | 'file' | 'other';

interface StatsOptions {
  readonly ctimeNs?: bigint;
  readonly dev?: bigint;
  readonly ino?: bigint;
  readonly mtimeNs?: bigint;
  readonly size?: bigint;
  readonly type?: StatsType;
}

const createStats = ({
  ctimeNs = 20n,
  dev = 2n,
  ino = 3n,
  mtimeNs = 10n,
  size = BigInt(defaultBytes.byteLength),
  type = 'file',
}: StatsOptions = {}): ConfigurationFileStats => ({
  ctimeNs,
  dev,
  ino,
  isDirectory: () => type === 'directory',
  isFile: () => type === 'file',
  mtimeNs,
  size,
});

const rootStats = createStats({
  dev: 1n,
  ino: 1n,
  size: 0n,
  type: 'directory',
});

type SequenceValue<Value> = Error | Value;

interface ReadRequest {
  readonly length: number;
  readonly offset: number;
  readonly position: number;
}

interface FakeReaderOptions {
  readonly bytes?: Uint8Array;
  readonly closeError?: Error;
  readonly fileRealpaths?: readonly SequenceValue<string>[];
  readonly handleStats?: readonly SequenceValue<ConfigurationFileStats>[];
  readonly linkStats?: readonly SequenceValue<ConfigurationFileStats>[];
  readonly openError?: Error;
  readonly pathStats?: readonly SequenceValue<ConfigurationFileStats>[];
  readonly read?: ConfigurationReaderFileHandle['read'];
  readonly rootRealpaths?: readonly SequenceValue<string>[];
  readonly rootStats?: readonly SequenceValue<ConfigurationFileStats>[];
}

interface FakeReader {
  readonly closeCalls: number;
  readonly fileSystem: ConfigurationReaderFileSystem;
  readonly openFlags: readonly number[];
  readonly openPaths: readonly string[];
  readonly operations: readonly string[];
  readonly readRequests: readonly ReadRequest[];
}

const createFileSystemError = (code: string): Error & { readonly code: string } =>
  Object.assign(new Error('PRIVATE_NATIVE_DETAIL /Users/owner/secret'), { code });

const fromSequence = <Value>(
  sequence: readonly SequenceValue<Value>[] | undefined,
  index: number,
  fallback: Value,
): Promise<Value> => {
  const value =
    sequence === undefined || sequence.length === 0
      ? fallback
      : (sequence[index] ?? sequence.at(-1) ?? fallback);

  return value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
};

const createFakeReader = (options: FakeReaderOptions = {}): FakeReader => {
  const bytes = options.bytes ?? defaultBytes;
  const defaultFileStats = createStats({ size: BigInt(bytes.byteLength) });
  const openFlags: number[] = [];
  const openPaths: string[] = [];
  const operations: string[] = [];
  const readRequests: ReadRequest[] = [];
  let closeCalls = 0;
  let fileRealpathCalls = 0;
  let handleStatCalls = 0;
  let linkStatCalls = 0;
  let pathStatCalls = 0;
  let rootRealpathCalls = 0;
  let rootStatCalls = 0;

  const handle: ConfigurationReaderFileHandle = {
    close: () => {
      operations.push('close');
      closeCalls += 1;

      return options.closeError === undefined
        ? Promise.resolve()
        : Promise.reject(options.closeError);
    },
    read: async (buffer, offset, length, position) => {
      operations.push(`read:${String(position)}:${String(length)}`);
      readRequests.push({
        length,
        offset,
        position,
      });

      if (options.read !== undefined) {
        return await options.read(buffer, offset, length, position);
      }

      const available = bytes.subarray(position, Math.min(position + length, bytes.byteLength));

      buffer.set(available, offset);

      return {
        bytesRead: available.byteLength,
      };
    },
    stat: () => {
      operations.push('fstat');
      const index = handleStatCalls;

      handleStatCalls += 1;
      return fromSequence(options.handleStats, index, defaultFileStats);
    },
  };

  const fileSystem: ConfigurationReaderFileSystem = {
    lstat: (path) => {
      operations.push(`lstat:${path}`);
      const index = linkStatCalls;

      linkStatCalls += 1;
      return fromSequence(options.linkStats, index, defaultFileStats);
    },
    open: (path, flags) => {
      operations.push(`open:${path}`);
      openPaths.push(path);
      openFlags.push(flags);

      return options.openError === undefined
        ? Promise.resolve(handle)
        : Promise.reject(options.openError);
    },
    realpath: (path) => {
      operations.push(`realpath:${path}`);

      if (path === projectRoot) {
        const index = rootRealpathCalls;

        rootRealpathCalls += 1;
        return fromSequence(options.rootRealpaths, index, projectRoot);
      }

      const index = fileRealpathCalls;

      fileRealpathCalls += 1;
      return fromSequence(options.fileRealpaths, index, path);
    },
    stat: (path) => {
      operations.push(`stat:${path}`);

      if (path === projectRoot) {
        const index = rootStatCalls;

        rootStatCalls += 1;
        return fromSequence(options.rootStats, index, rootStats);
      }

      const index = pathStatCalls;

      pathStatCalls += 1;
      return fromSequence(options.pathStats, index, defaultFileStats);
    },
  };

  return {
    get closeCalls() {
      return closeCalls;
    },
    fileSystem,
    openFlags,
    openPaths,
    operations,
    readRequests,
  };
};

const readWith = async (
  fake: FakeReader,
  request: {
    readonly configurationPath?: string;
    readonly projectRoot: string;
  } = { projectRoot },
  platform: NodeJS.Platform = 'linux',
) => createConfigurationFileReader(fake.fileSystem, platform)(request);

const createdDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'uxaudit-configuration-reader-'));

  createdDirectories.push(directory);
  return await realpath(directory);
};

afterEach(async () => {
  await Promise.all(
    createdDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('read configuration file', () => {
  it('returns null only when the conventional file is absent from the canonical root', async () => {
    const temporaryRoot = await createTemporaryDirectory();

    await expect(readConfigurationFile({ projectRoot: temporaryRoot })).resolves.toBeNull();
  });

  it('does not treat a missing conventional file as absent after the root identity changes', async () => {
    const fake = createFakeReader({
      linkStats: [createFileSystemError('ENOENT')],
      rootStats: [rootStats, createStats({ dev: 1n, ino: 9n, size: 0n, type: 'directory' })],
    });

    await expect(readWith(fake)).rejects.toMatchObject({
      code: CONFIGURATION_ERROR_CODES.unsafePath,
    });
  });

  it('reads the conventional file and accepts one initial UTF-8 BOM', async () => {
    const temporaryRoot = await createTemporaryDirectory();
    const configurationPath = join(temporaryRoot, CONFIGURATION_FILE_NAME);

    await writeFile(
      configurationPath,
      new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('{"color":false}')]),
    );

    await expect(readConfigurationFile({ projectRoot: temporaryRoot })).resolves.toBe(
      '{"color":false}',
    );
  });

  it('allows a user-selected regular file outside the project root', async () => {
    const temporaryRoot = await createTemporaryDirectory();
    const externalDirectory = await createTemporaryDirectory();
    const configurationPath = join(externalDirectory, 'custom.json');

    await writeFile(configurationPath, '{"verbose":true}\n', 'utf8');

    await expect(
      readConfigurationFile({
        configurationPath,
        projectRoot: temporaryRoot,
      }),
    ).resolves.toBe('{"verbose":true}\n');
  });

  it('distinguishes an explicitly missing file from an absent default', async () => {
    const fake = createFakeReader({
      linkStats: [createFileSystemError('ENOENT')],
    });

    await expect(
      readWith(fake, {
        configurationPath: externalPath,
        projectRoot,
      }),
    ).rejects.toMatchObject({
      code: CONFIGURATION_ERROR_CODES.explicitFileNotFound,
      message: 'The explicitly selected configuration file does not exist.',
    });
  });

  it.each([createStats({ type: 'directory' }), createStats({ type: 'other' })])(
    'rejects a symlink or other non-regular path before opening it',
    async (stats) => {
      const fake = createFakeReader({
        linkStats: [stats],
      });

      await expect(readWith(fake)).rejects.toMatchObject({
        code: CONFIGURATION_ERROR_CODES.fileNotRegular,
      });
      expect(fake.openPaths).toEqual([]);
    },
  );

  it('rejects a default path whose canonical target escapes the canonical root', async () => {
    const fake = createFakeReader({
      fileRealpaths: [externalPath],
    });

    await expect(readWith(fake)).rejects.toMatchObject({
      code: CONFIGURATION_ERROR_CODES.unsafePath,
    });
    expect(fake.openPaths).toEqual([]);
  });

  it('does not apply default-root containment to an explicit canonical target', async () => {
    const fake = createFakeReader({
      fileRealpaths: [externalPath],
    });

    await expect(
      readWith(fake, {
        configurationPath: externalPath,
        projectRoot,
      }),
    ).resolves.toBe(new TextDecoder().decode(defaultBytes));
    expect(fake.openPaths).toEqual([externalPath]);
  });

  it('rejects a noncanonical project root before checking the default file', async () => {
    const fake = createFakeReader({
      rootRealpaths: [resolve(projectRoot, '..', 'replacement')],
    });

    await expect(readWith(fake)).rejects.toMatchObject({
      code: CONFIGURATION_ERROR_CODES.unsafePath,
    });
    expect(fake.operations).not.toContain(`lstat:${defaultPath}`);
  });

  it('rejects a default read when the canonical project-root identity changes', async () => {
    const fake = createFakeReader({
      rootStats: [rootStats, createStats({ dev: 1n, ino: 9n, size: 0n, type: 'directory' })],
    });

    await expect(readWith(fake)).rejects.toMatchObject({
      code: CONFIGURATION_ERROR_CODES.unsafePath,
    });
    expect(fake.openPaths).toEqual([]);
  });

  it('accepts exactly 64 KiB and bounds every descriptor request to 64 KiB', async () => {
    const bytes = new Uint8Array(MAX_CONFIGURATION_FILE_BYTES);

    bytes.fill(0x61);
    const fake = createFakeReader({ bytes });

    await expect(readWith(fake)).resolves.toHaveLength(MAX_CONFIGURATION_FILE_BYTES);
    expect(fake.readRequests).toEqual([
      {
        length: CONFIGURATION_READ_CHUNK_BYTES,
        offset: 0,
        position: 0,
      },
      {
        length: 1,
        offset: MAX_CONFIGURATION_FILE_BYTES,
        position: MAX_CONFIGURATION_FILE_BYTES,
      },
    ]);
    expect(fake.closeCalls).toBe(1);
  });

  it('rejects a file declared larger than 64 KiB before open', async () => {
    const fake = createFakeReader({
      linkStats: [
        createStats({
          size: BigInt(MAX_CONFIGURATION_FILE_BYTES) + 1n,
        }),
      ],
    });

    await expect(readWith(fake)).rejects.toMatchObject({
      code: CONFIGURATION_ERROR_CODES.fileTooLarge,
    });
    expect(fake.openPaths).toEqual([]);
  });

  it('detects growth beyond 64 KiB through one bounded extra-byte read', async () => {
    const bytes = new Uint8Array(MAX_CONFIGURATION_FILE_BYTES + 1);
    const maximumStats = createStats({
      size: BigInt(MAX_CONFIGURATION_FILE_BYTES),
    });
    const fake = createFakeReader({
      bytes,
      handleStats: [maximumStats],
      linkStats: [maximumStats, maximumStats],
      pathStats: [maximumStats, maximumStats],
    });

    await expect(readWith(fake)).rejects.toMatchObject({
      code: CONFIGURATION_ERROR_CODES.fileTooLarge,
    });
    expect(fake.readRequests.every(({ length }) => length <= CONFIGURATION_READ_CHUNK_BYTES)).toBe(
      true,
    );
    expect(fake.closeCalls).toBe(1);
  });

  it('strictly rejects malformed UTF-8 without retaining native or byte detail', async () => {
    const fake = createFakeReader({
      bytes: new Uint8Array([0xc3, 0x28]),
    });

    await expect(readWith(fake)).rejects.toMatchObject({
      code: CONFIGURATION_ERROR_CODES.fileInvalidEncoding,
      message: 'The configuration file is not valid UTF-8.',
    });
    expect(fake.closeCalls).toBe(1);
  });

  it('detects a descriptor snapshot change after reading', async () => {
    const fake = createFakeReader({
      handleStats: [createStats(), createStats({ mtimeNs: 11n })],
    });

    await expect(readWith(fake)).rejects.toMatchObject({
      code: CONFIGURATION_ERROR_CODES.fileReadFailed,
    });
    expect(fake.closeCalls).toBe(1);
  });

  it.each([-1, CONFIGURATION_READ_CHUNK_BYTES + 1, 1.5, Number.NaN])(
    'rejects an invalid descriptor byte count: %s',
    async (bytesRead) => {
      const fake = createFakeReader({
        read: () => Promise.resolve({ bytesRead }),
      });

      await expect(readWith(fake)).rejects.toMatchObject({
        code: CONFIGURATION_ERROR_CODES.fileReadFailed,
      });
      expect(fake.closeCalls).toBe(1);
    },
  );

  it('uses no-follow and non-blocking flags on POSIX and portable read-only on Windows', async () => {
    const posixFake = createFakeReader();
    const windowsFake = createFakeReader();

    await readWith(posixFake);
    await readWith(windowsFake, { projectRoot }, 'win32');

    expect(posixFake.openFlags).toEqual([
      fileSystemConstants.O_RDONLY |
        fileSystemConstants.O_NOFOLLOW |
        fileSystemConstants.O_NONBLOCK,
    ]);
    expect(windowsFake.openFlags).toEqual([fileSystemConstants.O_RDONLY]);
  });

  it('normalizes native failures without exposing a cause or private detail', async () => {
    const fake = createFakeReader({
      openError: createFileSystemError('EACCES'),
    });
    let thrown: unknown;

    try {
      await readWith(fake);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConfigurationError);
    expect(thrown).toMatchObject({
      code: CONFIGURATION_ERROR_CODES.fileReadFailed,
      message: 'The configuration file could not be read.',
    });
    expect((thrown as Error).cause).toBeUndefined();
    expect(Object.keys(thrown as object)).not.toContain('cause');
    expect(JSON.stringify(thrown)).not.toContain('PRIVATE_NATIVE_DETAIL');
    expect(JSON.stringify(thrown)).not.toContain('/Users/owner/secret');
  });

  it('does not invoke hostile native-error accessors or proxy traps while normalizing', async () => {
    const codeGetter = vi.fn(() => 'EACCES');
    const trap = vi.fn(() => {
      throw new Error('HOSTILE_ERROR_TRAP');
    });
    const accessorError = new Error('PRIVATE_ACCESSOR_DETAIL');
    const proxyError = new Proxy(new Error('PRIVATE_PROXY_DETAIL'), {
      getOwnPropertyDescriptor: trap,
      getPrototypeOf: trap,
      has: trap,
    });

    Object.defineProperty(accessorError, 'code', {
      configurable: true,
      get: codeGetter,
    });

    await expect(readWith(createFakeReader({ openError: accessorError }))).rejects.toMatchObject({
      code: CONFIGURATION_ERROR_CODES.fileReadFailed,
    });
    await expect(readWith(createFakeReader({ openError: proxyError }))).rejects.toMatchObject({
      code: CONFIGURATION_ERROR_CODES.fileReadFailed,
    });
    expect(codeGetter).not.toHaveBeenCalled();
    expect(trap).not.toHaveBeenCalled();
  });

  it('lets a close failure block success and still closes exactly once', async () => {
    const fake = createFakeReader({
      closeError: createFileSystemError('EIO'),
    });

    await expect(readWith(fake)).rejects.toMatchObject({
      code: CONFIGURATION_ERROR_CODES.fileReadFailed,
    });
    expect(fake.closeCalls).toBe(1);
  });
});

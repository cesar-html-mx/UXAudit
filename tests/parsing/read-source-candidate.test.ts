import { constants as fileSystemConstants } from 'node:fs';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  MAX_SOURCE_FILE_BYTES,
  SOURCE_READ_CHUNK_BYTES,
  SOURCE_ROOT_AUTHORIZATION_ERROR_CODES,
  SourceCandidateReadInvariantError,
  SourceRootAuthorizationError,
  createSourceCandidateReader,
  type SourceFileStats,
  type SourceReaderFileHandle,
  type SourceReaderFileSystem,
} from '../../src/parsing/read-source-candidate.js';
import { SOURCE_PARSER_ERROR_CODES } from '../../src/parsing/parser-contracts.js';
import {
  SOURCE_KINDS,
  type SourceCandidate,
} from '../../src/project/classification/source-candidate.js';

const projectRoot = resolve(tmpdir(), 'uxaudit-reader-project');
const absolutePath = join(projectRoot, 'src', 'App.tsx');
const externalPath = resolve(projectRoot, '..', 'uxaudit-reader-external', 'App.tsx');
const replacementRoot = resolve(projectRoot, '..', 'uxaudit-reader-replacement');
const relativePath = 'src/App.tsx';
const defaultBytes = new TextEncoder().encode('export const App = () => <main />;\n');

const candidate: SourceCandidate = {
  absolutePath,
  extension: '.tsx',
  kind: 'file',
  relativePath,
  sourceKind: SOURCE_KINDS.typescriptJsx,
};

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
}: StatsOptions = {}): SourceFileStats => ({
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

type SequenceValue<T> = Error | T;

interface ReadRequest {
  readonly length: number;
  readonly offset: number;
  readonly position: number;
}

interface FakeReaderOptions {
  readonly bytes?: Uint8Array;
  readonly closeError?: Error;
  readonly fileRealpaths?: readonly SequenceValue<string>[];
  readonly handleStats?: readonly SequenceValue<SourceFileStats>[];
  readonly linkStats?: readonly SequenceValue<SourceFileStats>[];
  readonly openError?: Error;
  readonly pathStats?: readonly SequenceValue<SourceFileStats>[];
  readonly read?: (
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number,
  ) => Promise<{ readonly bytesRead: number }>;
  readonly rootRealpaths?: readonly SequenceValue<string>[];
  readonly rootStats?: readonly SequenceValue<SourceFileStats>[];
}

interface FakeReader {
  readonly closeCalls: number;
  readonly fileSystem: SourceReaderFileSystem;
  readonly openFlags: readonly number[];
  readonly operations: readonly string[];
  readonly readRequests: readonly ReadRequest[];
}

const createFileSystemError = (
  code: string,
  message = 'PRIVATE_NATIVE_DETAIL /Users/owner/secret',
): Error & { readonly code: string } => Object.assign(new Error(message), { code });

const fromSequence = <T>(
  sequence: readonly SequenceValue<T>[] | undefined,
  index: number,
  fallback: T,
): Promise<T> => {
  const value =
    sequence === undefined || sequence.length === 0
      ? fallback
      : (sequence[index] ?? sequence.at(-1) ?? fallback);

  if (value instanceof Error) {
    return Promise.reject(value);
  }

  return Promise.resolve(value);
};

const createFakeReader = (options: FakeReaderOptions = {}): FakeReader => {
  const bytes = options.bytes ?? defaultBytes;
  const defaultFileStats = createStats({ size: BigInt(bytes.byteLength) });
  const operations: string[] = [];
  const openFlags: number[] = [];
  const readRequests: ReadRequest[] = [];
  let closeCalls = 0;
  let fileRealpathCalls = 0;
  let handleStatCalls = 0;
  let linkStatCalls = 0;
  let pathStatCalls = 0;
  let rootRealpathCalls = 0;
  let rootStatCalls = 0;

  const handle: SourceReaderFileHandle = {
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
    stat: async () => {
      operations.push('fstat');
      const index = handleStatCalls;

      handleStatCalls += 1;

      return fromSequence(options.handleStats, index, defaultFileStats);
    },
  };

  const fileSystem: SourceReaderFileSystem = {
    lstat: async (path) => {
      operations.push(`lstat:${path}`);
      const index = linkStatCalls;

      linkStatCalls += 1;

      return fromSequence(options.linkStats, index, defaultFileStats);
    },
    open: (path, flags) => {
      operations.push(`open:${path}`);
      openFlags.push(flags);

      if (options.openError !== undefined) {
        return Promise.reject(options.openError);
      }

      return Promise.resolve(handle);
    },
    realpath: async (path) => {
      operations.push(`realpath:${path}`);

      if (path === projectRoot) {
        const index = rootRealpathCalls;

        rootRealpathCalls += 1;

        return fromSequence(options.rootRealpaths, index, projectRoot);
      }

      const index = fileRealpathCalls;

      fileRealpathCalls += 1;

      return fromSequence(options.fileRealpaths, index, absolutePath);
    },
    stat: async (path) => {
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
    operations,
    readRequests,
  };
};

const readWith = async (
  fake: FakeReader,
  sourceCandidate: SourceCandidate = candidate,
  platform: NodeJS.Platform = 'linux',
) =>
  createSourceCandidateReader(
    fake.fileSystem,
    platform,
  )({
    candidate: sourceCandidate,
    projectRoot,
  });

const expectReadFailure = (
  result: Awaited<ReturnType<typeof readWith>>,
  code: (typeof SOURCE_PARSER_ERROR_CODES)[keyof typeof SOURCE_PARSER_ERROR_CODES],
  filePath = relativePath,
): void => {
  expect(result.success).toBe(false);

  if (result.success) {
    throw new Error('Expected a source-reader failure.');
  }

  expect(result.error).toEqual({
    code,
    filePath,
    message: result.error.message,
    recoverable: true,
    stage: 'read',
  });
  expect(typeof result.error.message).toBe('string');
};

describe('read source candidate', () => {
  it('reads only through the verified handle with POSIX no-follow and non-blocking flags', async () => {
    const fake = createFakeReader();

    const result = await readWith(fake);

    expect(result).toEqual({
      sourceText: new TextDecoder().decode(defaultBytes),
      success: true,
    });
    expect(fake.openFlags).toEqual([
      fileSystemConstants.O_RDONLY |
        fileSystemConstants.O_NOFOLLOW |
        fileSystemConstants.O_NONBLOCK,
    ]);
    expect(fake.operations).toEqual([
      `realpath:${projectRoot}`,
      `stat:${projectRoot}`,
      `lstat:${absolutePath}`,
      `realpath:${absolutePath}`,
      `stat:${absolutePath}`,
      `realpath:${projectRoot}`,
      `stat:${projectRoot}`,
      `open:${absolutePath}`,
      'fstat',
      `realpath:${projectRoot}`,
      `stat:${projectRoot}`,
      `realpath:${absolutePath}`,
      `stat:${absolutePath}`,
      `read:0:${String(SOURCE_READ_CHUNK_BYTES)}`,
      `read:${String(defaultBytes.byteLength)}:${String(SOURCE_READ_CHUNK_BYTES)}`,
      'fstat',
      `realpath:${absolutePath}`,
      `stat:${absolutePath}`,
      `realpath:${projectRoot}`,
      `stat:${projectRoot}`,
      'close',
    ]);
  });

  it('uses the portable read-only flag on Windows', async () => {
    const fake = createFakeReader();

    await readWith(fake, candidate, 'win32');

    expect(fake.openFlags).toEqual([fileSystemConstants.O_RDONLY]);
  });

  it.each([
    [{ ...candidate, absolutePath: externalPath }],
    [{ ...candidate, absolutePath: projectRoot }],
    [{ ...candidate, absolutePath: `${projectRoot}${sep}src${sep}..${sep}App.tsx` }],
    [{ ...candidate, relativePath: 'src/Other.tsx' }],
  ] satisfies readonly SourceCandidate[][])(
    'rejects a candidate path that does not match its portable declaration',
    async (invalidCandidate) => {
      const fake = createFakeReader();

      const result = await readWith(fake, invalidCandidate);

      expectReadFailure(
        result,
        SOURCE_PARSER_ERROR_CODES.fileOutsideRoot,
        invalidCandidate.relativePath,
      );
      expect(fake.operations).not.toContain(expect.stringContaining('lstat:'));
      expect(fake.openFlags).toEqual([]);
    },
  );

  it.each([
    [{ ...candidate, relativePath: '../outside/App.tsx' }],
    [{ ...candidate, absolutePath: projectRoot, relativePath: '.' }],
    [{ ...candidate, relativePath: 'src\\App.tsx' }],
    [{ ...candidate, relativePath: 'src/../App.tsx' }],
    [{ ...candidate, relativePath: '/src/App.tsx' }],
    [{ ...candidate, relativePath: 'C:/private/App.tsx' }],
    [{ ...candidate, relativePath: 'C:private/App.tsx' }],
  ] satisfies readonly SourceCandidate[][])(
    'fails generically when an internal candidate contains a non-portable relative path',
    async (invalidCandidate) => {
      const fake = createFakeReader();
      const reader = createSourceCandidateReader(fake.fileSystem);
      let thrown: unknown;

      try {
        await reader({
          candidate: invalidCandidate,
          projectRoot,
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(SourceCandidateReadInvariantError);
      expect(thrown).toMatchObject({
        code: 'SOURCE_CANDIDATE_READ_INVARIANT_FAILED',
        message: 'Source candidate reading reached an invalid internal state.',
        name: 'SourceCandidateReadInvariantError',
      });
      expect(JSON.stringify(thrown)).not.toContain(invalidCandidate.relativePath);
      expect(Object.keys(thrown as object)).not.toContain('cause');
      expect(fake.operations).not.toContain(
        expect.stringContaining(`lstat:${invalidCandidate.absolutePath}`),
      );
      expect(fake.openFlags).toEqual([]);
    },
  );

  it('rejects a canonical candidate that resolves outside the authorized root', async () => {
    const fake = createFakeReader({
      fileRealpaths: [externalPath],
    });

    const result = await readWith(fake);

    expectReadFailure(result, SOURCE_PARSER_ERROR_CODES.fileOutsideRoot);
    expect(fake.openFlags).toEqual([]);
  });

  it('rejects an in-root alias or retarget instead of opening a different canonical file', async () => {
    const fake = createFakeReader({
      fileRealpaths: [join(projectRoot, 'src', 'Other.tsx')],
    });

    const result = await readWith(fake);

    expectReadFailure(result, SOURCE_PARSER_ERROR_CODES.fileChanged);
    expect(fake.openFlags).toEqual([]);
  });

  it.each([
    [createStats({ type: 'directory' }), SOURCE_PARSER_ERROR_CODES.fileNotRegular],
    [createStats({ type: 'other' }), SOURCE_PARSER_ERROR_CODES.fileNotRegular],
    [
      createStats({ size: BigInt(MAX_SOURCE_FILE_BYTES) + 1n }),
      SOURCE_PARSER_ERROR_CODES.fileTooLarge,
    ],
    [createStats({ ino: 4n }), SOURCE_PARSER_ERROR_CODES.fileChanged],
  ] as const)('fails closed before open for an unsafe path snapshot', async (stats, code) => {
    const fake = createFakeReader({
      linkStats: [stats],
      pathStats: [createStats()],
    });

    const result = await readWith(fake);

    expectReadFailure(result, code);
    expect(fake.openFlags).toEqual([]);
  });

  it.each([
    ['EACCES', SOURCE_PARSER_ERROR_CODES.fileUnreadable],
    ['EPERM', SOURCE_PARSER_ERROR_CODES.fileUnreadable],
    ['ERR_ACCESS_DENIED', SOURCE_PARSER_ERROR_CODES.fileUnreadable],
    ['ENOENT', SOURCE_PARSER_ERROR_CODES.fileChanged],
    ['ENOTDIR', SOURCE_PARSER_ERROR_CODES.fileChanged],
    ['ELOOP', SOURCE_PARSER_ERROR_CODES.fileChanged],
    ['EIO', SOURCE_PARSER_ERROR_CODES.fileReadFailed],
  ] as const)('normalizes %s without native detail', async (nativeCode, expectedCode) => {
    const fake = createFakeReader({
      linkStats: [createFileSystemError(nativeCode)],
    });

    const result = await readWith(fake);

    expectReadFailure(result, expectedCode);
    expect(JSON.stringify(result)).not.toContain('PRIVATE_NATIVE_DETAIL');
    expect(JSON.stringify(result)).not.toContain('/Users/owner/secret');
  });

  it('closes exactly once when the opened handle does not match the authorized snapshot', async () => {
    const fake = createFakeReader({
      handleStats: [createStats({ ino: 99n })],
    });

    const result = await readWith(fake);

    expectReadFailure(result, SOURCE_PARSER_ERROR_CODES.fileChanged);
    expect(fake.closeCalls).toBe(1);
    expect(fake.readRequests).toEqual([]);
  });

  it('rejects a non-regular object substituted between lstat and fstat', async () => {
    const fake = createFakeReader({
      handleStats: [createStats({ type: 'other' })],
    });

    const result = await readWith(fake);

    expectReadFailure(result, SOURCE_PARSER_ERROR_CODES.fileNotRegular);
    expect(fake.closeCalls).toBe(1);
  });

  it('reauthorizes the path against the handle immediately after open', async () => {
    const fake = createFakeReader({
      fileRealpaths: [absolutePath, join(projectRoot, 'src', 'Replaced.tsx')],
    });

    const result = await readWith(fake);

    expectReadFailure(result, SOURCE_PARSER_ERROR_CODES.fileChanged);
    expect(fake.closeCalls).toBe(1);
    expect(fake.readRequests).toEqual([]);
  });

  it('detects path metadata changed after open even when the canonical name is restored', async () => {
    const fake = createFakeReader({
      pathStats: [createStats(), createStats({ ctimeNs: 21n })],
    });

    const result = await readWith(fake);

    expectReadFailure(result, SOURCE_PARSER_ERROR_CODES.fileChanged);
    expect(fake.closeCalls).toBe(1);
    expect(fake.readRequests).toEqual([]);
  });

  it('accepts exactly 1 MiB and never requests more than a 64 KiB chunk', async () => {
    const bytes = new Uint8Array(MAX_SOURCE_FILE_BYTES);
    bytes.fill(0x61);
    const fake = createFakeReader({ bytes });

    const result = await readWith(fake);

    expect(result.success).toBe(true);
    expect(fake.readRequests).toHaveLength(MAX_SOURCE_FILE_BYTES / SOURCE_READ_CHUNK_BYTES + 1);
    expect(fake.readRequests.every(({ length }) => length <= SOURCE_READ_CHUNK_BYTES)).toBe(true);
    expect(fake.readRequests.at(-1)).toEqual({
      length: 1,
      offset: MAX_SOURCE_FILE_BYTES,
      position: MAX_SOURCE_FILE_BYTES,
    });
    expect(fake.closeCalls).toBe(1);
  });

  it('detects growth beyond 1 MiB through the bounded descriptor read', async () => {
    const bytes = new Uint8Array(MAX_SOURCE_FILE_BYTES + 1);
    bytes.fill(0x61);
    const oneMiBStats = createStats({ size: BigInt(MAX_SOURCE_FILE_BYTES) });
    const fake = createFakeReader({
      bytes,
      handleStats: [oneMiBStats],
      linkStats: [oneMiBStats],
      pathStats: [oneMiBStats, oneMiBStats],
    });

    const result = await readWith(fake);

    expectReadFailure(result, SOURCE_PARSER_ERROR_CODES.fileTooLarge);
    expect(fake.readRequests.every(({ length }) => length <= SOURCE_READ_CHUNK_BYTES)).toBe(true);
    expect(fake.closeCalls).toBe(1);
  });

  it('detects an unexpected short descriptor read as a changed file', async () => {
    const fake = createFakeReader({
      read: () => Promise.resolve({ bytesRead: 0 }),
    });

    const result = await readWith(fake);

    expectReadFailure(result, SOURCE_PARSER_ERROR_CODES.fileChanged);
    expect(fake.closeCalls).toBe(1);
  });

  it.each([-1, SOURCE_READ_CHUNK_BYTES + 1, 1.5, Number.NaN])(
    'rejects an invalid descriptor byte count: %s',
    async (bytesRead) => {
      const fake = createFakeReader({
        read: () => Promise.resolve({ bytesRead }),
      });

      const result = await readWith(fake);

      expectReadFailure(result, SOURCE_PARSER_ERROR_CODES.fileReadFailed);
      expect(fake.closeCalls).toBe(1);
    },
  );

  it('detects handle and path snapshot changes after reading', async () => {
    const changed = createStats({ mtimeNs: 11n });
    const fake = createFakeReader({
      handleStats: [createStats(), changed],
    });

    const result = await readWith(fake);

    expectReadFailure(result, SOURCE_PARSER_ERROR_CODES.fileChanged);
    expect(fake.closeCalls).toBe(1);
  });

  it('detects a path identity replacement after a stable final handle snapshot', async () => {
    const fake = createFakeReader({
      pathStats: [createStats(), createStats(), createStats({ dev: 9n })],
    });

    const result = await readWith(fake);

    expectReadFailure(result, SOURCE_PARSER_ERROR_CODES.fileChanged);
    expect(fake.closeCalls).toBe(1);
  });

  it('strictly rejects malformed UTF-8 without returning source bytes', async () => {
    const fake = createFakeReader({
      bytes: new Uint8Array([0xc3, 0x28]),
    });

    const result = await readWith(fake);

    expectReadFailure(result, SOURCE_PARSER_ERROR_CODES.invalidEncoding);
    expect(JSON.stringify(result)).not.toContain('195');
    expect(fake.closeCalls).toBe(1);
  });

  it('preserves an initial UTF-8 BOM in the exact source string supplied downstream', async () => {
    const fake = createFakeReader({
      bytes: new Uint8Array([0xef, 0xbb, 0xbf, 0x61]),
    });

    const result = await readWith(fake);

    expect(result).toEqual({
      sourceText: '\uFEFFa',
      success: true,
    });
    expect(result.success && result.sourceText.charCodeAt(0)).toBe(0xfeff);
  });

  it('preserves a BOM through the production Node filesystem adapter', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'uxaudit-source-reader-'));
    const sourceDirectory = join(temporaryRoot, 'src');
    const sourcePath = join(sourceDirectory, 'App.tsx');

    try {
      await mkdir(sourceDirectory);
      await writeFile(sourcePath, new Uint8Array([0xef, 0xbb, 0xbf, 0x61]));
      const canonicalRoot = await realpath(temporaryRoot);
      const canonicalSourcePath = join(canonicalRoot, 'src', 'App.tsx');

      const { readSourceCandidate } = await import('../../src/parsing/read-source-candidate.js');
      const result = await readSourceCandidate({
        candidate: {
          absolutePath: canonicalSourcePath,
          extension: '.tsx',
          kind: 'file',
          relativePath,
          sourceKind: SOURCE_KINDS.typescriptJsx,
        },
        projectRoot: canonicalRoot,
      });

      expect(result).toEqual({
        sourceText: '\uFEFFa',
        success: true,
      });
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  });

  it('maps a native read failure and still closes the handle exactly once', async () => {
    const fake = createFakeReader({
      read: () => Promise.reject(createFileSystemError('EACCES')),
    });

    const result = await readWith(fake);

    expectReadFailure(result, SOURCE_PARSER_ERROR_CODES.fileUnreadable);
    expect(fake.closeCalls).toBe(1);
    expect(JSON.stringify(result)).not.toContain('PRIVATE_NATIVE_DETAIL');
  });

  it('lets a close failure block an otherwise successful read', async () => {
    const fake = createFakeReader({
      closeError: createFileSystemError('EIO'),
    });

    const result = await readWith(fake);

    expectReadFailure(result, SOURCE_PARSER_ERROR_CODES.fileReadFailed);
    expect(fake.closeCalls).toBe(1);
  });

  it('retains the original local failure when closing that handle also fails', async () => {
    const fake = createFakeReader({
      closeError: createFileSystemError('EIO'),
      handleStats: [createStats({ type: 'other' })],
    });

    const result = await readWith(fake);

    expectReadFailure(result, SOURCE_PARSER_ERROR_CODES.fileNotRegular);
    expect(fake.closeCalls).toBe(1);
  });

  it.each([
    {
      name: 'non-absolute root',
      root: 'relative/project',
    },
    {
      name: 'retargeted root',
      root: projectRoot,
      rootRealpaths: [replacementRoot],
    },
    {
      name: 'non-directory root',
      root: projectRoot,
      rootStats: [createStats({ type: 'file' })],
    },
  ])(
    'throws one stable fatal error for a $name',
    async ({ root, rootRealpaths, rootStats: stats }) => {
      const fake = createFakeReader({
        ...(rootRealpaths === undefined ? {} : { rootRealpaths }),
        ...(stats === undefined ? {} : { rootStats: stats }),
      });
      const reader = createSourceCandidateReader(fake.fileSystem);
      let thrown: unknown;

      try {
        await reader({
          candidate,
          projectRoot: root,
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(SourceRootAuthorizationError);
      expect(thrown).toMatchObject({
        code: SOURCE_ROOT_AUTHORIZATION_ERROR_CODES.unavailable,
        message: 'Project root could not be authorized for source reading.',
        name: 'SourceRootAuthorizationError',
      });
      expect(Object.keys(thrown as object)).not.toContain('cause');
      expect(fake.openFlags).toEqual([]);
    },
  );

  it('treats a root identity change immediately before open as fatal', async () => {
    const fake = createFakeReader({
      rootStats: [rootStats, createStats({ dev: 1n, ino: 2n, size: 0n, type: 'directory' })],
    });
    const reader = createSourceCandidateReader(fake.fileSystem);

    await expect(
      reader({
        candidate,
        projectRoot,
      }),
    ).rejects.toMatchObject({
      code: SOURCE_ROOT_AUTHORIZATION_ERROR_CODES.unavailable,
    });
    expect(fake.openFlags).toEqual([]);
  });

  it('treats a root retarget immediately after open as fatal and closes once', async () => {
    const fake = createFakeReader({
      rootRealpaths: [projectRoot, projectRoot, replacementRoot],
    });
    const reader = createSourceCandidateReader(fake.fileSystem);

    await expect(
      reader({
        candidate,
        projectRoot,
      }),
    ).rejects.toMatchObject({
      code: SOURCE_ROOT_AUTHORIZATION_ERROR_CODES.unavailable,
    });
    expect(fake.closeCalls).toBe(1);
    expect(fake.readRequests).toEqual([]);
  });

  it('promotes root loss detected while normalizing a candidate I/O failure to fatal', async () => {
    const fake = createFakeReader({
      linkStats: [createFileSystemError('ENOENT')],
      rootStats: [rootStats, createStats({ dev: 1n, ino: 8n, size: 0n, type: 'directory' })],
    });
    const reader = createSourceCandidateReader(fake.fileSystem);

    await expect(
      reader({
        candidate,
        projectRoot,
      }),
    ).rejects.toMatchObject({
      code: SOURCE_ROOT_AUTHORIZATION_ERROR_CODES.unavailable,
    });
    expect(fake.openFlags).toEqual([]);
  });

  it('rejects invalid metadata rather than trusting malformed injected filesystem state', async () => {
    const invalidStats = {
      ...createStats(),
      size: -1n,
    };
    const fake = createFakeReader({
      linkStats: [invalidStats],
    });

    const result = await readWith(fake);

    expectReadFailure(result, SOURCE_PARSER_ERROR_CODES.fileChanged);
    expect(fake.openFlags).toEqual([]);
  });
});

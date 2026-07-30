import { constants as fileSystemConstants } from 'node:fs';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  REPORT_WRITE_CHUNK_BYTES,
  REPORT_WRITE_ERROR_CODES,
  ReportWriteError,
  createReportFileWriter,
  writeReportFile,
  type ReportFileStats,
  type ReportFileWriteRequest,
  type ReportWriterFileHandle,
  type ReportWriterFileSystem,
} from '../../../src/reporting/files/write-report-file.js';

const projectRoot = resolve(tmpdir(), 'uxaudit-report-writer-project');
const reportsDirectory = join(projectRoot, 'reports');
const nestedDirectory = join(reportsDirectory, 'nested');
const jsonTarget = join(reportsDirectory, 'audit-report.json');
const externalTarget = resolve(projectRoot, '..', 'outside', 'audit-report.json');
const defaultContent = '{\n  "schemaVersion": "1.0.0"\n}\n';

type StatsType = 'directory' | 'file' | 'other';
type ChangePhase = 'mkdir' | 'open' | 'write';

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
  dev = 1n,
  ino = 1n,
  mtimeNs = 10n,
  size = 0n,
  type = 'file',
}: StatsOptions = {}): ReportFileStats => ({
  ctimeNs,
  dev,
  ino,
  isDirectory: () => type === 'directory',
  isFile: () => type === 'file',
  mtimeNs,
  size,
});

const rootStats = createStats({ ino: 1n, type: 'directory' });
const initialFileStats = createStats({ ino: 3n });

const createFileSystemError = (code: string): Error & { readonly code: string } =>
  Object.assign(new Error('PRIVATE_NATIVE_DETAIL /Users/owner/secret'), { code });

interface WriteRequestRecord {
  readonly length: number;
  readonly offset: number;
  readonly position: number;
}

interface MakeDirectoryRecord {
  readonly options: { readonly mode: number; readonly recursive: false };
  readonly path: string;
}

interface FakeWriterState {
  readonly closeCalls: number;
  readonly content: Uint8Array;
  readonly fileSystem: ReportWriterFileSystem;
  readonly mkdirCalls: readonly MakeDirectoryRecord[];
  readonly openFlags: readonly number[];
  readonly openModes: readonly number[];
  readonly openPaths: readonly string[];
  readonly operations: readonly string[];
  readonly syncCalls: number;
  readonly writeRequests: readonly WriteRequestRecord[];
}

interface FakeWriterOptions {
  readonly closeError?: Error;
  readonly directories?: readonly string[];
  readonly directoryRealpath?: string;
  readonly directoryStats?: ReportFileStats;
  readonly handleStats?: readonly (ReportFileStats | Error)[];
  readonly mkdirError?: Error;
  readonly openError?: Error;
  readonly outputChangesAfter?: ChangePhase;
  readonly rootChangesAfter?: ChangePhase;
  readonly rootRealpath?: string;
  readonly syncError?: Error;
  readonly targetLstatStats?: ReportFileStats;
  readonly targetReplacedAfterClose?: boolean;
  readonly targetRealpath?: string;
  readonly targetStatStats?: ReportFileStats;
  readonly writeResults?: readonly (Error | number)[];
}

const hasReachedPhase = (
  phase: ChangePhase | undefined,
  state: {
    readonly mkdirCalls: number;
    readonly opened: boolean;
    readonly writeCalls: number;
  },
): boolean => {
  if (phase === 'mkdir') {
    return state.mkdirCalls > 0;
  }

  if (phase === 'open') {
    return state.opened;
  }

  return phase === 'write' && state.writeCalls > 0;
};

const createFakeWriter = (options: FakeWriterOptions = {}): FakeWriterState => {
  const directoryStats = new Map<string, ReportFileStats>();
  const configuredDirectories = options.directories ?? [projectRoot, reportsDirectory];
  const mkdirCalls: MakeDirectoryRecord[] = [];
  const openFlags: number[] = [];
  const openModes: number[] = [];
  const openPaths: string[] = [];
  const operations: string[] = [];
  const writeRequests: WriteRequestRecord[] = [];
  const writtenBytes: number[] = [];
  let closeCalls = 0;
  let currentFileStats = initialFileStats;
  let handleStatCalls = 0;
  let opened = false;
  let syncCalls = 0;
  let writeCalls = 0;

  configuredDirectories.forEach((directory, index) => {
    directoryStats.set(
      directory,
      directory === projectRoot
        ? rootStats
        : index === 1 && options.directoryStats !== undefined
          ? options.directoryStats
          : createStats({ ino: BigInt(index + 2), type: 'directory' }),
    );
  });

  const phaseState = () => ({
    mkdirCalls: mkdirCalls.length,
    opened,
    writeCalls,
  });
  const isReportTarget = (path: string): boolean =>
    path.endsWith('audit-report.json') || path.endsWith('audit-report.html');

  const getDirectoryStats = (path: string): ReportFileStats | undefined => {
    const stats = directoryStats.get(path);

    if (stats === undefined) {
      return undefined;
    }

    if (path === projectRoot && hasReachedPhase(options.rootChangesAfter, phaseState())) {
      return createStats({ ino: 99n, type: 'directory' });
    }

    if (path !== projectRoot && hasReachedPhase(options.outputChangesAfter, phaseState())) {
      return createStats({ ino: 98n, type: 'directory' });
    }

    return stats;
  };
  const getTargetStats = (): ReportFileStats =>
    options.targetReplacedAfterClose === true && closeCalls > 0
      ? createStats({
          ctimeNs: currentFileStats.ctimeNs,
          ino: 77n,
          mtimeNs: currentFileStats.mtimeNs,
          size: currentFileStats.size,
        })
      : currentFileStats;

  const handle: ReportWriterFileHandle = {
    close: () => {
      operations.push('close');
      closeCalls += 1;

      return options.closeError === undefined
        ? Promise.resolve()
        : Promise.reject(options.closeError);
    },
    stat: () => {
      operations.push('fstat');
      const supplied = options.handleStats?.[handleStatCalls];

      handleStatCalls += 1;

      if (supplied instanceof Error) {
        return Promise.reject(supplied);
      }

      return Promise.resolve(supplied ?? currentFileStats);
    },
    sync: () => {
      operations.push('sync');
      syncCalls += 1;

      return options.syncError === undefined
        ? Promise.resolve()
        : Promise.reject(options.syncError);
    },
    write: (buffer, offset, length, position) => {
      operations.push(`write:${String(position)}:${String(length)}`);
      writeRequests.push({ length, offset, position });
      const supplied = options.writeResults?.[writeCalls];

      writeCalls += 1;

      if (supplied instanceof Error) {
        return Promise.reject(supplied);
      }

      const bytesWritten = supplied ?? length;

      if (Number.isSafeInteger(bytesWritten) && bytesWritten > 0 && bytesWritten <= length) {
        writtenBytes.push(...buffer.subarray(offset, offset + bytesWritten));
        currentFileStats = createStats({
          ctimeNs: 21n,
          ino: initialFileStats.ino,
          mtimeNs: 11n,
          size: BigInt(writtenBytes.length),
        });
      }

      return Promise.resolve({ bytesWritten });
    },
  };

  const fileSystem: ReportWriterFileSystem = {
    lstat: (path) => {
      operations.push(`lstat:${path}`);
      const stats = getDirectoryStats(path);

      if (stats !== undefined) {
        return Promise.resolve(stats);
      }

      if (isReportTarget(path)) {
        return opened
          ? Promise.resolve(options.targetLstatStats ?? getTargetStats())
          : Promise.reject(createFileSystemError('ENOENT'));
      }

      return Promise.reject(createFileSystemError('ENOENT'));
    },
    mkdir: (path, mkdirOptions) => {
      operations.push(`mkdir:${path}`);
      mkdirCalls.push({ options: mkdirOptions, path });

      if (options.mkdirError !== undefined) {
        return Promise.reject(options.mkdirError);
      }

      directoryStats.set(
        path,
        createStats({
          ino: BigInt(10 + mkdirCalls.length),
          type: 'directory',
        }),
      );
      return Promise.resolve();
    },
    open: (path, flags, mode) => {
      operations.push(`open:${path}`);
      openPaths.push(path);
      openFlags.push(flags);
      openModes.push(mode);
      opened = true;

      if (options.openError !== undefined) {
        return Promise.reject(options.openError);
      }

      currentFileStats = initialFileStats;
      return Promise.resolve(handle);
    },
    realpath: (path) => {
      operations.push(`realpath:${path}`);

      if (path === projectRoot) {
        return Promise.resolve(options.rootRealpath ?? path);
      }

      if (path === reportsDirectory || path === nestedDirectory) {
        return Promise.resolve(options.directoryRealpath ?? path);
      }

      if (isReportTarget(path)) {
        return opened
          ? Promise.resolve(options.targetRealpath ?? path)
          : Promise.reject(createFileSystemError('ENOENT'));
      }

      return Promise.resolve(path);
    },
    stat: (path) => {
      operations.push(`stat:${path}`);
      const stats = getDirectoryStats(path);

      if (stats !== undefined) {
        return Promise.resolve(stats);
      }

      if (isReportTarget(path)) {
        return opened
          ? Promise.resolve(options.targetStatStats ?? getTargetStats())
          : Promise.reject(createFileSystemError('ENOENT'));
      }

      return Promise.reject(createFileSystemError('ENOENT'));
    },
  };

  return {
    get closeCalls() {
      return closeCalls;
    },
    get content() {
      return Uint8Array.from(writtenBytes);
    },
    fileSystem,
    mkdirCalls,
    openFlags,
    openModes,
    openPaths,
    operations,
    get syncCalls() {
      return syncCalls;
    },
    writeRequests,
  };
};

const createRequest = (
  overrides: Partial<ReportFileWriteRequest> = {},
): ReportFileWriteRequest => ({
  content: defaultContent,
  format: 'json',
  projectRoot,
  relativePath: 'reports/audit-report.json',
  ...overrides,
});

const writeWith = (
  fake: FakeWriterState,
  request: ReportFileWriteRequest = createRequest(),
  platform: NodeJS.Platform = 'linux',
) => createReportFileWriter(fake.fileSystem, platform)(request);

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'uxaudit-report-writer-'));

  temporaryDirectories.push(directory);
  return await realpath(directory);
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('write report file', () => {
  it('creates each missing directory separately and publishes one frozen relative success', async () => {
    const fake = createFakeWriter({ directories: [projectRoot] });
    const result = await writeWith(
      fake,
      createRequest({
        relativePath: 'reports/nested/audit-report.json',
      }),
    );

    expect(result).toEqual({
      format: 'json',
      relativePath: 'reports/nested/audit-report.json',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(fake.mkdirCalls).toEqual([
      {
        options: { mode: 0o700, recursive: false },
        path: reportsDirectory,
      },
      {
        options: { mode: 0o700, recursive: false },
        path: nestedDirectory,
      },
    ]);
    expect(fake.openPaths).toEqual([join(nestedDirectory, 'audit-report.json')]);
    expect(fake.openModes).toEqual([0o600]);
    expect(new TextDecoder().decode(fake.content)).toBe(defaultContent);
    expect(fake.syncCalls).toBe(1);
    expect(fake.closeCalls).toBe(1);
    expect(fake.operations.indexOf(`mkdir:${nestedDirectory}`)).toBeLessThan(
      fake.operations.indexOf(`open:${join(nestedDirectory, 'audit-report.json')}`),
    );
    expect(
      fake.operations.lastIndexOf(`stat:${join(nestedDirectory, 'audit-report.json')}`),
    ).toBeGreaterThan(fake.operations.lastIndexOf('close'));
    expect(fake.operations.at(-1)).toBe(`stat:${join(nestedDirectory, 'audit-report.json')}`);
  });

  it('uses exclusive no-follow creation on POSIX and portable exclusive creation on Windows', async () => {
    const posixFake = createFakeWriter();
    const windowsFake = createFakeWriter();

    await writeWith(posixFake);
    await writeWith(windowsFake, createRequest(), 'win32');

    const commonFlags =
      fileSystemConstants.O_WRONLY | fileSystemConstants.O_CREAT | fileSystemConstants.O_EXCL;

    expect(posixFake.openFlags).toEqual([commonFlags | fileSystemConstants.O_NOFOLLOW]);
    expect(windowsFake.openFlags).toEqual([commonFlags]);
    expect((posixFake.openFlags[0] ?? 0) & fileSystemConstants.O_TRUNC).toBe(0);
    expect((windowsFake.openFlags[0] ?? 0) & fileSystemConstants.O_TRUNC).toBe(0);
  });

  it('supports the fixed HTML target through the same writer', async () => {
    const fake = createFakeWriter();

    await expect(
      writeWith(
        fake,
        createRequest({
          content: '<!doctype html>\n',
          format: 'html',
          relativePath: 'reports/audit-report.html',
        }),
      ),
    ).resolves.toEqual({
      format: 'html',
      relativePath: 'reports/audit-report.html',
    });
    expect(fake.openPaths).toEqual([join(reportsDirectory, 'audit-report.html')]);
    expect(new TextDecoder().decode(fake.content)).toBe('<!doctype html>\n');
  });

  it.each([
    {
      expectedCode: REPORT_WRITE_ERROR_CODES.invalidRequest,
      request: { ...createRequest(), relativePath: 'reports/audit-report.html' },
    },
    {
      expectedCode: REPORT_WRITE_ERROR_CODES.pathUnsafe,
      request: { ...createRequest(), relativePath: '../reports/audit-report.json' },
    },
    {
      expectedCode: REPORT_WRITE_ERROR_CODES.pathUnsafe,
      request: { ...createRequest(), relativePath: '/reports/audit-report.json' },
    },
    {
      expectedCode: REPORT_WRITE_ERROR_CODES.invalidRequest,
      request: { ...createRequest(), relativePath: 'reports\\audit-report.json' },
    },
    {
      expectedCode: REPORT_WRITE_ERROR_CODES.invalidRequest,
      request: { ...createRequest(), format: 'terminal' },
    },
    {
      expectedCode: REPORT_WRITE_ERROR_CODES.invalidRequest,
      request: { ...createRequest(), content: '\ud800' },
    },
  ])('rejects an invalid or unsafe request before filesystem use', async (testCase) => {
    const fake = createFakeWriter();

    await expect(writeWith(fake, testCase.request as ReportFileWriteRequest)).rejects.toMatchObject(
      {
        code: testCase.expectedCode,
      },
    );
    expect(fake.operations).toEqual([]);
  });

  it('does not invoke request accessors or proxy traps', async () => {
    const fake = createFakeWriter();
    const contentGetter = vi.fn(() => defaultContent);
    const trap = vi.fn(() => {
      throw new Error('REQUEST_PROXY_TRAP');
    });
    const accessorRequest = {
      format: 'json',
      projectRoot,
      relativePath: 'reports/audit-report.json',
    };
    const proxyRequest = new Proxy(createRequest(), {
      get: trap,
      getOwnPropertyDescriptor: trap,
      getPrototypeOf: trap,
      ownKeys: trap,
    });

    Object.defineProperty(accessorRequest, 'content', {
      enumerable: true,
      get: contentGetter,
    });

    await expect(writeWith(fake, accessorRequest as ReportFileWriteRequest)).rejects.toMatchObject({
      code: REPORT_WRITE_ERROR_CODES.invalidRequest,
    });
    await expect(writeWith(fake, proxyRequest)).rejects.toMatchObject({
      code: REPORT_WRITE_ERROR_CODES.invalidRequest,
    });
    expect(contentGetter).not.toHaveBeenCalled();
    expect(trap).not.toHaveBeenCalled();
    expect(fake.operations).toEqual([]);
  });

  it('rejects a noncanonical root before creating an output path', async () => {
    const fake = createFakeWriter({
      rootRealpath: resolve(projectRoot, '..', 'replacement'),
    });

    await expect(writeWith(fake)).rejects.toMatchObject({
      code: REPORT_WRITE_ERROR_CODES.pathUnsafe,
      message: 'The report path could not be authorized within the project root.',
    });
    expect(fake.mkdirCalls).toEqual([]);
    expect(fake.openPaths).toEqual([]);
  });

  it.each([createStats({ ino: 2n, type: 'file' }), createStats({ ino: 2n, type: 'other' })])(
    'rejects a link-like or non-directory output segment before open',
    async (stats) => {
      const fake = createFakeWriter({ directoryStats: stats });

      await expect(writeWith(fake)).rejects.toMatchObject({
        code: REPORT_WRITE_ERROR_CODES.pathUnsafe,
      });
      expect(fake.openPaths).toEqual([]);
    },
  );

  it('rejects an output directory whose canonical target escapes the root', async () => {
    const fake = createFakeWriter({
      directoryRealpath: resolve(projectRoot, '..', 'outside'),
    });

    await expect(writeWith(fake)).rejects.toMatchObject({
      code: REPORT_WRITE_ERROR_CODES.pathUnsafe,
    });
    expect(fake.openPaths).toEqual([]);
  });

  it('fails closed when a missing-directory creation races with another entry', async () => {
    const fake = createFakeWriter({
      directories: [projectRoot],
      mkdirError: createFileSystemError('EEXIST'),
    });

    await expect(writeWith(fake)).rejects.toMatchObject({
      code: REPORT_WRITE_ERROR_CODES.pathUnsafe,
    });
    expect(fake.openPaths).toEqual([]);
  });

  it.each(['EEXIST', 'ELOOP'])(
    'rejects an existing final target without opening or overwriting it: %s',
    async (code) => {
      const fake = createFakeWriter({
        openError: createFileSystemError(code),
      });

      await expect(writeWith(fake)).rejects.toMatchObject({
        code: REPORT_WRITE_ERROR_CODES.targetExists,
        message: 'The report target already exists and was not overwritten.',
      });
      expect(fake.writeRequests).toEqual([]);
      expect(fake.closeCalls).toBe(0);
    },
  );

  it('detects root replacement immediately after exclusive open and closes without writing', async () => {
    const fake = createFakeWriter({ rootChangesAfter: 'open' });

    await expect(writeWith(fake)).rejects.toMatchObject({
      code: REPORT_WRITE_ERROR_CODES.pathUnsafe,
    });
    expect(fake.openPaths).toEqual([jsonTarget]);
    expect(fake.writeRequests).toEqual([]);
    expect(fake.closeCalls).toBe(1);
  });

  it('detects an ancestor identity change after writing and never returns success', async () => {
    const fake = createFakeWriter({ outputChangesAfter: 'write' });

    await expect(writeWith(fake)).rejects.toMatchObject({
      code: REPORT_WRITE_ERROR_CODES.pathUnsafe,
    });
    expect(new TextDecoder().decode(fake.content)).toBe(defaultContent);
    expect(fake.closeCalls).toBe(1);
  });

  it('rejects a newly opened target whose canonical path escapes the root', async () => {
    const fake = createFakeWriter({ targetRealpath: externalTarget });

    await expect(writeWith(fake)).rejects.toMatchObject({
      code: REPORT_WRITE_ERROR_CODES.pathUnsafe,
    });
    expect(fake.writeRequests).toEqual([]);
    expect(fake.closeCalls).toBe(1);
  });

  it('detects replacement of the written target during close-time final authorization', async () => {
    const fake = createFakeWriter({ targetReplacedAfterClose: true });

    await expect(writeWith(fake)).rejects.toMatchObject({
      code: REPORT_WRITE_ERROR_CODES.pathUnsafe,
    });
    expect(new TextDecoder().decode(fake.content)).toBe(defaultContent);
    expect(fake.closeCalls).toBe(1);
    expect(fake.operations.at(-1)).toBe(`stat:${jsonTarget}`);
  });

  it('rejects a path/handle identity mismatch before writing', async () => {
    const fake = createFakeWriter({
      targetStatStats: createStats({ ino: 44n }),
    });

    await expect(writeWith(fake)).rejects.toMatchObject({
      code: REPORT_WRITE_ERROR_CODES.pathUnsafe,
    });
    expect(fake.writeRequests).toEqual([]);
    expect(fake.closeCalls).toBe(1);
  });

  it('retries partial writes in bounded positional chunks and preserves exact UTF-8 bytes', async () => {
    const content = `á${'x'.repeat(REPORT_WRITE_CHUNK_BYTES + 7)}`;
    const fake = createFakeWriter({ writeResults: [2] });

    await writeWith(fake, createRequest({ content }));

    expect(Buffer.from(fake.content)).toEqual(Buffer.from(content, 'utf8'));
    expect(fake.writeRequests.length).toBeGreaterThan(1);
    expect(fake.writeRequests.every(({ length }) => length <= REPORT_WRITE_CHUNK_BYTES)).toBe(true);
    expect(fake.writeRequests[0]).toEqual({
      length: REPORT_WRITE_CHUNK_BYTES,
      offset: 0,
      position: 0,
    });
    expect(fake.writeRequests[1]?.position).toBe(2);
  });

  it.each([0, -1, 1.5, Number.NaN, defaultContent.length + 1])(
    'rejects an invalid descriptor write count and closes exactly once: %s',
    async (bytesWritten) => {
      const fake = createFakeWriter({ writeResults: [bytesWritten] });

      await expect(writeWith(fake)).rejects.toMatchObject({
        code: REPORT_WRITE_ERROR_CODES.writeFailed,
      });
      expect(fake.syncCalls).toBe(0);
      expect(fake.closeCalls).toBe(1);
    },
  );

  it('rejects a final descriptor size mismatch', async () => {
    const fake = createFakeWriter({
      handleStats: [
        initialFileStats,
        createStats({
          ctimeNs: 21n,
          ino: initialFileStats.ino,
          mtimeNs: 11n,
          size: 1n,
        }),
      ],
    });

    await expect(writeWith(fake)).rejects.toMatchObject({
      code: REPORT_WRITE_ERROR_CODES.writeFailed,
    });
    expect(fake.closeCalls).toBe(1);
  });

  it.each([
    { option: { syncError: createFileSystemError('EIO') }, syncCalls: 1 },
    { option: { closeError: createFileSystemError('EIO') }, syncCalls: 1 },
    { option: { writeResults: [createFileSystemError('ENOSPC')] }, syncCalls: 0 },
  ])(
    'normalizes write, sync, and close failures without success',
    async ({ option, syncCalls }) => {
      const fake = createFakeWriter(option);

      await expect(writeWith(fake)).rejects.toMatchObject({
        code: REPORT_WRITE_ERROR_CODES.writeFailed,
        message: 'The report file could not be written.',
      });
      expect(fake.syncCalls).toBe(syncCalls);
      expect(fake.closeCalls).toBe(1);
    },
  );

  it('normalizes native open failures without leaking their cause or private detail', async () => {
    const fake = createFakeWriter({
      openError: createFileSystemError('EACCES'),
    });
    let thrown: unknown;

    try {
      await writeWith(fake);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ReportWriteError);
    expect(thrown).toMatchObject({
      code: REPORT_WRITE_ERROR_CODES.writeFailed,
      message: 'The report file could not be written.',
      name: 'ReportWriteError',
    });
    expect((thrown as Error).cause).toBeUndefined();
    expect(JSON.stringify(thrown)).not.toContain('PRIVATE_NATIVE_DETAIL');
    expect(JSON.stringify(thrown)).not.toContain('/Users/owner/secret');
  });

  it('does not invoke hostile native-error accessors or proxy traps before normalization', async () => {
    const codeGetter = vi.fn(() => 'EEXIST');
    const trap = vi.fn(() => {
      throw new Error('ERROR_PROXY_TRAP');
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

    await expect(writeWith(createFakeWriter({ openError: accessorError }))).rejects.toMatchObject({
      code: REPORT_WRITE_ERROR_CODES.writeFailed,
    });
    await expect(writeWith(createFakeWriter({ openError: proxyError }))).rejects.toMatchObject({
      code: REPORT_WRITE_ERROR_CODES.writeFailed,
    });
    expect(codeGetter).not.toHaveBeenCalled();
    expect(trap).not.toHaveBeenCalled();
  });

  it('writes exact bytes on the real filesystem and preserves an existing target', async () => {
    const temporaryRoot = await createTemporaryDirectory();
    const request = {
      content: defaultContent,
      format: 'json',
      projectRoot: temporaryRoot,
      relativePath: 'reports/nested/audit-report.json',
    } as const;
    const target = join(temporaryRoot, 'reports', 'nested', 'audit-report.json');

    await expect(writeReportFile(request)).resolves.toEqual({
      format: 'json',
      relativePath: request.relativePath,
    });
    expect(await readFile(target)).toEqual(Buffer.from(defaultContent, 'utf8'));

    await expect(
      writeReportFile({
        ...request,
        content: '{"replacement":true}\n',
      }),
    ).rejects.toMatchObject({
      code: REPORT_WRITE_ERROR_CODES.targetExists,
    });
    expect(await readFile(target)).toEqual(Buffer.from(defaultContent, 'utf8'));
  });
});

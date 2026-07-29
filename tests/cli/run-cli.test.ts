import { describe, expect, it } from 'vitest';

import type { ScanProject, ScanProjectRequest } from '../../src/application/scan-project.js';
import { EXIT_CODES, runCli } from '../../src/cli/run-cli.js';
import { PRODUCT_VERSION } from '../../src/index.js';

const createIo = () => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    io: {
      writeErr: (value: string) => {
        stderr.push(value);
      },
      writeOut: (value: string) => {
        stdout.push(value);
      },
    },
    stderr,
    stdout,
  };
};

describe('runCli', () => {
  it('prints help without invoking the application request', async () => {
    const output = createIo();
    let invoked = false;
    const scanProject: ScanProject = (request) => {
      invoked = true;
      return Promise.resolve({ projectPath: request.projectPath });
    };

    const exitCode = await runCli(['--help'], { io: output.io, scanProject });

    expect(exitCode).toBe(EXIT_CODES.success);
    expect(invoked).toBe(false);
    expect(output.stdout.join('')).toContain('Usage: ux-audit');
    expect(output.stdout.join('')).toContain('scan <project-path>');
    expect(output.stderr).toEqual([]);
  });

  it('prints the product version', async () => {
    const output = createIo();
    const scanProject: ScanProject = (request) =>
      Promise.resolve({ projectPath: request.projectPath });

    const exitCode = await runCli(['--version'], { io: output.io, scanProject });

    expect(exitCode).toBe(EXIT_CODES.success);
    expect(output.stdout.join('').trim()).toBe(PRODUCT_VERSION);
    expect(output.stderr).toEqual([]);
  });

  it('delegates scan input to the application layer', async () => {
    const output = createIo();
    const requests: ScanProjectRequest[] = [];
    const scanProject: ScanProject = (request) => {
      requests.push(request);
      return Promise.resolve({ projectPath: '/canonical/project' });
    };

    const exitCode = await runCli(['scan', './project'], { io: output.io, scanProject });

    expect(exitCode).toBe(EXIT_CODES.success);
    expect(requests).toEqual([{ projectPath: './project' }]);
    expect(output.stdout.join('')).toBe('Scan request prepared: /canonical/project\n');
    expect(output.stderr).toEqual([]);
  });

  it('maps a missing required project path to an input error', async () => {
    const output = createIo();
    let invoked = false;
    const scanProject: ScanProject = (request) => {
      invoked = true;
      return Promise.resolve({ projectPath: request.projectPath });
    };

    const exitCode = await runCli(['scan'], { io: output.io, scanProject });

    expect(exitCode).toBe(EXIT_CODES.input);
    expect(invoked).toBe(false);
    expect(output.stderr.join('')).toContain("missing required argument 'project-path'");
  });

  it('maps unexpected application failures to an internal error', async () => {
    const output = createIo();
    const scanProject: ScanProject = () => Promise.reject(new Error('application failed'));

    const exitCode = await runCli(['scan', '.'], { io: output.io, scanProject });

    expect(exitCode).toBe(EXIT_CODES.internal);
    expect(output.stdout).toEqual([]);
    expect(output.stderr.join('')).toBe('Internal error: application failed\n');
  });

  it('does not expose unstructured rejection values', async () => {
    const output = createIo();
    const scanProject: ScanProject = () => {
      // Deliberately model an untrusted dependency that violates the Error rejection contract.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      return Promise.reject('sensitive rejection value');
    };

    const exitCode = await runCli(['scan', '.'], { io: output.io, scanProject });

    expect(exitCode).toBe(EXIT_CODES.internal);
    expect(output.stdout).toEqual([]);
    expect(output.stderr.join('')).toBe('Internal error: Unknown internal failure\n');
  });
});

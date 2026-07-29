import { describe, expect, it } from 'vitest';

import {
  SCAN_PROJECT_ERROR_CODES,
  ScanProjectError,
  type ScanProject,
  type ScanProjectRequest,
} from '../../src/application/scan-project.js';
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

  it('prints scan help without requiring a project path or invoking the application', async () => {
    const output = createIo();
    let invoked = false;
    const scanProject: ScanProject = (request) => {
      invoked = true;
      return Promise.resolve({ projectPath: request.projectPath });
    };

    const exitCode = await runCli(['scan', '--help'], { io: output.io, scanProject });

    expect(exitCode).toBe(EXIT_CODES.success);
    expect(invoked).toBe(false);
    expect(output.stdout.join('')).toContain('Usage: ux-audit scan');
    expect(output.stdout.join('')).toContain('<project-path>');
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
    expect(output.stdout.join('')).toBe('Project path validated: /canonical/project\n');
    expect(output.stderr).toEqual([]);
  });

  it('renders control and bidirectional characters in a canonical path as visible escapes', async () => {
    const output = createIo();
    const scanProject: ScanProject = () =>
      Promise.resolve({
        projectPath: '/project/\u001b[31mred\u001b]0;title\u0007\u009b\n\u2028\u202eroot',
      });

    const exitCode = await runCli(['scan', '.'], { io: output.io, scanProject });

    expect(exitCode).toBe(EXIT_CODES.success);
    expect(output.stdout.join('')).toBe(
      'Project path validated: /project/\\u001b[31mred\\u001b]0;title\\u0007\\u009b\\u000a\\u2028\\u202eroot\n',
    );
    expect(output.stdout.join('')).not.toContain('\u001b');
    expect(output.stdout.join('')).not.toContain('\u0007');
    expect(output.stdout.join('')).not.toContain('\u009b');
    expect(output.stdout.join('')).not.toContain('\u2028');
    expect(output.stdout.join('')).not.toContain('\u202e');
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

  it('maps an unknown command to an input error', async () => {
    const output = createIo();
    let invoked = false;
    const scanProject: ScanProject = (request) => {
      invoked = true;
      return Promise.resolve({ projectPath: request.projectPath });
    };

    const exitCode = await runCli(['unknown'], { io: output.io, scanProject });

    expect(exitCode).toBe(EXIT_CODES.input);
    expect(invoked).toBe(false);
    expect(output.stderr.join('')).toContain("unknown command 'unknown'");
  });

  it('neutralizes terminal controls and injected lines reflected by an unknown command', async () => {
    const output = createIo();
    const scanProject: ScanProject = (request) =>
      Promise.resolve({ projectPath: request.projectPath });

    const exitCode = await runCli(['unknown\u001b[31m\u0007\nforged-line'], {
      io: output.io,
      scanProject,
    });

    expect(exitCode).toBe(EXIT_CODES.input);
    expect(output.stderr.join('')).toContain(
      "unknown command 'unknown\\u001b[31m\\u0007\\u000aforged-line'",
    );
    expect(output.stderr.join('')).not.toContain('\u001b');
    expect(output.stderr.join('')).not.toContain('\u0007');
    expect(output.stderr.join('')).not.toContain('\nforged-line');
  });

  it('maps unexpected application failures to an internal error', async () => {
    const output = createIo();
    const scanProject: ScanProject = () => Promise.reject(new Error('application failed'));

    const exitCode = await runCli(['scan', '.'], { io: output.io, scanProject });

    expect(exitCode).toBe(EXIT_CODES.internal);
    expect(output.stdout).toEqual([]);
    expect(output.stderr.join('')).toBe('Internal error: application failed\n');
  });

  it('neutralizes terminal controls in unexpected error messages', async () => {
    const output = createIo();
    const scanProject: ScanProject = () =>
      Promise.reject(new Error('failure\u001b]52;c;payload\u0007\rhidden'));

    const exitCode = await runCli(['scan', '.'], { io: output.io, scanProject });

    expect(exitCode).toBe(EXIT_CODES.internal);
    expect(output.stdout).toEqual([]);
    expect(output.stderr.join('')).toBe(
      'Internal error: failure\\u001b]52;c;payload\\u0007\\u000dhidden\n',
    );
    expect(output.stderr.join('')).not.toContain('\u001b');
    expect(output.stderr.join('')).not.toContain('\u0007');
    expect(output.stderr.join('')).not.toContain('\r');
  });

  it('maps typed project-path failures to an input error', async () => {
    const output = createIo();
    const scanProject: ScanProject = () =>
      Promise.reject(
        new ScanProjectError(
          SCAN_PROJECT_ERROR_CODES.invalidPath,
          'Project path does not exist.',
          new Error('native details must stay hidden'),
        ),
      );

    const exitCode = await runCli(['scan', 'missing'], { io: output.io, scanProject });

    expect(exitCode).toBe(EXIT_CODES.input);
    expect(output.stdout).toEqual([]);
    expect(output.stderr.join('')).toBe('Project path does not exist.\n');
  });

  it('maps an unknown path-validation failure to an internal error', async () => {
    const output = createIo();
    const scanProject: ScanProject = () =>
      Promise.reject(
        new ScanProjectError(
          SCAN_PROJECT_ERROR_CODES.validationFailed,
          'Project path could not be validated.',
          new Error('native details must stay hidden'),
        ),
      );

    const exitCode = await runCli(['scan', 'project'], { io: output.io, scanProject });

    expect(exitCode).toBe(EXIT_CODES.internal);
    expect(output.stdout).toEqual([]);
    expect(output.stderr.join('')).toBe('Project path could not be validated.\n');
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

import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  AUDIT_PROJECT_ERROR_CODES,
  AuditProjectError,
  type AuditProject,
  type AuditProjectRequest,
  type AuditProjectResult,
} from '../../src/application/audit-project.js';
import type { AnalyzeProjectResult } from '../../src/application/analyze-project.js';
import type { ScanProject } from '../../src/application/scan-project.js';
import {
  CONFIGURATION_ERROR_CODES,
  ConfigurationError,
} from '../../src/configuration/configuration.js';
import { createAuditResult } from '../../src/domain/audit/audit-result.js';
import {
  PROJECT_PATH_ERROR_CODES,
  ProjectPathError,
} from '../../src/project/validate-project-path.js';
import {
  REPORT_WRITE_ERROR_CODES,
  ReportWriteError,
} from '../../src/reporting/files/write-report-file.js';
import { EXIT_CODES, runCli } from '../../src/cli/run-cli.js';
import {
  createAuditResultFixture,
  createAuditResultRequestFixture,
} from '../reporting/audit-result-fixture.js';

const projectRoot = path.resolve('controlled-cli-project');

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

const createAnalysis = (): AnalyzeProjectResult => ({
  discovery: {
    exclusions: [],
    files: [],
    issues: [],
    projectRoot,
  },
  inventory: {
    entries: [],
    projectRoot,
  },
  model: {
    componentLinks: [],
    components: [],
    files: [],
    jsxNodes: [],
  },
  parserErrors: [],
  parsingSummary: {
    components: 2,
    failedFiles: 0,
    jsxNodes: 7,
    parsedFiles: 3,
  },
  projectPath: projectRoot,
  sourceCandidates: [],
  summary: {
    discoveredFiles: 5,
    excludedEntries: 4,
    inventoryEntries: 5,
    recoverableErrors: 0,
    sourceCandidates: 3,
  },
});

const createAuditProjectResult = (
  overrides: Partial<AuditProjectResult> = {},
): AuditProjectResult => ({
  analysis: createAnalysis(),
  auditResult: createAuditResultFixture(),
  writtenReports: [],
  ...overrides,
});

const createUnusedScan = (): ScanProject =>
  vi.fn(() => {
    throw new Error('The legacy scan facade must not run when auditProject is available.');
  });

describe('runCli complete audit integration', () => {
  it('delegates a default scan without turning Commander defaults into CLI overrides', async () => {
    const output = createIo();
    const requests: AuditProjectRequest[] = [];
    const auditProject: AuditProject = (request) => {
      requests.push(request);
      return Promise.resolve(createAuditProjectResult());
    };

    const exitCode = await runCli(['scan', './project'], {
      auditProject,
      io: output.io,
      scanProject: createUnusedScan(),
    });

    expect(exitCode).toBe(EXIT_CODES.success);
    expect(requests).toEqual([{ projectPath: './project' }]);
    expect(output.stdout.join('')).toContain(`Project path validated: ${projectRoot}\n`);
    expect(output.stdout.join('')).toContain(
      'Discovery summary: discovered=5 inventory=5 candidates=3 exclusions=4 issues=0\n',
    );
    expect(output.stdout.join('')).toContain(
      'Parsing summary: parsed=3 failed=0 components=2 jsx=7\n',
    );
    expect(output.stderr).toEqual([]);
  });

  it('maps every documented option, deduplicates repeatable values, and expands all canonically', async () => {
    const output = createIo();
    const requests: AuditProjectRequest[] = [];
    const auditProject: AuditProject = (request) => {
      requests.push(request);
      return Promise.resolve(createAuditProjectResult());
    };

    const exitCode = await runCli(
      [
        'scan',
        './project',
        '--config',
        '../uxaudit.json',
        '--format',
        'json',
        '--format',
        'all',
        '--format',
        'json',
        '--output',
        'artifacts/audit',
        '--category',
        'seo',
        '--category',
        'accessibility',
        '--category',
        'seo',
        '--rule',
        'seo/multiple-h1',
        '--rule',
        'seo/multiple-h1',
        '--severity',
        'high',
        '--no-color',
        '--verbose',
      ],
      {
        auditProject,
        io: output.io,
        scanProject: createUnusedScan(),
      },
    );

    expect(exitCode).toBe(EXIT_CODES.success);
    expect(requests).toEqual([
      {
        configurationPath: '../uxaudit.json',
        overrides: {
          categories: ['seo', 'accessibility'],
          color: false,
          formats: ['terminal', 'json', 'html'],
          minimumSeverity: 'high',
          outputDirectory: 'artifacts/audit',
          ruleIds: ['seo/multiple-h1'],
          verbose: true,
        },
        projectPath: './project',
      },
    ]);
    expect(output.stderr).toEqual([]);
  });

  it('preserves the terminal reporter fixed ANSI while keeping completed findings at exit zero', async () => {
    const output = createIo();
    const auditProject: AuditProject = () => Promise.resolve(createAuditProjectResult());

    const exitCode = await runCli(['scan', './project'], {
      auditProject,
      io: output.io,
      scanProject: createUnusedScan(),
    });

    expect(exitCode).toBe(EXIT_CODES.success);
    expect(exitCode).not.toBe(EXIT_CODES.findingPolicy);
    expect(output.stdout.join('')).toContain('\u001b[');
    expect(output.stdout.join('')).toContain('Findings (2 displayed / 2 total)');
  });

  it('omits terminal rendering when only a file report is selected and claims only returned writes', async () => {
    const output = createIo();
    const request = createAuditResultRequestFixture();
    const auditResult = createAuditResult({
      ...request,
      configuration: {
        ...request.configuration,
        formats: ['json'],
      },
      reportPaths: {
        html: null,
        json: 'uxaudit-reports/audit-report.json',
      },
    });
    const auditProject: AuditProject = () =>
      Promise.resolve(
        createAuditProjectResult({
          auditResult,
          writtenReports: [
            {
              format: 'json',
              relativePath: 'uxaudit-reports/audit-report.json',
            },
          ],
        }),
      );

    const exitCode = await runCli(['scan', './project', '--format', 'json'], {
      auditProject,
      io: output.io,
      scanProject: createUnusedScan(),
    });

    expect(exitCode).toBe(EXIT_CODES.success);
    expect(output.stdout.join('')).not.toContain('Findings (');
    expect(output.stdout.join('')).toContain(
      'Report generated: json=uxaudit-reports/audit-report.json\n',
    );
    expect(output.stderr).toEqual([]);
  });

  it('neutralizes hostile report claims without treating configured targets as proof of writing', async () => {
    const output = createIo();
    const auditProject: AuditProject = () =>
      Promise.resolve(
        createAuditProjectResult({
          writtenReports: [
            {
              format: 'json',
              relativePath: 'reports/\u001b]0;forged\u0007\nline.json',
            },
          ],
        }),
      );

    const exitCode = await runCli(['scan', './project'], {
      auditProject,
      io: output.io,
      scanProject: createUnusedScan(),
    });

    expect(exitCode).toBe(EXIT_CODES.success);
    expect(output.stdout.join('')).toContain(
      'Report generated: json=reports/\\u001b]0;forged\\u0007\\u000aline.json\n',
    );
    expect(output.stdout.join('')).not.toContain('\u0007');
    expect(output.stdout.join('')).not.toContain('\nline.json');
  });

  it.each([
    [['scan', './project', '--format', 'xml'], '--format <format>'],
    [['scan', './project', '--category', 'security'], '--category <category>'],
    [['scan', './project', '--severity', 'urgent'], '--severity <severity>'],
  ] as const)(
    'maps invalid option values to input errors without invoking the audit',
    async (args, option) => {
      const output = createIo();
      const auditProject = vi.fn<AuditProject>();

      const exitCode = await runCli(args, {
        auditProject,
        io: output.io,
        scanProject: createUnusedScan(),
      });

      expect(exitCode).toBe(EXIT_CODES.input);
      expect(auditProject).not.toHaveBeenCalled();
      expect(output.stderr.join('')).toContain(option);
    },
  );

  it('lists every supported option in scan help without invoking the audit', async () => {
    const output = createIo();
    const auditProject = vi.fn<AuditProject>();

    const exitCode = await runCli(['scan', '--help'], {
      auditProject,
      io: output.io,
      scanProject: createUnusedScan(),
    });

    expect(exitCode).toBe(EXIT_CODES.success);
    expect(auditProject).not.toHaveBeenCalled();

    for (const option of [
      '--config <path>',
      '--format <format>',
      '--output <directory>',
      '--category <category>',
      '--rule <rule-id>',
      '--severity <severity>',
      '--no-color',
      '--verbose',
    ]) {
      expect(output.stdout.join('')).toContain(option);
    }
  });

  it.each([
    [
      new ProjectPathError(PROJECT_PATH_ERROR_CODES.notFound),
      EXIT_CODES.input,
      'Project path does not exist.',
    ],
    [
      new ProjectPathError(PROJECT_PATH_ERROR_CODES.validationFailed),
      EXIT_CODES.internal,
      'Project path could not be validated.',
    ],
    [
      new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidJson),
      EXIT_CODES.input,
      'The configuration file is not valid JSON.',
    ],
    [
      new ReportWriteError(REPORT_WRITE_ERROR_CODES.targetExists),
      EXIT_CODES.internal,
      'The report target already exists and was not overwritten.',
    ],
    [
      new AuditProjectError(AUDIT_PROJECT_ERROR_CODES.evaluationFailed),
      EXIT_CODES.internal,
      'Project rules could not be evaluated safely.',
    ],
  ] as const)(
    'maps the complete audit error boundary to its stable exit code',
    async (error, expectedCode, message) => {
      const output = createIo();
      const auditProject: AuditProject = () => Promise.reject(error);

      const exitCode = await runCli(['scan', './project'], {
        auditProject,
        io: output.io,
        scanProject: createUnusedScan(),
      });

      expect(exitCode).toBe(expectedCode);
      expect(output.stdout).toEqual([]);
      expect(output.stderr.join('')).toBe(`${message}\n`);
    },
  );
});

import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  AUDIT_PROJECT_ERROR_CODES,
  AuditProjectError,
  createAuditProject,
  type AuditProjectDependencies,
} from '../../src/application/audit-project.js';
import type { AnalyzeProjectResult } from '../../src/application/analyze-project.js';
import { SCAN_PROJECT_ERROR_CODES, ScanProjectError } from '../../src/application/scan-project.js';
import {
  CONFIGURATION_ERROR_CODES,
  CONFIGURATION_SCHEMA_VERSION,
  ConfigurationError,
  type AuditConfiguration,
} from '../../src/configuration/configuration.js';
import { createAuditResult } from '../../src/domain/audit/audit-result.js';
import type { RuleEvaluationResult } from '../../src/domain/rules/rule-evaluation-result.js';
import {
  PROJECT_PATH_ERROR_CODES,
  ProjectPathError,
} from '../../src/project/validate-project-path.js';
import {
  REPORT_WRITE_ERROR_CODES,
  ReportWriteError,
} from '../../src/reporting/files/write-report-file.js';
import { loadRules } from '../../src/rules/load-rules.js';

const projectRoot = path.resolve('controlled-audit-project');
const resolveAsync = <Value>(value: Value): Promise<Value> => Promise.resolve(value);
const rejectAsync = (error: Error): Promise<never> => Promise.reject(error);

const createConfiguration = (overrides: Partial<AuditConfiguration> = {}): AuditConfiguration => ({
  categories: null,
  color: false,
  formats: ['terminal'],
  minimumSeverity: 'info',
  outputDirectory: 'reports',
  ruleIds: null,
  schemaVersion: CONFIGURATION_SCHEMA_VERSION,
  verbose: false,
  ...overrides,
});

const createAnalysisResult = (): AnalyzeProjectResult => ({
  discovery: {
    exclusions: [],
    files: [],
    issues: [
      {
        code: 'DISCOVERY_NOT_ACCESSIBLE',
        operation: 'read-directory',
        recoverable: true,
        relativePath: 'private',
      },
    ],
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
  parserErrors: [
    {
      code: 'SOURCE_PARSE_FAILED',
      filePath: 'src/Broken.tsx',
      message: 'Source file contains invalid syntax.',
      position: { column: 2, line: 3, offset: 19 },
      recoverable: true,
      stage: 'parse',
    },
  ],
  parsingSummary: {
    components: 0,
    failedFiles: 1,
    jsxNodes: 0,
    parsedFiles: 1,
  },
  projectPath: projectRoot,
  sourceCandidates: [
    {
      absolutePath: path.join(projectRoot, 'src', 'App.tsx'),
      extension: '.tsx',
      kind: 'file',
      relativePath: 'src/App.tsx',
      sourceKind: 'typescript-jsx',
    },
    {
      absolutePath: path.join(projectRoot, 'src', 'Broken.tsx'),
      extension: '.tsx',
      kind: 'file',
      relativePath: 'src/Broken.tsx',
      sourceKind: 'typescript-jsx',
    },
  ],
  summary: {
    discoveredFiles: 3,
    excludedEntries: 2,
    inventoryEntries: 3,
    recoverableErrors: 1,
    sourceCandidates: 2,
  },
});

const createEvaluation = (
  overrides: Partial<RuleEvaluationResult['summary']> = {},
): RuleEvaluationResult => ({
  errors: [],
  findings: [],
  summary: {
    availableRuleCount: 8,
    enabledRuleCount: 8,
    executedRuleCount: 8,
    failedRuleCount: 0,
    findingCount: 0,
    succeededRuleCount: 8,
    ...overrides,
  },
});

const createDependencies = (
  overrides: Partial<AuditProjectDependencies> = {},
): AuditProjectDependencies => ({
  analyzeProject: () => resolveAsync(createAnalysisResult()),
  clock: {
    now: vi.fn().mockReturnValueOnce(1_774_953_600_000).mockReturnValue(1_774_953_600_125),
  },
  createResult: createAuditResult,
  evaluateRules: () => createEvaluation(),
  loadConfiguration: () => resolveAsync(createConfiguration()),
  loadRules,
  registry: { rules: [] },
  renderHtml: () => {
    throw new Error('HTML must not render for terminal-only configuration.');
  },
  renderJson: () => {
    throw new Error('JSON must not render for terminal-only configuration.');
  },
  validatePath: () => resolveAsync(projectRoot),
  writeReport: () =>
    rejectAsync(new Error('Reports must not be written for terminal-only configuration.')),
  ...overrides,
});

describe('createAuditProject', () => {
  it('composes configuration, one analysis, rules, one result, and selected reports in order', async () => {
    const order: string[] = [];
    const configuration = createConfiguration({
      formats: ['terminal', 'json', 'html'],
      verbose: true,
    });
    const analysis = createAnalysisResult();
    const evaluation = createEvaluation();
    const writes: { readonly content: string; readonly format: string; readonly path: string }[] =
      [];
    const loadRulesDependency: typeof loadRules = (request) => {
      order.push('load-rules');
      expect(request).toEqual({ registry: { rules: [] } });
      return {
        availableRuleCount: 8,
        rules: [],
      };
    };
    const dependencies = createDependencies({
      analyzeProject: (request) => {
        order.push('analyze');
        expect(request).toEqual({ projectPath: projectRoot });
        return resolveAsync(analysis);
      },
      clock: {
        now: vi
          .fn()
          .mockImplementationOnce(() => {
            order.push('clock-start');
            return 1_774_953_600_000;
          })
          .mockImplementationOnce(() => {
            order.push('clock-complete');
            return 1_774_953_600_125;
          }),
      },
      createResult: (request) => {
        order.push('create-result');
        return createAuditResult(request);
      },
      evaluateRules: (request) => {
        order.push('evaluate');
        expect(request.loadedRules).toEqual({
          availableRuleCount: 8,
          rules: [],
        });
        expect(request.model).toBe(analysis.model);
        return evaluation;
      },
      loadConfiguration: (request) => {
        order.push('configuration');
        expect(request).toEqual({
          configurationPath: '../audit.json',
          overrides: { verbose: true },
          projectRoot,
        });
        return resolveAsync(configuration);
      },
      loadRules: loadRulesDependency,
      renderHtml: (result) => {
        order.push('render-html');
        return `html:${result.schemaVersion}`;
      },
      renderJson: (result) => {
        order.push('render-json');
        return `json:${result.schemaVersion}`;
      },
      validatePath: (requestedPath) => {
        order.push('validate');
        expect(requestedPath).toBe('./project');
        return resolveAsync(projectRoot);
      },
      writeReport: (request) => {
        order.push(`write-${request.format}`);
        writes.push({
          content: request.content,
          format: request.format,
          path: request.relativePath,
        });
        return resolveAsync({
          format: request.format,
          relativePath: request.relativePath,
        });
      },
    });

    const result = await createAuditProject(dependencies)({
      configurationPath: '../audit.json',
      overrides: { verbose: true },
      projectPath: './project',
    });

    expect(order).toEqual([
      'clock-start',
      'validate',
      'configuration',
      'analyze',
      'load-rules',
      'evaluate',
      'clock-complete',
      'create-result',
      'render-json',
      'write-json',
      'render-html',
      'write-html',
    ]);
    expect(result.analysis).toBe(analysis);
    expect(result.auditResult.configuration).toEqual(configuration);
    expect(result.auditResult.summary.files).toEqual({
      discovered: 3,
      failed: 1,
      parsed: 1,
      selected: 2,
    });
    expect(result.auditResult.summary.errors).toEqual({
      byStage: {
        discovery: 1,
        extract: 0,
        parse: 1,
        read: 0,
        rule: 0,
      },
      total: 2,
    });
    expect(result.auditResult.reportPaths).toEqual({
      html: 'reports/audit-report.html',
      json: 'reports/audit-report.json',
    });
    expect(result.auditResult.timing).toEqual({
      completedAt: '2026-03-31T10:40:00.125Z',
      durationMs: 125,
      startedAt: '2026-03-31T10:40:00.000Z',
    });
    expect(writes).toEqual([
      {
        content: 'json:1.0.0',
        format: 'json',
        path: 'reports/audit-report.json',
      },
      {
        content: 'html:1.0.0',
        format: 'html',
        path: 'reports/audit-report.html',
      },
    ]);
    expect(result.writtenReports).toEqual([
      { format: 'json', relativePath: 'reports/audit-report.json' },
      { format: 'html', relativePath: 'reports/audit-report.html' },
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.writtenReports)).toBe(true);
  });

  it('preserves explicit empty rule filters instead of treating them as the stable catalog', async () => {
    let observedFilters: unknown;
    const loadRulesDependency: typeof loadRules = (request) => {
      observedFilters = request.filters;
      return {
        availableRuleCount: 8,
        rules: [],
      };
    };

    await createAuditProject(
      createDependencies({
        evaluateRules: () =>
          createEvaluation({
            enabledRuleCount: 0,
            executedRuleCount: 0,
            succeededRuleCount: 0,
          }),
        loadConfiguration: () =>
          resolveAsync(
            createConfiguration({
              categories: [],
              ruleIds: [],
            }),
          ),
        loadRules: loadRulesDependency,
      }),
    )({ projectPath: './project' });

    expect(observedFilters).toEqual({
      categories: [],
      ruleIds: [],
    });
  });

  it('omits each null filter independently while preserving the selected rule IDs', async () => {
    let observedFilters: unknown;
    const loadRulesDependency: typeof loadRules = (request) => {
      observedFilters = request.filters;
      return {
        availableRuleCount: 8,
        rules: [],
      };
    };

    await createAuditProject(
      createDependencies({
        evaluateRules: () =>
          createEvaluation({
            enabledRuleCount: 0,
            executedRuleCount: 0,
            succeededRuleCount: 0,
          }),
        loadConfiguration: () =>
          resolveAsync(
            createConfiguration({
              categories: null,
              ruleIds: ['seo/multiple-h1'],
            }),
          ),
        loadRules: loadRulesDependency,
      }),
    )({ projectPath: './project' });

    expect(observedFilters).toEqual({
      ruleIds: ['seo/multiple-h1'],
    });
  });

  it('omits a null rule-ID filter while preserving selected categories', async () => {
    let observedFilters: unknown;
    const loadRulesDependency: typeof loadRules = (request) => {
      observedFilters = request.filters;
      return {
        availableRuleCount: 8,
        rules: [],
      };
    };

    await createAuditProject(
      createDependencies({
        evaluateRules: () =>
          createEvaluation({
            enabledRuleCount: 0,
            executedRuleCount: 0,
            succeededRuleCount: 0,
          }),
        loadConfiguration: () =>
          resolveAsync(
            createConfiguration({
              categories: ['seo'],
              ruleIds: null,
            }),
          ),
        loadRules: loadRulesDependency,
      }),
    )({ projectPath: './project' });

    expect(observedFilters).toEqual({
      categories: ['seo'],
    });
  });

  it('retains a recoverable rule error in a successful completed audit result', async () => {
    const result = await createAuditProject(
      createDependencies({
        evaluateRules: () => ({
          errors: [
            {
              category: 'seo',
              code: 'RULE_EVALUATION_FAILED',
              message: 'Rule evaluation failed.',
              recoverable: true,
              ruleId: 'seo/multiple-h1',
            },
          ],
          findings: [],
          summary: {
            availableRuleCount: 8,
            enabledRuleCount: 8,
            executedRuleCount: 8,
            failedRuleCount: 1,
            findingCount: 0,
            succeededRuleCount: 7,
          },
        }),
      }),
    )({ projectPath: './project' });

    expect(result.auditResult.summary.errors.byStage.rule).toBe(1);
    expect(result.auditResult.errors).toContainEqual(
      expect.objectContaining({
        recoverable: true,
        ruleId: 'seo/multiple-h1',
        stage: 'rule',
      }),
    );
  });

  it('clamps a backward wall clock without including report persistence in timing', async () => {
    const clock = vi.fn().mockReturnValueOnce(2_000).mockReturnValue(1_000);
    const result = await createAuditProject(
      createDependencies({
        clock: { now: clock },
      }),
    )({ projectPath: './project' });

    expect(clock).toHaveBeenCalledTimes(2);
    expect(result.auditResult.timing.durationMs).toBe(0);
    expect(result.auditResult.timing.completedAt).toBe(result.auditResult.timing.startedAt);
  });

  it('stops before configuration and analysis when project validation fails', async () => {
    const loadConfiguration = vi.fn();
    const analyzeProject = vi.fn();
    const error = new ProjectPathError(PROJECT_PATH_ERROR_CODES.notFound);
    const audit = createAuditProject(
      createDependencies({
        analyzeProject,
        loadConfiguration,
        validatePath: () => rejectAsync(error),
      }),
    );

    await expect(audit({ projectPath: 'missing' })).rejects.toBe(error);
    expect(loadConfiguration).not.toHaveBeenCalled();
    expect(analyzeProject).not.toHaveBeenCalled();
  });

  it('preserves stable configuration errors and stops before source analysis', async () => {
    const analyzeProject = vi.fn();
    const error = new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidJson);
    const audit = createAuditProject(
      createDependencies({
        analyzeProject,
        loadConfiguration: () => rejectAsync(error),
      }),
    );

    await expect(audit({ projectPath: './project' })).rejects.toBe(error);
    expect(analyzeProject).not.toHaveBeenCalled();
  });

  it('fails closed when analysis changes the canonical project root', async () => {
    const audit = createAuditProject(
      createDependencies({
        analyzeProject: () =>
          resolveAsync({
            ...createAnalysisResult(),
            projectPath: path.resolve('other-project'),
          }),
      }),
    );

    await expect(audit({ projectPath: './project' })).rejects.toMatchObject({
      code: AUDIT_PROJECT_ERROR_CODES.analysisFailed,
      message: 'The complete project audit could not be analyzed.',
    });
  });

  it('treats root loss after initial authorization as a fatal pipeline failure', async () => {
    const audit = createAuditProject(
      createDependencies({
        analyzeProject: () =>
          rejectAsync(
            new ScanProjectError(
              SCAN_PROJECT_ERROR_CODES.invalidPath,
              'Project path does not exist.',
              new Error('root disappeared after configuration'),
            ),
          ),
      }),
    );

    await expect(audit({ projectPath: './project' })).rejects.toMatchObject({
      code: AUDIT_PROJECT_ERROR_CODES.analysisFailed,
      message: 'The complete project audit could not be analyzed.',
    });
  });

  it('preserves a stable report-write failure and never claims a result', async () => {
    const writeError = new ReportWriteError(REPORT_WRITE_ERROR_CODES.targetExists);
    const writeReport = vi.fn().mockRejectedValue(writeError);
    const audit = createAuditProject(
      createDependencies({
        loadConfiguration: () =>
          resolveAsync(
            createConfiguration({
              formats: ['json', 'html'],
            }),
          ),
        renderHtml: () => '<html></html>\n',
        renderJson: () => '{}\n',
        writeReport,
      }),
    );

    await expect(audit({ projectPath: './project' })).rejects.toBe(writeError);
    expect(writeReport).toHaveBeenCalledTimes(1);
    expect(writeReport).toHaveBeenCalledWith({
      content: '{}\n',
      format: 'json',
      projectRoot,
      relativePath: 'reports/audit-report.json',
    });
  });

  it('does not roll back or return claims when HTML fails after a completed JSON write', async () => {
    const writeError = new ReportWriteError(REPORT_WRITE_ERROR_CODES.writeFailed);
    const requests: string[] = [];
    const audit = createAuditProject(
      createDependencies({
        loadConfiguration: () =>
          resolveAsync(
            createConfiguration({
              formats: ['json', 'html'],
            }),
          ),
        renderHtml: () => '<html></html>\n',
        renderJson: () => '{}\n',
        writeReport: (request) => {
          requests.push(request.format);

          if (request.format === 'html') {
            return rejectAsync(writeError);
          }

          return resolveAsync({
            format: request.format,
            relativePath: request.relativePath,
          });
        },
      }),
    );

    await expect(audit({ projectPath: './project' })).rejects.toBe(writeError);
    expect(requests).toEqual(['json', 'html']);
  });

  it('normalizes an invalid writer success record to a detail-free report failure', async () => {
    const audit = createAuditProject(
      createDependencies({
        loadConfiguration: () =>
          resolveAsync(
            createConfiguration({
              formats: ['json'],
            }),
          ),
        renderJson: () => '{}\n',
        writeReport: () =>
          resolveAsync({
            format: 'html',
            relativePath: 'reports/audit-report.html',
          }),
      }),
    );

    await expect(audit({ projectPath: './project' })).rejects.toEqual(
      new AuditProjectError(AUDIT_PROJECT_ERROR_CODES.reportFailed),
    );
  });

  it('normalizes an unexpected reporter failure without exposing renderer detail', async () => {
    const audit = createAuditProject(
      createDependencies({
        loadConfiguration: () =>
          resolveAsync(
            createConfiguration({
              formats: ['json'],
            }),
          ),
        renderJson: () => {
          throw new Error('sensitive renderer detail');
        },
      }),
    );

    try {
      await audit({ projectPath: './project' });
      expect.unreachable('Expected the reporter failure to reject.');
    } catch (error) {
      expect(error).toMatchObject({
        code: AUDIT_PROJECT_ERROR_CODES.reportFailed,
      });
      expect(String(error)).not.toContain('sensitive renderer detail');
    }
  });

  it('does not misattribute a renderer-thrown writer error to report persistence', async () => {
    const injectedWriterError = new ReportWriteError(REPORT_WRITE_ERROR_CODES.targetExists);
    const audit = createAuditProject(
      createDependencies({
        loadConfiguration: () =>
          resolveAsync(
            createConfiguration({
              formats: ['json'],
            }),
          ),
        renderJson: () => {
          throw injectedWriterError;
        },
      }),
    );

    await expect(audit({ projectPath: './project' })).rejects.toEqual(
      new AuditProjectError(AUDIT_PROJECT_ERROR_CODES.reportFailed),
    );
  });

  it.each([
    ['validation', AUDIT_PROJECT_ERROR_CODES.validationFailed],
    ['configuration', AUDIT_PROJECT_ERROR_CODES.configurationFailed],
    ['analysis', AUDIT_PROJECT_ERROR_CODES.analysisFailed],
    ['rule-loading', AUDIT_PROJECT_ERROR_CODES.ruleLoadingFailed],
    ['evaluation', AUDIT_PROJECT_ERROR_CODES.evaluationFailed],
    ['result', AUDIT_PROJECT_ERROR_CODES.resultFailed],
  ] as const)(
    'normalizes unexpected %s failures without retaining their detail',
    async (stage, code) => {
      const failure = new Error('sensitive dependency detail');
      const overrides: Partial<AuditProjectDependencies> =
        stage === 'validation'
          ? {
              validatePath: () => rejectAsync(failure),
            }
          : stage === 'configuration'
            ? {
                loadConfiguration: () => rejectAsync(failure),
              }
            : stage === 'analysis'
              ? {
                  analyzeProject: () => rejectAsync(failure),
                }
              : stage === 'rule-loading'
                ? {
                    loadRules: () => {
                      throw failure;
                    },
                  }
                : stage === 'evaluation'
                  ? {
                      evaluateRules: () => {
                        throw failure;
                      },
                    }
                  : {
                      createResult: () => {
                        throw failure;
                      },
                    };

      const audit = createAuditProject(createDependencies(overrides));

      try {
        await audit({ projectPath: './project' });
        expect.unreachable('Expected the audit to reject.');
      } catch (error) {
        expect(error).toBeInstanceOf(AuditProjectError);
        expect(error).toMatchObject({ code });
        expect(error).not.toHaveProperty('cause');
        expect(String(error)).not.toContain('sensitive dependency detail');
      }
    },
  );
});

import {
  ConfigurationError,
  REPORT_FILE_NAMES,
  REPORT_FORMATS,
  type AuditConfiguration,
  type AuditConfigurationOverrides,
} from '../configuration/configuration.js';
import {
  loadAuditConfiguration,
  type LoadAuditConfiguration,
} from '../configuration/load-configuration.js';
import {
  createAuditResult,
  type AuditReportPaths,
  type AuditResult,
} from '../domain/audit/audit-result.js';
import type { RuleEvaluationResult } from '../domain/rules/rule-evaluation-result.js';
import {
  ProjectPathError,
  validateProjectPath,
  type ValidateProjectPath,
} from '../project/validate-project-path.js';
import { renderHtmlReport } from '../reporting/html/html-reporter.js';
import { renderJsonReport } from '../reporting/json/json-reporter.js';
import {
  ReportWriteError,
  writeReportFile,
  type FileReportFormat,
  type ReportFileWriter,
  type WrittenReport,
} from '../reporting/files/write-report-file.js';
import { evaluateRules, type EvaluateRulesRequest } from '../rules/evaluate-rules.js';
import { initialRuleRegistry } from '../rules/initial-rule-registry.js';
import { loadRules, type LoadedRuleSet } from '../rules/load-rules.js';
import type { RuleRegistry } from '../rules/rule-registry.js';
import {
  AnalyzeProjectError,
  analyzeProject,
  type AnalyzeProject,
  type AnalyzeProjectResult,
} from './analyze-project.js';
import { SCAN_PROJECT_ERROR_CODES, ScanProjectError } from './scan-project.js';

export const AUDIT_PROJECT_ERROR_CODES = Object.freeze({
  analysisFailed: 'AUDIT_PROJECT_ANALYSIS_FAILED',
  configurationFailed: 'AUDIT_PROJECT_CONFIGURATION_FAILED',
  evaluationFailed: 'AUDIT_PROJECT_EVALUATION_FAILED',
  reportFailed: 'AUDIT_PROJECT_REPORT_FAILED',
  resultFailed: 'AUDIT_PROJECT_RESULT_FAILED',
  ruleLoadingFailed: 'AUDIT_PROJECT_RULE_LOADING_FAILED',
  validationFailed: 'AUDIT_PROJECT_VALIDATION_FAILED',
} as const);

export type AuditProjectErrorCode =
  (typeof AUDIT_PROJECT_ERROR_CODES)[keyof typeof AUDIT_PROJECT_ERROR_CODES];

const AUDIT_PROJECT_ERROR_MESSAGES: Readonly<Record<AuditProjectErrorCode, string>> = Object.freeze(
  {
    [AUDIT_PROJECT_ERROR_CODES.analysisFailed]: 'The complete project audit could not be analyzed.',
    [AUDIT_PROJECT_ERROR_CODES.configurationFailed]:
      'Audit configuration could not be loaded safely.',
    [AUDIT_PROJECT_ERROR_CODES.evaluationFailed]: 'Project rules could not be evaluated safely.',
    [AUDIT_PROJECT_ERROR_CODES.reportFailed]: 'Configured reports could not be generated safely.',
    [AUDIT_PROJECT_ERROR_CODES.resultFailed]: 'The completed audit result could not be built.',
    [AUDIT_PROJECT_ERROR_CODES.ruleLoadingFailed]: 'Configured rules could not be loaded safely.',
    [AUDIT_PROJECT_ERROR_CODES.validationFailed]: 'Project path could not be validated.',
  },
);

export class AuditProjectError extends Error {
  public readonly code: AuditProjectErrorCode;

  public constructor(code: AuditProjectErrorCode) {
    super(AUDIT_PROJECT_ERROR_MESSAGES[code]);
    this.name = 'AuditProjectError';
    this.code = code;
  }
}

export interface AuditProjectRequest {
  readonly configurationPath?: string;
  readonly overrides?: AuditConfigurationOverrides;
  readonly projectPath: string;
}

export interface AuditProjectResult {
  readonly analysis: AnalyzeProjectResult;
  readonly auditResult: AuditResult;
  readonly writtenReports: readonly WrittenReport[];
}

export interface AuditProjectClock {
  readonly now: () => number;
}

export interface AuditProjectDependencies {
  readonly analyzeProject: AnalyzeProject;
  readonly clock: AuditProjectClock;
  readonly createResult: typeof createAuditResult;
  readonly evaluateRules: (request: EvaluateRulesRequest) => RuleEvaluationResult;
  readonly loadConfiguration: LoadAuditConfiguration;
  readonly loadRules: typeof loadRules;
  readonly registry: RuleRegistry;
  readonly renderHtml: (result: AuditResult) => string;
  readonly renderJson: (result: AuditResult) => string;
  readonly validatePath: ValidateProjectPath;
  readonly writeReport: ReportFileWriter;
}

export type AuditProject = (request: AuditProjectRequest) => Promise<AuditProjectResult>;

const systemClock: AuditProjectClock = Object.freeze({
  now: Date.now,
});

const createReportPaths = (configuration: AuditConfiguration): AuditReportPaths => ({
  html: configuration.formats.includes(REPORT_FORMATS.html)
    ? `${configuration.outputDirectory}/${REPORT_FILE_NAMES.html}`
    : null,
  json: configuration.formats.includes(REPORT_FORMATS.json)
    ? `${configuration.outputDirectory}/${REPORT_FILE_NAMES.json}`
    : null,
});

const createLoadedRuleSet = (
  configuration: AuditConfiguration,
  registry: RuleRegistry,
  load: typeof loadRules,
): LoadedRuleSet => {
  if (configuration.categories === null && configuration.ruleIds === null) {
    return load({ registry });
  }

  return load({
    filters: {
      ...(configuration.categories === null ? {} : { categories: configuration.categories }),
      ...(configuration.ruleIds === null ? {} : { ruleIds: configuration.ruleIds }),
    },
    registry,
  });
};

const writeConfiguredReport = async (
  format: FileReportFormat,
  result: AuditResult,
  dependencies: Pick<AuditProjectDependencies, 'renderHtml' | 'renderJson' | 'writeReport'>,
): Promise<WrittenReport> => {
  const relativePath = result.reportPaths[format];

  if (relativePath === null) {
    throw new AuditProjectError(AUDIT_PROJECT_ERROR_CODES.reportFailed);
  }

  let content: string;

  try {
    content =
      format === REPORT_FORMATS.json
        ? dependencies.renderJson(result)
        : dependencies.renderHtml(result);
  } catch {
    throw new AuditProjectError(AUDIT_PROJECT_ERROR_CODES.reportFailed);
  }

  let written: WrittenReport;

  try {
    written = await dependencies.writeReport({
      content,
      format,
      projectRoot: result.projectRoot,
      relativePath,
    });
  } catch (error) {
    if (error instanceof ReportWriteError) {
      throw error;
    }

    throw new AuditProjectError(AUDIT_PROJECT_ERROR_CODES.reportFailed);
  }

  if (written.format !== format || written.relativePath !== relativePath) {
    throw new AuditProjectError(AUDIT_PROJECT_ERROR_CODES.reportFailed);
  }

  return Object.freeze({
    format,
    relativePath,
  });
};

export const createAuditProject =
  (dependencies: AuditProjectDependencies): AuditProject =>
  async (request) => {
    const startedAtMilliseconds = dependencies.clock.now();
    let projectRoot: string;

    try {
      projectRoot = await dependencies.validatePath(request.projectPath);
    } catch (error) {
      if (error instanceof ProjectPathError) {
        throw error;
      }

      throw new AuditProjectError(AUDIT_PROJECT_ERROR_CODES.validationFailed);
    }

    let configuration: AuditConfiguration;

    try {
      configuration = await dependencies.loadConfiguration({
        ...(request.configurationPath === undefined
          ? {}
          : { configurationPath: request.configurationPath }),
        ...(request.overrides === undefined ? {} : { overrides: request.overrides }),
        projectRoot,
      });
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }

      throw new AuditProjectError(AUDIT_PROJECT_ERROR_CODES.configurationFailed);
    }

    let analysis: AnalyzeProjectResult;

    try {
      analysis = await dependencies.analyzeProject({ projectPath: projectRoot });
    } catch (error) {
      if (error instanceof AnalyzeProjectError) {
        throw error;
      }

      if (error instanceof ScanProjectError) {
        if (error.code === SCAN_PROJECT_ERROR_CODES.invalidPath) {
          throw new AuditProjectError(AUDIT_PROJECT_ERROR_CODES.analysisFailed);
        }

        throw error;
      }

      throw new AuditProjectError(AUDIT_PROJECT_ERROR_CODES.analysisFailed);
    }

    if (analysis.projectPath !== projectRoot) {
      throw new AuditProjectError(AUDIT_PROJECT_ERROR_CODES.analysisFailed);
    }

    let loadedRules: LoadedRuleSet;

    try {
      loadedRules = createLoadedRuleSet(
        configuration,
        dependencies.registry,
        dependencies.loadRules,
      );
    } catch {
      throw new AuditProjectError(AUDIT_PROJECT_ERROR_CODES.ruleLoadingFailed);
    }

    let evaluation: RuleEvaluationResult;

    try {
      evaluation = dependencies.evaluateRules({
        loadedRules,
        model: analysis.model,
      });
    } catch {
      throw new AuditProjectError(AUDIT_PROJECT_ERROR_CODES.evaluationFailed);
    }

    let auditResult: AuditResult;

    try {
      const observedCompletion = dependencies.clock.now();
      const completedAtMilliseconds = Math.max(startedAtMilliseconds, observedCompletion);

      auditResult = dependencies.createResult({
        configuration,
        discoveryIssues: analysis.discovery.issues,
        evaluation,
        files: {
          discovered: analysis.summary.discoveredFiles,
          failed: analysis.parsingSummary.failedFiles,
          parsed: analysis.parsingSummary.parsedFiles,
          selected: analysis.sourceCandidates.length,
        },
        parserErrors: analysis.parserErrors,
        projectRoot,
        reportPaths: createReportPaths(configuration),
        timing: {
          completedAt: new Date(completedAtMilliseconds).toISOString(),
          durationMs: completedAtMilliseconds - startedAtMilliseconds,
          startedAt: new Date(startedAtMilliseconds).toISOString(),
        },
      });
    } catch {
      throw new AuditProjectError(AUDIT_PROJECT_ERROR_CODES.resultFailed);
    }

    const writtenReports: WrittenReport[] = [];

    try {
      for (const format of configuration.formats) {
        if (format === REPORT_FORMATS.json || format === REPORT_FORMATS.html) {
          writtenReports.push(await writeConfiguredReport(format, auditResult, dependencies));
        }
      }
    } catch (error) {
      if (error instanceof AuditProjectError || error instanceof ReportWriteError) {
        throw error;
      }

      throw new AuditProjectError(AUDIT_PROJECT_ERROR_CODES.reportFailed);
    }

    return Object.freeze({
      analysis,
      auditResult,
      writtenReports: Object.freeze(writtenReports),
    });
  };

export const auditProject = createAuditProject({
  analyzeProject,
  clock: systemClock,
  createResult: createAuditResult,
  evaluateRules,
  loadConfiguration: loadAuditConfiguration,
  loadRules,
  registry: initialRuleRegistry,
  renderHtml: renderHtmlReport,
  renderJson: renderJsonReport,
  validatePath: validateProjectPath,
  writeReport: writeReportFile,
});

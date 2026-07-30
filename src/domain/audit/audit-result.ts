import { isAbsolute as isAbsolutePath } from 'node:path';

import {
  CONFIGURATION_SCHEMA_VERSION,
  REPORT_FILE_NAMES,
  REPORT_FORMATS,
  type AuditConfiguration,
  type ReportFormat,
} from '../../configuration/configuration.js';
import { isSafeOutputDirectory } from '../../configuration/configuration-validation.js';
import {
  SOURCE_PARSER_ERROR_CODES,
  type SourceParserError,
  type SourceParserErrorCode,
} from '../../parsing/parser-contracts.js';
import {
  DISCOVERY_ISSUE_CODES,
  DISCOVERY_OPERATIONS,
  type DiscoveryIssue,
  type DiscoveryIssueCode,
  type DiscoveryOperation,
} from '../../project/discovery/discovery-types.js';
import { PRODUCT_NAME, PRODUCT_VERSION } from '../../index.js';
import {
  RULE_EXECUTION_ERROR_CODES,
  type RuleExecutionError,
  type RuleExecutionErrorCode,
} from '../errors/rule-execution-error.js';
import type { Finding } from '../findings/finding.js';
import type { SourceLocation, SourcePosition } from '../models/source-location.js';
import type {
  RuleEvaluationResult,
  RuleEvaluationSummary,
} from '../rules/rule-evaluation-result.js';
import {
  FINDING_CONFIDENCES,
  RULE_CATEGORIES,
  RULE_SEVERITIES,
  type FindingConfidence,
  type RuleCategory,
  type RuleReference,
  type RuleSeverity,
} from '../rules/rule.js';
import {
  AUDIT_PROCESSING_ERROR_STAGES,
  createDiscoveryProcessingError,
  createRuleProcessingError,
  createSourceProcessingError,
  type AuditProcessingError,
  type AuditProcessingErrorStage,
} from './audit-processing-error.js';

export const AUDIT_RESULT_SCHEMA_VERSION = '1.0.0' as const;

export const AUDIT_RESULT_ERROR_CODES = Object.freeze({
  invalidInput: 'AUDIT_RESULT_INVALID',
} as const);

export class AuditResultInvariantError extends Error {
  public readonly code = AUDIT_RESULT_ERROR_CODES.invalidInput;

  public constructor() {
    super('Audit result input is invalid.');
    this.name = 'AuditResultInvariantError';
  }
}

export interface AuditFileSummary {
  readonly discovered: number;
  readonly failed: number;
  readonly parsed: number;
  readonly selected: number;
}

export interface AuditFindingSummary {
  readonly byCategory: Readonly<Record<RuleCategory, number>>;
  readonly bySeverity: Readonly<Record<RuleSeverity, number>>;
  readonly total: number;
}

export interface AuditErrorSummary {
  readonly byStage: Readonly<Record<AuditProcessingErrorStage, number>>;
  readonly total: number;
}

export interface AuditSummary {
  readonly errors: AuditErrorSummary;
  readonly files: AuditFileSummary;
  readonly findings: AuditFindingSummary;
  readonly rules: RuleEvaluationSummary;
}

export interface AuditTiming {
  readonly completedAt: string;
  readonly durationMs: number;
  readonly startedAt: string;
}

export interface AuditReportPaths {
  readonly html: null | string;
  readonly json: null | string;
}

export interface AuditToolMetadata {
  readonly name: typeof PRODUCT_NAME;
  readonly version: string;
}

export interface AuditResult {
  readonly configuration: AuditConfiguration;
  readonly errors: readonly AuditProcessingError[];
  readonly findings: readonly Finding[];
  readonly projectRoot: string;
  readonly reportPaths: AuditReportPaths;
  readonly schemaVersion: typeof AUDIT_RESULT_SCHEMA_VERSION;
  readonly summary: AuditSummary;
  readonly timing: AuditTiming;
  readonly tool: AuditToolMetadata;
}

export interface CreateAuditResultRequest {
  readonly configuration: AuditConfiguration;
  readonly discoveryIssues: readonly DiscoveryIssue[];
  readonly evaluation: RuleEvaluationResult;
  readonly files: AuditFileSummary;
  readonly parserErrors: readonly SourceParserError[];
  readonly projectRoot: string;
  readonly reportPaths: AuditReportPaths;
  readonly timing: AuditTiming;
  readonly toolVersion?: string;
}

const categories = Object.values(RULE_CATEGORIES);
const severities = Object.values(RULE_SEVERITIES);
const confidences = Object.values(FINDING_CONFIDENCES);
const reportFormats = Object.values(REPORT_FORMATS);
const discoveryIssueCodes = Object.values(DISCOVERY_ISSUE_CODES);
const discoveryOperations = Object.values(DISCOVERY_OPERATIONS);
const sourceParserErrorCodes = Object.values(SOURCE_PARSER_ERROR_CODES);
const ruleExecutionErrorCodes = Object.values(RULE_EXECUTION_ERROR_CODES);
const ruleIdPattern = /^[a-z]+\/[a-z0-9-]+$/u;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isUnknownArray = (value: unknown): value is readonly unknown[] => Array.isArray(value);

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const requireNonEmptyString = (value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AuditResultInvariantError();
  }

  return value;
};

const requireCanonicalText = (value: unknown): string => {
  const text = requireNonEmptyString(value);

  if (text !== text.trim()) {
    throw new AuditResultInvariantError();
  }

  return text;
};

const requirePosition = (value: unknown): SourcePosition => {
  if (!isRecord(value)) {
    throw new AuditResultInvariantError();
  }

  const column = value['column'];
  const line = value['line'];
  const offset = value['offset'];

  if (
    !isNonNegativeSafeInteger(column) ||
    !isNonNegativeSafeInteger(offset) ||
    !isNonNegativeSafeInteger(line) ||
    line < 1
  ) {
    throw new AuditResultInvariantError();
  }

  return { column, line, offset };
};

const requireLocation = (value: unknown): null | SourceLocation => {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new AuditResultInvariantError();
  }

  const filePath = requireNonEmptyString(value['filePath']);
  const start = requirePosition(value['start']);
  const end = requirePosition(value['end']);

  if (
    start.offset > end.offset ||
    start.line > end.line ||
    (start.line === end.line && start.column > end.column)
  ) {
    throw new AuditResultInvariantError();
  }

  return { end, filePath, start };
};

const requireReference = (value: unknown): null | RuleReference => {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new AuditResultInvariantError();
  }

  const label = requireCanonicalText(value['label']);
  const url = value['url'];
  let normalizedUrl: null | string = null;

  if (url !== null) {
    normalizedUrl = requireCanonicalText(url);
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(normalizedUrl);
    } catch {
      throw new AuditResultInvariantError();
    }

    if (
      (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') ||
      parsedUrl.username.length > 0 ||
      parsedUrl.password.length > 0
    ) {
      throw new AuditResultInvariantError();
    }
  }

  return { label, url: normalizedUrl };
};

const requireFinding = (value: unknown): Finding => {
  if (!isRecord(value)) {
    throw new AuditResultInvariantError();
  }

  const category = value['category'];
  const confidence = value['confidence'];
  const severity = value['severity'];
  const limitations = value['limitations'];
  const ruleId = value['ruleId'];

  if (
    typeof category !== 'string' ||
    !categories.includes(category as RuleCategory) ||
    typeof confidence !== 'string' ||
    !confidences.includes(confidence as FindingConfidence) ||
    typeof severity !== 'string' ||
    !severities.includes(severity as RuleSeverity) ||
    !isUnknownArray(limitations) ||
    limitations.length === 0 ||
    typeof ruleId !== 'string' ||
    !ruleIdPattern.test(ruleId) ||
    !ruleId.startsWith(`${category}/`)
  ) {
    throw new AuditResultInvariantError();
  }

  const normalizedLimitations = limitations.map((limitation) => requireCanonicalText(limitation));

  return {
    category: category as RuleCategory,
    confidence: confidence as FindingConfidence,
    explanation: requireCanonicalText(value['explanation']),
    limitations: normalizedLimitations,
    location: requireLocation(value['location']),
    message: requireCanonicalText(value['message']),
    recommendation: requireCanonicalText(value['recommendation']),
    reference: requireReference(value['reference']),
    ruleId,
    ruleTitle: requireCanonicalText(value['ruleTitle']),
    severity: severity as RuleSeverity,
  };
};

const compareOrdinal = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const compareFindings = (left: Finding, right: Finding): number => {
  const ruleDifference = compareOrdinal(left.ruleId, right.ruleId);

  if (ruleDifference !== 0) {
    return ruleDifference;
  }

  const fileDifference = compareOrdinal(
    left.location?.filePath ?? '',
    right.location?.filePath ?? '',
  );

  if (fileDifference !== 0) {
    return fileDifference;
  }

  const startDifference =
    (left.location?.start.offset ?? -1) - (right.location?.start.offset ?? -1);

  if (startDifference !== 0) {
    return startDifference;
  }

  const endDifference = (left.location?.end.offset ?? -1) - (right.location?.end.offset ?? -1);

  return endDifference === 0 ? compareOrdinal(left.message, right.message) : endDifference;
};

const requireUniqueArray = <T extends string>(
  value: unknown,
  isAllowed: (candidate: string) => candidate is T,
): readonly T[] => {
  if (!isUnknownArray(value)) {
    throw new AuditResultInvariantError();
  }

  const normalized: T[] = [];

  for (const candidate of value) {
    if (typeof candidate !== 'string' || candidate !== candidate.trim() || !isAllowed(candidate)) {
      throw new AuditResultInvariantError();
    }

    normalized.push(candidate);
  }

  if (new Set(normalized).size !== normalized.length) {
    throw new AuditResultInvariantError();
  }

  return normalized;
};

const requireNullableUniqueArray = <T extends string>(
  value: unknown,
  isAllowed: (candidate: string) => candidate is T,
): null | readonly T[] => (value === null ? null : requireUniqueArray(value, isAllowed));

const requireConfiguration = (value: unknown): AuditConfiguration => {
  if (!isRecord(value)) {
    throw new AuditResultInvariantError();
  }

  const schemaVersion = value['schemaVersion'];
  const color = value['color'];
  const verbose = value['verbose'];
  const minimumSeverity = value['minimumSeverity'];
  const outputDirectory = value['outputDirectory'];

  if (
    schemaVersion !== CONFIGURATION_SCHEMA_VERSION ||
    typeof color !== 'boolean' ||
    typeof verbose !== 'boolean' ||
    typeof minimumSeverity !== 'string' ||
    !severities.includes(minimumSeverity as RuleSeverity) ||
    typeof outputDirectory !== 'string' ||
    !isSafeOutputDirectory(outputDirectory)
  ) {
    throw new AuditResultInvariantError();
  }

  const formats = requireUniqueArray(value['formats'], (candidate): candidate is ReportFormat =>
    reportFormats.includes(candidate as ReportFormat),
  );

  if (formats.length === 0) {
    throw new AuditResultInvariantError();
  }

  return {
    categories: requireNullableUniqueArray(
      value['categories'],
      (candidate): candidate is RuleCategory => categories.includes(candidate as RuleCategory),
    ),
    color,
    formats,
    minimumSeverity: minimumSeverity as RuleSeverity,
    outputDirectory,
    ruleIds: requireNullableUniqueArray(value['ruleIds'], (candidate): candidate is string =>
      ruleIdPattern.test(candidate),
    ),
    schemaVersion,
    verbose,
  };
};

const requireIsoTimestamp = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new AuditResultInvariantError();
  }

  const time = Date.parse(value);

  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) {
    throw new AuditResultInvariantError();
  }

  return value;
};

const requireTiming = (value: unknown): AuditTiming => {
  if (!isRecord(value)) {
    throw new AuditResultInvariantError();
  }

  const startedAt = requireIsoTimestamp(value['startedAt']);
  const completedAt = requireIsoTimestamp(value['completedAt']);
  const durationMs = value['durationMs'];

  if (Date.parse(completedAt) < Date.parse(startedAt) || !isNonNegativeSafeInteger(durationMs)) {
    throw new AuditResultInvariantError();
  }

  return { completedAt, durationMs, startedAt };
};

const requireFiles = (value: unknown, parserErrorCount: number): AuditFileSummary => {
  if (!isRecord(value)) {
    throw new AuditResultInvariantError();
  }

  const discovered = value['discovered'];
  const failed = value['failed'];
  const parsed = value['parsed'];
  const selected = value['selected'];

  if (
    !isNonNegativeSafeInteger(discovered) ||
    !isNonNegativeSafeInteger(failed) ||
    !isNonNegativeSafeInteger(parsed) ||
    !isNonNegativeSafeInteger(selected) ||
    selected > discovered ||
    parsed + failed !== selected ||
    failed !== parserErrorCount
  ) {
    throw new AuditResultInvariantError();
  }

  return { discovered, failed, parsed, selected };
};

const requireRuleSummary = (
  value: unknown,
  findingCount: number,
  errorCount: number,
): RuleEvaluationSummary => {
  if (!isRecord(value)) {
    throw new AuditResultInvariantError();
  }

  const availableRuleCount = value['availableRuleCount'];
  const enabledRuleCount = value['enabledRuleCount'];
  const executedRuleCount = value['executedRuleCount'];
  const failedRuleCount = value['failedRuleCount'];
  const suppliedFindingCount = value['findingCount'];
  const succeededRuleCount = value['succeededRuleCount'];

  if (
    !isNonNegativeSafeInteger(availableRuleCount) ||
    !isNonNegativeSafeInteger(enabledRuleCount) ||
    !isNonNegativeSafeInteger(executedRuleCount) ||
    !isNonNegativeSafeInteger(failedRuleCount) ||
    !isNonNegativeSafeInteger(suppliedFindingCount) ||
    !isNonNegativeSafeInteger(succeededRuleCount) ||
    availableRuleCount < enabledRuleCount ||
    enabledRuleCount !== executedRuleCount ||
    executedRuleCount !== succeededRuleCount + failedRuleCount ||
    failedRuleCount !== errorCount ||
    suppliedFindingCount !== findingCount
  ) {
    throw new AuditResultInvariantError();
  }

  return {
    availableRuleCount,
    enabledRuleCount,
    executedRuleCount,
    failedRuleCount,
    findingCount: suppliedFindingCount,
    succeededRuleCount,
  };
};

const requireReportPaths = (
  value: unknown,
  configuration: AuditConfiguration,
): AuditReportPaths => {
  if (!isRecord(value)) {
    throw new AuditResultInvariantError();
  }

  const html = value['html'];
  const json = value['json'];
  const expectedHtml = `${configuration.outputDirectory}/${REPORT_FILE_NAMES.html}`;
  const expectedJson = `${configuration.outputDirectory}/${REPORT_FILE_NAMES.json}`;

  if (
    (html !== null && (typeof html !== 'string' || html !== expectedHtml)) ||
    (json !== null && (typeof json !== 'string' || json !== expectedJson)) ||
    configuration.formats.includes(REPORT_FORMATS.html) !== (html !== null) ||
    configuration.formats.includes(REPORT_FORMATS.json) !== (json !== null)
  ) {
    throw new AuditResultInvariantError();
  }

  return { html, json };
};

const requireProcessingError = (value: unknown): AuditProcessingError => {
  if (!isRecord(value) || value['recoverable'] !== true) {
    throw new AuditResultInvariantError();
  }

  const stage = value['stage'];
  const code = requireCanonicalText(value['code']);
  const message = requireCanonicalText(value['message']);

  if (stage === AUDIT_PROCESSING_ERROR_STAGES.discovery) {
    const operation = value['operation'];

    if (
      !discoveryIssueCodes.includes(code as DiscoveryIssueCode) ||
      typeof operation !== 'string' ||
      !discoveryOperations.includes(operation as DiscoveryOperation)
    ) {
      throw new AuditResultInvariantError();
    }

    return {
      code: code as DiscoveryIssueCode,
      filePath: requireNonEmptyString(value['filePath']),
      message,
      operation: operation as DiscoveryOperation,
      recoverable: true,
      stage,
    };
  }

  if (
    stage === AUDIT_PROCESSING_ERROR_STAGES.read ||
    stage === AUDIT_PROCESSING_ERROR_STAGES.parse ||
    stage === AUDIT_PROCESSING_ERROR_STAGES.extract
  ) {
    const position = value['position'];

    if (!sourceParserErrorCodes.includes(code as SourceParserErrorCode)) {
      throw new AuditResultInvariantError();
    }

    return {
      code: code as SourceParserErrorCode,
      filePath: requireNonEmptyString(value['filePath']),
      message,
      ...(position === undefined ? {} : { position: requirePosition(position) }),
      recoverable: true,
      stage,
    };
  }

  if (stage === AUDIT_PROCESSING_ERROR_STAGES.rule) {
    const category = value['category'];
    const ruleId = value['ruleId'];

    if (
      !ruleExecutionErrorCodes.includes(code as RuleExecutionErrorCode) ||
      typeof category !== 'string' ||
      !categories.includes(category as RuleCategory) ||
      typeof ruleId !== 'string' ||
      !ruleIdPattern.test(ruleId)
    ) {
      throw new AuditResultInvariantError();
    }

    return {
      category: category as RuleCategory,
      code: code as RuleExecutionErrorCode,
      message,
      recoverable: true,
      ruleId,
      stage,
    };
  }

  throw new AuditResultInvariantError();
};

const processingErrorIdentity = (error: AuditProcessingError): string =>
  error.stage === AUDIT_PROCESSING_ERROR_STAGES.rule
    ? `${error.stage}\u0000${error.ruleId}\u0000${error.code}`
    : `${error.stage}\u0000${error.filePath}\u0000${error.code}`;

const compareProcessingErrors = (left: AuditProcessingError, right: AuditProcessingError): number =>
  compareOrdinal(processingErrorIdentity(left), processingErrorIdentity(right));

const createFindingSummary = (findings: readonly Finding[]): AuditFindingSummary => {
  const byCategory: Record<RuleCategory, number> = {
    accessibility: 0,
    performance: 0,
    seo: 0,
    ux: 0,
  };
  const bySeverity: Record<RuleSeverity, number> = {
    critical: 0,
    high: 0,
    info: 0,
    low: 0,
    medium: 0,
  };

  for (const finding of findings) {
    byCategory[finding.category] += 1;
    bySeverity[finding.severity] += 1;
  }

  return { byCategory, bySeverity, total: findings.length };
};

const createErrorSummary = (errors: readonly AuditProcessingError[]): AuditErrorSummary => {
  const byStage: Record<AuditProcessingErrorStage, number> = {
    discovery: 0,
    extract: 0,
    parse: 0,
    read: 0,
    rule: 0,
  };

  for (const error of errors) {
    byStage[error.stage] += 1;
  }

  return { byStage, total: errors.length };
};

const deepFreeze = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return value;
  }

  seen.add(value);

  for (const child of Object.values(value)) {
    deepFreeze(child, seen);
  }

  return Object.freeze(value);
};

export const createAuditResult = (request: CreateAuditResultRequest): AuditResult => {
  try {
    const projectRoot = requireNonEmptyString(request.projectRoot);

    if (!isAbsolutePath(projectRoot)) {
      throw new AuditResultInvariantError();
    }

    const configuration = requireConfiguration(request.configuration);
    const timing = requireTiming(request.timing);
    const files = requireFiles(request.files, request.parserErrors.length);
    const findings = request.evaluation.findings.map(requireFinding).sort(compareFindings);
    const ruleErrors = request.evaluation.errors.map((error: RuleExecutionError) =>
      createRuleProcessingError(error),
    );
    const errors = [
      ...request.discoveryIssues.map(createDiscoveryProcessingError),
      ...request.parserErrors.map(createSourceProcessingError),
      ...ruleErrors,
    ]
      .map(requireProcessingError)
      .sort(compareProcessingErrors);
    const rules = requireRuleSummary(
      request.evaluation.summary,
      findings.length,
      ruleErrors.length,
    );
    const reportPaths = requireReportPaths(request.reportPaths, configuration);
    const toolVersion = request.toolVersion ?? PRODUCT_VERSION;

    requireCanonicalText(toolVersion);

    return deepFreeze({
      configuration,
      errors,
      findings,
      projectRoot,
      reportPaths,
      schemaVersion: AUDIT_RESULT_SCHEMA_VERSION,
      summary: {
        errors: createErrorSummary(errors),
        files,
        findings: createFindingSummary(findings),
        rules,
      },
      timing,
      tool: {
        name: PRODUCT_NAME,
        version: toolVersion,
      },
    });
  } catch {
    throw new AuditResultInvariantError();
  }
};

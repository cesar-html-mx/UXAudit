import { REPORT_FORMATS } from '../../configuration/configuration.js';
import {
  AUDIT_PROCESSING_ERROR_STAGES,
  type AuditProcessingError,
} from '../../domain/audit/audit-processing-error.js';
import type { AuditResult } from '../../domain/audit/audit-result.js';
import type { Finding } from '../../domain/findings/finding.js';
import type { SourceLocation, SourcePosition } from '../../domain/models/source-location.js';
import type { RuleSeverity } from '../../domain/rules/rule.js';
import { sanitizeTerminalValue } from '../../shared/sanitize-terminal.js';
import type { Reporter } from '../reporter.js';

const ANSI_RESET = '\u001b[0m';

const ANSI_BADGE_COLORS: Readonly<Record<BadgeTone, string>> = Object.freeze({
  critical: '\u001b[1;31m',
  error: '\u001b[35m',
  high: '\u001b[31m',
  info: '\u001b[34m',
  low: '\u001b[36m',
  medium: '\u001b[33m',
});

const SEVERITY_PRIORITY: Readonly<Record<RuleSeverity, number>> = Object.freeze({
  critical: 4,
  high: 3,
  info: 0,
  low: 1,
  medium: 2,
});

type BadgeTone = RuleSeverity | 'error';

const renderValue = (value: number | string): string => sanitizeTerminalValue(String(value));

const renderBadge = (value: string, tone: BadgeTone, color: boolean): string => {
  const badge = `[${renderValue(value.toUpperCase())}]`;

  return color ? `${ANSI_BADGE_COLORS[tone]}${badge}${ANSI_RESET}` : badge;
};

const renderSourceLocation = (location: null | SourceLocation): string =>
  location === null
    ? 'unavailable'
    : `${renderValue(location.filePath)}:${renderValue(location.start.line)}:${renderValue(
        location.start.column + 1,
      )}`;

const renderSourcePosition = (filePath: string, position?: SourcePosition): string =>
  position === undefined
    ? renderValue(filePath)
    : `${renderValue(filePath)}:${renderValue(position.line)}:${renderValue(position.column + 1)}`;

const renderFinding = (finding: Finding, ordinal: number, color: boolean): readonly string[] => {
  const lines = [
    `${renderValue(ordinal)}. ${renderBadge(finding.severity, finding.severity, color)} ${renderValue(
      finding.ruleTitle,
    )} (${renderValue(finding.ruleId)})`,
    `   Category: ${renderValue(finding.category)} | Confidence: ${renderValue(
      finding.confidence,
    )}`,
    `   Location: ${renderSourceLocation(finding.location)}`,
    `   Message: ${renderValue(finding.message)}`,
    `   Explanation: ${renderValue(finding.explanation)}`,
    `   Recommendation: ${renderValue(finding.recommendation)}`,
    '   Limitations:',
    ...finding.limitations.map((limitation) => `     - ${renderValue(limitation)}`),
  ];

  if (finding.reference === null) {
    lines.push('   Reference: none');
  } else if (finding.reference.url === null) {
    lines.push(`   Reference: ${renderValue(finding.reference.label)}`);
  } else {
    lines.push(
      `   Reference: ${renderValue(finding.reference.label)} (${renderValue(
        finding.reference.url,
      )})`,
    );
  }

  return lines;
};

const renderProcessingError = (
  error: AuditProcessingError,
  ordinal: number,
  color: boolean,
): readonly string[] => {
  const lines = [
    `${renderValue(ordinal)}. ${renderBadge(error.stage, 'error', color)} ${renderValue(error.code)}`,
  ];

  if (error.stage === AUDIT_PROCESSING_ERROR_STAGES.discovery) {
    lines.push(`   Target: ${renderValue(error.filePath)}`);
    lines.push(`   Operation: ${renderValue(error.operation)}`);
  } else if (error.stage === AUDIT_PROCESSING_ERROR_STAGES.rule) {
    lines.push(`   Rule: ${renderValue(error.ruleId)} (${renderValue(error.category)})`);
  } else {
    lines.push(`   Location: ${renderSourcePosition(error.filePath, error.position)}`);
  }

  lines.push(`   Message: ${renderValue(error.message)}`);

  return lines;
};

const meetsMinimumSeverity = (severity: RuleSeverity, minimum: RuleSeverity): boolean =>
  SEVERITY_PRIORITY[severity] >= SEVERITY_PRIORITY[minimum];

const appendRecords = <T>(
  lines: string[],
  records: readonly T[],
  render: (record: T, ordinal: number) => readonly string[],
): void => {
  records.forEach((record, index) => {
    if (index > 0) {
      lines.push('');
    }

    lines.push(...render(record, index + 1));
  });
};

export const renderTerminalReport = (result: AuditResult): string => {
  const { color, minimumSeverity, verbose } = result.configuration;
  const displayedFindings = result.findings.filter((finding) =>
    meetsMinimumSeverity(finding.severity, minimumSeverity),
  );
  const lines = [
    `${renderValue(result.tool.name)} ${renderValue(result.tool.version)}`,
    `Project: ${renderValue(result.projectRoot)}`,
    '',
    'Summary',
    `  Files: discovered=${renderValue(result.summary.files.discovered)} selected=${renderValue(
      result.summary.files.selected,
    )} parsed=${renderValue(result.summary.files.parsed)} failed=${renderValue(
      result.summary.files.failed,
    )}`,
    `  Rules: available=${renderValue(
      result.summary.rules.availableRuleCount,
    )} enabled=${renderValue(result.summary.rules.enabledRuleCount)} executed=${renderValue(
      result.summary.rules.executedRuleCount,
    )} succeeded=${renderValue(result.summary.rules.succeededRuleCount)} failed=${renderValue(
      result.summary.rules.failedRuleCount,
    )}`,
    `  Findings: total=${renderValue(result.summary.findings.total)} displayed=${renderValue(
      displayedFindings.length,
    )} minimum=${renderValue(minimumSeverity)}`,
    `  Severities (all): critical=${renderValue(
      result.summary.findings.bySeverity.critical,
    )} high=${renderValue(result.summary.findings.bySeverity.high)} medium=${renderValue(
      result.summary.findings.bySeverity.medium,
    )} low=${renderValue(result.summary.findings.bySeverity.low)} info=${renderValue(
      result.summary.findings.bySeverity.info,
    )}`,
    `  Categories (all): accessibility=${renderValue(
      result.summary.findings.byCategory.accessibility,
    )} performance=${renderValue(result.summary.findings.byCategory.performance)} seo=${renderValue(
      result.summary.findings.byCategory.seo,
    )} ux=${renderValue(result.summary.findings.byCategory.ux)}`,
    `  Processing errors: total=${renderValue(
      result.summary.errors.total,
    )} discovery=${renderValue(result.summary.errors.byStage.discovery)} read=${renderValue(
      result.summary.errors.byStage.read,
    )} parse=${renderValue(result.summary.errors.byStage.parse)} extract=${renderValue(
      result.summary.errors.byStage.extract,
    )} rule=${renderValue(result.summary.errors.byStage.rule)}`,
    '',
    `Findings (${renderValue(displayedFindings.length)} displayed / ${renderValue(
      result.summary.findings.total,
    )} total)`,
  ];

  if (displayedFindings.length === 0) {
    lines.push(
      result.summary.findings.total === 0
        ? '  No findings were reported.'
        : `  No findings meet the minimum severity (${renderValue(minimumSeverity)}).`,
    );
  } else {
    appendRecords(lines, displayedFindings, (finding, ordinal) =>
      renderFinding(finding, ordinal, color),
    );
  }

  if (verbose) {
    lines.push('', `Processing errors (${renderValue(result.errors.length)})`);

    if (result.errors.length === 0) {
      lines.push('  No recoverable processing errors were reported.');
    } else {
      appendRecords(lines, result.errors, (error, ordinal) =>
        renderProcessingError(error, ordinal, color),
      );
    }
  }

  return `${lines.join('\n')}\n`;
};

export const terminalReporter: Reporter = Object.freeze({
  format: REPORT_FORMATS.terminal,
  render: renderTerminalReport,
});

import { REPORT_FORMATS } from '../../configuration/configuration.js';
import {
  AUDIT_PROCESSING_ERROR_STAGES,
  type AuditProcessingError,
  type AuditProcessingErrorStage,
} from '../../domain/audit/audit-processing-error.js';
import type { AuditResult } from '../../domain/audit/audit-result.js';
import type { Finding } from '../../domain/findings/finding.js';
import type { SourceLocation, SourcePosition } from '../../domain/models/source-location.js';
import type { RuleSeverity } from '../../domain/rules/rule.js';
import { sanitizeTerminalValue } from '../../shared/sanitize-terminal.js';
import {
  REPORT_WRITE_ERROR_CODES,
  ReportWriteError,
  writeReportFile,
  type ReportFileWriter,
  type WrittenReport,
} from '../files/write-report-file.js';
import type { Reporter } from '../reporter.js';

export const HTML_REPORT_CONTENT_SECURITY_POLICY =
  "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'none'";

interface GroupDescriptor<T extends string> {
  readonly cssClass: string;
  readonly id: string;
  readonly label: string;
  readonly value: T;
}

interface TableRow {
  readonly label: string;
  readonly value: string;
}

const severityGroups: readonly GroupDescriptor<RuleSeverity>[] = Object.freeze([
  { cssClass: 'critical', id: 'critical-findings', label: 'Critical', value: 'critical' },
  { cssClass: 'high', id: 'high-findings', label: 'High', value: 'high' },
  { cssClass: 'medium', id: 'medium-findings', label: 'Medium', value: 'medium' },
  { cssClass: 'low', id: 'low-findings', label: 'Low', value: 'low' },
  { cssClass: 'info', id: 'info-findings', label: 'Info', value: 'info' },
]);

const errorStageGroups: readonly GroupDescriptor<AuditProcessingErrorStage>[] = Object.freeze([
  {
    cssClass: 'discovery',
    id: 'discovery-errors',
    label: 'Discovery',
    value: AUDIT_PROCESSING_ERROR_STAGES.discovery,
  },
  {
    cssClass: 'read',
    id: 'read-errors',
    label: 'Read',
    value: AUDIT_PROCESSING_ERROR_STAGES.read,
  },
  {
    cssClass: 'parse',
    id: 'parse-errors',
    label: 'Parse',
    value: AUDIT_PROCESSING_ERROR_STAGES.parse,
  },
  {
    cssClass: 'extract',
    id: 'extract-errors',
    label: 'Extract',
    value: AUDIT_PROCESSING_ERROR_STAGES.extract,
  },
  {
    cssClass: 'rule',
    id: 'rule-errors',
    label: 'Rule',
    value: AUDIT_PROCESSING_ERROR_STAGES.rule,
  },
]);

const htmlCharacterEntities: Readonly<Record<string, string>> = Object.freeze({
  '&': '&amp;',
  "'": '&#39;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
});

const escapeHtmlValue = (value: number | string): string =>
  sanitizeTerminalValue(String(value)).replace(
    /[&<>"']/gu,
    (character) => htmlCharacterEntities[character] ?? '',
  );

const renderCode = (value: boolean | number | string): string =>
  `<code>${escapeHtmlValue(String(value))}</code>`;

const renderTable = (caption: string, rows: readonly TableRow[]): readonly string[] => [
  '      <div class="table-wrap">',
  '        <table>',
  `          <caption>${escapeHtmlValue(caption)}</caption>`,
  '          <tbody>',
  ...rows.flatMap((row) => [
    '            <tr>',
    `              <th scope="row">${escapeHtmlValue(row.label)}</th>`,
    `              <td>${row.value}</td>`,
    '            </tr>',
  ]),
  '          </tbody>',
  '        </table>',
  '      </div>',
];

const renderSelection = (
  values: null | readonly string[],
  nullDescription: string,
  emptyDescription: string,
): string => {
  if (values === null) {
    return `<code>null</code> <span class="muted">(${escapeHtmlValue(nullDescription)})</span>`;
  }

  if (values.length === 0) {
    return `<code>[]</code> <span class="muted">(${escapeHtmlValue(emptyDescription)})</span>`;
  }

  return [
    '<ul class="compact-list">',
    ...values.map((value) => `  <li>${renderCode(value)}</li>`),
    '</ul>',
  ].join('\n');
};

const renderReportPath = (path: null | string): string =>
  path === null
    ? '<code>null</code> <span class="muted">(format not selected)</span>'
    : renderCode(path);

const renderLocation = (location: null | SourceLocation): string => {
  if (location === null) {
    return '<span class="muted">Unavailable (<code>null</code>)</span>';
  }

  return `${renderCode(location.filePath)}:${renderCode(location.start.line)}:${renderCode(
    location.start.column + 1,
  )} <span class="muted">(offset ${renderCode(
    location.start.offset,
  )})</span> &rarr; ${renderCode(location.end.line)}:${renderCode(
    location.end.column + 1,
  )} <span class="muted">(offset ${renderCode(location.end.offset)}; end exclusive)</span>`;
};

const renderSourcePosition = (filePath: string, position?: SourcePosition): string =>
  position === undefined
    ? `${renderCode(filePath)} <span class="muted">(position unavailable)</span>`
    : `${renderCode(filePath)}:${renderCode(position.line)}:${renderCode(
        position.column + 1,
      )} <span class="muted">(offset ${renderCode(position.offset)})</span>`;

const normalizeSafeReferenceUrl = (value: unknown): null | string => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value !== value.trim() ||
    !value.isWellFormed() ||
    sanitizeTerminalValue(value) !== value
  ) {
    return null;
  }

  try {
    const parsed = new URL(value);

    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.username.length === 0 &&
      parsed.password.length === 0
      ? parsed.href
      : null;
  } catch {
    return null;
  }
};

const renderReference = (finding: Finding): string => {
  if (finding.reference === null) {
    return '<span class="muted">None (<code>null</code>)</span>';
  }

  const label = escapeHtmlValue(finding.reference.label);
  const url: unknown = finding.reference.url;

  if (url === null) {
    return `${label} <span class="muted">(URL: <code>null</code>)</span>`;
  }

  const safeHref = normalizeSafeReferenceUrl(url);

  if (safeHref !== null && typeof url === 'string') {
    const escapedHref = escapeHtmlValue(safeHref);
    const escapedOriginalUrl = escapeHtmlValue(url);

    return `<a href="${escapedHref}" rel="noopener noreferrer" referrerpolicy="no-referrer">${label}</a> <span class="muted">(<code>${escapedOriginalUrl}</code>)</span>`;
  }

  const inertUrl = typeof url === 'string' ? escapeHtmlValue(url) : 'invalid URL value';

  return `${label} <span class="inert-reference">(<code>${inertUrl}</code>; link unavailable)</span>`;
};

const renderFinding = (
  finding: Finding,
  ordinal: number,
  group: GroupDescriptor<RuleSeverity>,
): readonly string[] => [
  '        <article class="finding">',
  '          <header class="record-header">',
  `            <span class="badge badge-${group.cssClass}">${group.label}</span>`,
  `            <h4>${escapeHtmlValue(finding.ruleTitle)}</h4>`,
  `            <span class="ordinal">#${escapeHtmlValue(ordinal)}</span>`,
  '          </header>',
  '          <dl class="record-facts">',
  `            <div><dt>Rule ID</dt><dd>${renderCode(finding.ruleId)}</dd></div>`,
  `            <div><dt>Category</dt><dd>${renderCode(finding.category)}</dd></div>`,
  `            <div><dt>Severity</dt><dd>${renderCode(finding.severity)}</dd></div>`,
  `            <div><dt>Confidence</dt><dd>${renderCode(finding.confidence)}</dd></div>`,
  `            <div><dt>Location</dt><dd>${renderLocation(finding.location)}</dd></div>`,
  '          </dl>',
  '          <h5>Message</h5>',
  `          <p>${escapeHtmlValue(finding.message)}</p>`,
  '          <h5>Explanation</h5>',
  `          <p>${escapeHtmlValue(finding.explanation)}</p>`,
  '          <h5>Recommendation</h5>',
  `          <p>${escapeHtmlValue(finding.recommendation)}</p>`,
  '          <h5>Limitations</h5>',
  '          <ul>',
  ...finding.limitations.map((limitation) => `            <li>${escapeHtmlValue(limitation)}</li>`),
  '          </ul>',
  '          <h5>Reference</h5>',
  `          <p>${renderReference(finding)}</p>`,
  '        </article>',
];

const renderFindingGroups = (result: AuditResult): readonly string[] =>
  severityGroups.flatMap((group) => {
    const findings = result.findings.filter((finding) => finding.severity === group.value);
    const lines = [
      `      <section class="record-group" aria-labelledby="${group.id}">`,
      `        <h3 id="${group.id}"><span class="badge badge-${group.cssClass}">${group.label}</span> ${renderCode(
        result.summary.findings.bySeverity[group.value],
      )}</h3>`,
    ];

    if (findings.length === 0) {
      lines.push('        <p class="empty-state">No findings in this severity bucket.</p>');
    } else {
      findings.forEach((finding, index) => {
        lines.push(...renderFinding(finding, index + 1, group));
      });
    }

    lines.push('      </section>');
    return lines;
  });

const renderProcessingError = (
  error: AuditProcessingError,
  ordinal: number,
  group: GroupDescriptor<AuditProcessingErrorStage>,
): readonly string[] => {
  const facts: string[] = [
    `            <div><dt>Stage</dt><dd>${renderCode(error.stage)}</dd></div>`,
    `            <div><dt>Code</dt><dd>${renderCode(error.code)}</dd></div>`,
    `            <div><dt>Recoverable</dt><dd>${renderCode(error.recoverable)}</dd></div>`,
  ];

  if (error.stage === AUDIT_PROCESSING_ERROR_STAGES.discovery) {
    facts.push(
      `            <div><dt>Target</dt><dd>${renderCode(error.filePath)}</dd></div>`,
      `            <div><dt>Operation</dt><dd>${renderCode(error.operation)}</dd></div>`,
    );
  } else if (error.stage === AUDIT_PROCESSING_ERROR_STAGES.rule) {
    facts.push(
      `            <div><dt>Rule ID</dt><dd>${renderCode(error.ruleId)}</dd></div>`,
      `            <div><dt>Category</dt><dd>${renderCode(error.category)}</dd></div>`,
    );
  } else {
    facts.push(
      `            <div><dt>Location</dt><dd>${renderSourcePosition(
        error.filePath,
        error.position,
      )}</dd></div>`,
    );
  }

  return [
    '        <article class="processing-error">',
    '          <header class="record-header">',
    `            <span class="badge badge-${group.cssClass}">${group.label}</span>`,
    `            <h4>${escapeHtmlValue(error.code)}</h4>`,
    `            <span class="ordinal">#${escapeHtmlValue(ordinal)}</span>`,
    '          </header>',
    '          <dl class="record-facts">',
    ...facts,
    '          </dl>',
    '          <h5>Message</h5>',
    `          <p>${escapeHtmlValue(error.message)}</p>`,
    '        </article>',
  ];
};

const renderErrorGroups = (result: AuditResult): readonly string[] =>
  errorStageGroups.flatMap((group) => {
    const errors = result.errors.filter((error) => error.stage === group.value);
    const lines = [
      `      <section class="record-group" aria-labelledby="${group.id}">`,
      `        <h3 id="${group.id}"><span class="badge badge-${group.cssClass}">${group.label}</span> ${renderCode(
        result.summary.errors.byStage[group.value],
      )}</h3>`,
    ];

    if (errors.length === 0) {
      lines.push('        <p class="empty-state">No errors in this processing-stage bucket.</p>');
    } else {
      errors.forEach((error, index) => {
        lines.push(...renderProcessingError(error, index + 1, group));
      });
    }

    lines.push('      </section>');
    return lines;
  });

const styleLines = [
  '    <style>',
  '      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; line-height: 1.5; }',
  '      * { box-sizing: border-box; }',
  '      body { margin: 0; background: Canvas; color: CanvasText; }',
  '      a { color: LinkText; overflow-wrap: anywhere; }',
  '      code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; overflow-wrap: anywhere; }',
  '      .page-header, main, footer { width: min(76rem, calc(100% - 2rem)); margin-inline: auto; }',
  '      .page-header { padding-block: 2.5rem 1.5rem; border-bottom: 0.25rem solid #2563eb; }',
  '      .eyebrow { margin: 0; color: #2563eb; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }',
  '      h1 { margin: 0.25rem 0; font-size: clamp(2rem, 6vw, 3.5rem); }',
  '      h2 { margin-top: 0; }',
  '      h3 { display: flex; align-items: center; gap: 0.6rem; }',
  '      h4, h5, p { margin-block: 0.5rem; }',
  '      main { padding-block: 1.5rem 3rem; }',
  '      main > section { margin-top: 1.5rem; padding: 1.25rem; border: 1px solid GrayText; border-radius: 0.65rem; }',
  '      .table-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr)); gap: 1rem; }',
  '      .table-wrap { overflow-x: auto; }',
  '      table { width: 100%; border-collapse: collapse; }',
  '      caption { padding: 0.6rem; background: #1d4ed8; color: white; font-weight: 700; text-align: left; }',
  '      th, td { padding: 0.55rem; border: 1px solid GrayText; text-align: left; vertical-align: top; }',
  '      th { width: 42%; }',
  '      .record-group { margin-top: 1.5rem; }',
  '      .finding, .processing-error { margin-top: 0.9rem; padding: 1rem; border: 1px solid GrayText; border-left: 0.4rem solid #64748b; border-radius: 0.5rem; }',
  '      .record-header { display: flex; align-items: center; flex-wrap: wrap; gap: 0.65rem; }',
  '      .record-header h4 { flex: 1 1 18rem; }',
  '      .badge { display: inline-block; padding: 0.15rem 0.55rem; border-radius: 999px; background: #475569; color: white; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; }',
  '      .badge-critical { background: #7f1d1d; }',
  '      .badge-high { background: #b91c1c; }',
  '      .badge-medium { background: #a16207; }',
  '      .badge-low { background: #0369a1; }',
  '      .badge-info { background: #475569; }',
  '      .badge-discovery, .badge-read, .badge-parse, .badge-extract, .badge-rule { background: #6b21a8; }',
  '      .ordinal, .muted, .inert-reference { color: GrayText; }',
  '      .record-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); gap: 0.5rem; margin-block: 0.75rem; }',
  '      .record-facts div { padding: 0.55rem; background: color-mix(in srgb, CanvasText 7%, Canvas); border-radius: 0.35rem; }',
  '      .record-facts dt { font-weight: 700; }',
  '      .record-facts dd { margin: 0.2rem 0 0; overflow-wrap: anywhere; }',
  '      .compact-list { margin: 0; padding-left: 1.2rem; }',
  '      .empty-state { padding: 0.75rem; border: 1px dashed GrayText; border-radius: 0.35rem; }',
  '      footer { padding-block: 1.5rem 2.5rem; border-top: 1px solid GrayText; }',
  '      @media print { .page-header, main, footer { width: 100%; } main > section { break-inside: avoid; } }',
  '    </style>',
] as const;

export const renderHtmlReport = (result: AuditResult): string => {
  const configurationRows: readonly TableRow[] = [
    { label: 'Schema version', value: renderCode(result.configuration.schemaVersion) },
    {
      label: 'Categories',
      value: renderSelection(
        result.configuration.categories,
        'stable catalog',
        'no categories selected',
      ),
    },
    {
      label: 'Rule IDs',
      value: renderSelection(result.configuration.ruleIds, 'stable catalog', 'no rules selected'),
    },
    {
      label: 'Formats',
      value: renderSelection(result.configuration.formats, 'not applicable', 'no formats selected'),
    },
    { label: 'Output directory', value: renderCode(result.configuration.outputDirectory) },
    { label: 'Minimum terminal severity', value: renderCode(result.configuration.minimumSeverity) },
    { label: 'Terminal color', value: renderCode(result.configuration.color) },
    { label: 'Verbose processing detail', value: renderCode(result.configuration.verbose) },
  ];
  const resultRows: readonly TableRow[] = [
    { label: 'AuditResult schema', value: renderCode(result.schemaVersion) },
    { label: 'Tool name', value: renderCode(result.tool.name) },
    { label: 'Tool version', value: renderCode(result.tool.version) },
    { label: 'Project root', value: renderCode(result.projectRoot) },
    { label: 'Started at', value: renderCode(result.timing.startedAt) },
    { label: 'Completed at', value: renderCode(result.timing.completedAt) },
    { label: 'Duration (ms)', value: renderCode(result.timing.durationMs) },
    { label: 'JSON report path', value: renderReportPath(result.reportPaths.json) },
    { label: 'HTML report path', value: renderReportPath(result.reportPaths.html) },
  ];
  const fileRows: readonly TableRow[] = [
    { label: 'Discovered', value: renderCode(result.summary.files.discovered) },
    { label: 'Selected', value: renderCode(result.summary.files.selected) },
    { label: 'Parsed', value: renderCode(result.summary.files.parsed) },
    { label: 'Failed', value: renderCode(result.summary.files.failed) },
  ];
  const ruleRows: readonly TableRow[] = [
    { label: 'Available', value: renderCode(result.summary.rules.availableRuleCount) },
    { label: 'Enabled', value: renderCode(result.summary.rules.enabledRuleCount) },
    { label: 'Executed', value: renderCode(result.summary.rules.executedRuleCount) },
    { label: 'Succeeded', value: renderCode(result.summary.rules.succeededRuleCount) },
    { label: 'Failed', value: renderCode(result.summary.rules.failedRuleCount) },
    { label: 'Findings', value: renderCode(result.summary.rules.findingCount) },
  ];
  const severityRows: readonly TableRow[] = [
    { label: 'Total', value: renderCode(result.summary.findings.total) },
    { label: 'Critical', value: renderCode(result.summary.findings.bySeverity.critical) },
    { label: 'High', value: renderCode(result.summary.findings.bySeverity.high) },
    { label: 'Medium', value: renderCode(result.summary.findings.bySeverity.medium) },
    { label: 'Low', value: renderCode(result.summary.findings.bySeverity.low) },
    { label: 'Info', value: renderCode(result.summary.findings.bySeverity.info) },
  ];
  const categoryRows: readonly TableRow[] = [
    {
      label: 'Accessibility',
      value: renderCode(result.summary.findings.byCategory.accessibility),
    },
    { label: 'Performance', value: renderCode(result.summary.findings.byCategory.performance) },
    { label: 'SEO', value: renderCode(result.summary.findings.byCategory.seo) },
    { label: 'UX', value: renderCode(result.summary.findings.byCategory.ux) },
  ];
  const errorRows: readonly TableRow[] = [
    { label: 'Total', value: renderCode(result.summary.errors.total) },
    { label: 'Discovery', value: renderCode(result.summary.errors.byStage.discovery) },
    { label: 'Read', value: renderCode(result.summary.errors.byStage.read) },
    { label: 'Parse', value: renderCode(result.summary.errors.byStage.parse) },
    { label: 'Extract', value: renderCode(result.summary.errors.byStage.extract) },
    { label: 'Rule', value: renderCode(result.summary.errors.byStage.rule) },
  ];
  const lines = [
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="utf-8">',
    `    <meta http-equiv="Content-Security-Policy" content="${HTML_REPORT_CONTENT_SECURITY_POLICY}">`,
    '    <meta name="viewport" content="width=device-width, initial-scale=1">',
    `    <title>${escapeHtmlValue(result.tool.name)} audit report</title>`,
    ...styleLines,
    '  </head>',
    '  <body>',
    '    <header class="page-header">',
    '      <p class="eyebrow">Static analysis report</p>',
    `      <h1>${escapeHtmlValue(result.tool.name)} audit report</h1>`,
    `      <p>Project: ${renderCode(result.projectRoot)}</p>`,
    '    </header>',
    '    <main>',
    '      <section aria-labelledby="overview-heading">',
    '        <h2 id="overview-heading">Audit overview</h2>',
    '        <div class="table-grid">',
    ...renderTable('Result metadata and report paths', resultRows),
    ...renderTable('Normalized configuration', configurationRows),
    '        </div>',
    '      </section>',
    '      <section aria-labelledby="summary-heading">',
    '        <h2 id="summary-heading">Complete summary</h2>',
    '        <div class="table-grid">',
    ...renderTable('File processing', fileRows),
    ...renderTable('Rule execution', ruleRows),
    ...renderTable('Findings by severity', severityRows),
    ...renderTable('Findings by category', categoryRows),
    ...renderTable('Processing errors by stage', errorRows),
    '        </div>',
    '      </section>',
    '      <section aria-labelledby="findings-heading">',
    `        <h2 id="findings-heading">Findings ${renderCode(result.summary.findings.total)}</h2>`,
    '        <p>All normalized findings are shown. The terminal minimum-severity setting does not filter this report.</p>',
    ...renderFindingGroups(result),
    '      </section>',
    '      <section aria-labelledby="errors-heading">',
    `        <h2 id="errors-heading">Recoverable processing errors ${renderCode(
      result.summary.errors.total,
    )}</h2>`,
    '        <p>Errors are grouped by their normalized processing stage.</p>',
    ...renderErrorGroups(result),
    '      </section>',
    '    </main>',
    '    <footer>',
    `      <p>Rendered from AuditResult schema ${renderCode(
      result.schemaVersion,
    )}. Stored locations use one-based lines and zero-based UTF-16 columns and offsets; this report displays columns as one-based, preserves offsets as zero-based, and keeps range ends exclusive.</p>`,
    '      <p>Absolute timestamps and duration are explicit result data and may vary between audit executions.</p>',
    '    </footer>',
    '  </body>',
    '</html>',
  ];

  return `${lines.join('\n')}\n`;
};

export const htmlReporter: Reporter = Object.freeze({
  format: REPORT_FORMATS.html,
  render: renderHtmlReport,
});

export const writeHtmlReport = async (
  result: AuditResult,
  writer: ReportFileWriter = writeReportFile,
): Promise<WrittenReport> => {
  const relativePath = result.reportPaths.html;

  if (relativePath === null) {
    throw new ReportWriteError(REPORT_WRITE_ERROR_CODES.invalidRequest);
  }

  return await writer({
    content: renderHtmlReport(result),
    format: REPORT_FORMATS.html,
    projectRoot: result.projectRoot,
    relativePath,
  });
};

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { format } from 'prettier';

import {
  CONFIGURATION_SCHEMA_VERSION,
  REPORT_FILE_NAMES,
} from '../dist/configuration/configuration.js';
import { createLoadAuditConfiguration } from '../dist/configuration/load-configuration.js';
import { createAuditResult } from '../dist/domain/audit/audit-result.js';
import {
  REPORT_WRITE_ERROR_CODES,
  ReportWriteError,
  writeReportFile,
} from '../dist/reporting/files/write-report-file.js';
import {
  HTML_REPORT_CONTENT_SECURITY_POLICY,
  htmlReporter,
  renderHtmlReport,
  writeHtmlReport,
} from '../dist/reporting/html/html-reporter.js';
import { jsonReporter, renderJsonReport } from '../dist/reporting/json/json-reporter.js';
import {
  renderTerminalReport,
  terminalReporter,
} from '../dist/reporting/terminal/terminal-reporter.js';
import { sanitizeTerminalValue } from '../dist/shared/sanitize-terminal.js';

const schemaVersion = 1;
const scenarioId = 'UXAUDIT-CONFIGURATION-REPORTING';
const repositoryRoot = process.cwd();
const hostileText = `<script>alert("reporting-validation")</script> & "double" 'single' \u0000\u001b
\ud800 valid-emoji-😀`;
const secondaryUnicodeText =
  'C1:\u0085 ARABIC:\u061c BIDI:\u202e ISOLATE:\u2066 BOM:\ufeff LINE:\u2028';
const controlledProjectRoot = '/controlled-project/security-project';
const outputDirectory = 'reports/validation';
const expectedRuleIds = [
  'accessibility/button-name',
  'accessibility/img-alt',
  'performance/img-lazy-loading',
  'seo/multiple-h1',
  'ux/small-inline-text',
];
const jsonFormatOptions = {
  endOfLine: 'lf',
  parser: 'json',
  printWidth: 100,
};
const allowedAnsiSequences = new Set([
  '\u001b[0m',
  '\u001b[1;31m',
  '\u001b[31m',
  '\u001b[33m',
  '\u001b[36m',
  '\u001b[34m',
  '\u001b[35m',
]);
const forbiddenControlPattern =
  // eslint-disable-next-line no-control-regex -- Retained scenario text permits structural LF only.
  /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069\ufeff]/u;

const digest = (content) => `sha256:${createHash('sha256').update(content).digest('hex')}`;
const toCanonicalJson = (value) => format(JSON.stringify(value, null, 2), jsonFormatOptions);
const escapeHtml = (value) =>
  sanitizeTerminalValue(String(value)).replace(
    /[&<>"']/gu,
    (character) =>
      ({
        '&': '&amp;',
        "'": '&#39;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
      })[character] ?? '',
  );

const parseOutputDirectory = (argumentsList) => {
  if (argumentsList.length === 0) {
    return undefined;
  }

  assert.deepEqual(
    argumentsList.slice(0, 1),
    ['--output'],
    'Only the optional --output <dir> argument is supported.',
  );
  assert.equal(argumentsList.length, 2, '--output requires exactly one directory.');
  assert.ok(argumentsList[1]?.trim(), '--output requires a non-empty directory.');

  return path.resolve(argumentsList[1]);
};

const location = (filePath, line, column, offset, width = 12) => ({
  end: {
    column: column + width,
    line,
    offset: offset + width,
  },
  filePath,
  start: {
    column,
    line,
    offset,
  },
});

const finding = ({
  category,
  confidence,
  filePath,
  line,
  offset,
  reference = null,
  ruleId,
  ruleTitle,
  severity,
}) => ({
  category,
  confidence,
  explanation: `Controlled explanation for ${ruleId}; hostile text is ${hostileText}.`,
  limitations: [`Static evidence for ${ruleId} does not claim rendered browser behavior.`],
  location: location(filePath, line, 4, offset),
  message: `Controlled ${severity} finding from ${ruleId}: ${hostileText}.`,
  recommendation: `Apply the documented ${ruleId} remediation and review the result.`,
  reference,
  ruleId,
  ruleTitle,
  severity,
});

const createControlledAuditResultRequest = (color = false) => {
  const configuration = {
    categories: null,
    color,
    formats: ['terminal', 'json', 'html'],
    minimumSeverity: 'info',
    outputDirectory,
    ruleIds: null,
    schemaVersion: CONFIGURATION_SCHEMA_VERSION,
    verbose: true,
  };
  const findings = [
    finding({
      category: 'ux',
      confidence: 'medium',
      filePath: 'src/Text.tsx',
      line: 23,
      offset: 420,
      ruleId: 'ux/small-inline-text',
      ruleTitle: 'Small inline text',
      severity: 'info',
    }),
    finding({
      category: 'seo',
      confidence: 'high',
      filePath: 'src/Headings.tsx',
      line: 18,
      offset: 310,
      reference: {
        label: `Structured headings ${hostileText}`,
        url: null,
      },
      ruleId: 'seo/multiple-h1',
      ruleTitle: 'Multiple H1 headings',
      severity: 'low',
    }),
    finding({
      category: 'performance',
      confidence: 'medium',
      filePath: 'src/Gallery.tsx',
      line: 14,
      offset: 240,
      ruleId: 'performance/img-lazy-loading',
      ruleTitle: 'Image lazy loading',
      severity: 'medium',
    }),
    finding({
      category: 'accessibility',
      confidence: 'high',
      filePath: 'src/Images.tsx',
      line: 9,
      offset: 130,
      reference: {
        label: `WCAG image alternatives ${hostileText}`,
        url: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html?source=reporting&mode=validation',
      },
      ruleId: 'accessibility/img-alt',
      ruleTitle: 'Image alternative text',
      severity: 'high',
    }),
    finding({
      category: 'accessibility',
      confidence: 'high',
      filePath: `src/${hostileText}.tsx`,
      line: 4,
      offset: 40,
      ruleId: 'accessibility/button-name',
      ruleTitle: `Button accessible name ${hostileText}`,
      severity: 'critical',
    }),
  ];

  return {
    configuration,
    discoveryIssues: [
      {
        code: 'DISCOVERY_NOT_ACCESSIBLE',
        operation: 'read-directory',
        recoverable: true,
        relativePath: `private/${hostileText}`,
      },
    ],
    evaluation: {
      errors: [
        {
          category: 'seo',
          code: 'RULE_EVALUATION_FAILED',
          message: 'Rule evaluation failed.',
          recoverable: true,
          ruleId: 'seo/scenario-failed-rule',
        },
      ],
      findings,
      summary: {
        availableRuleCount: 8,
        enabledRuleCount: 6,
        executedRuleCount: 6,
        failedRuleCount: 1,
        findingCount: findings.length,
        succeededRuleCount: 5,
      },
    },
    files: {
      discovered: 7,
      failed: 3,
      parsed: 2,
      selected: 5,
    },
    parserErrors: [
      {
        code: 'SOURCE_FILE_READ_FAILED',
        filePath: 'src/Unreadable.tsx',
        message: `Source file could not be read: ${hostileText}.`,
        recoverable: true,
        stage: 'read',
      },
      {
        code: 'SOURCE_PARSE_FAILED',
        filePath: 'src/Broken.tsx',
        message: `Source file contains invalid syntax: ${hostileText}.`,
        position: { column: 2, line: 3, offset: 19 },
        recoverable: true,
        stage: 'parse',
      },
      {
        code: 'SOURCE_EXTRACTION_FAILED',
        filePath: 'src/Unsupported.tsx',
        message: `Source extraction failed: ${hostileText}.`,
        position: { column: 1, line: 7, offset: 81 },
        recoverable: true,
        stage: 'extract',
      },
    ],
    projectRoot: controlledProjectRoot,
    reportPaths: {
      html: `${outputDirectory}/${REPORT_FILE_NAMES.html}`,
      json: `${outputDirectory}/${REPORT_FILE_NAMES.json}`,
    },
    timing: {
      completedAt: '2026-07-29T18:30:00.250Z',
      durationMs: 250,
      startedAt: '2026-07-29T18:30:00.000Z',
    },
    toolVersion: `0.1.0-validation-${hostileText}`,
  };
};

const createControlledAuditResult = (color = false) =>
  createAuditResult(createControlledAuditResultRequest(color));

const createSecondaryUnicodeResult = () => {
  const request = createControlledAuditResultRequest(false);
  const firstFinding = request.evaluation.findings[0];

  assert.ok(firstFinding);

  return createAuditResult({
    ...request,
    evaluation: {
      ...request.evaluation,
      findings: [
        {
          ...firstFinding,
          explanation: `Secondary Unicode explanation ${secondaryUnicodeText}.`,
          limitations: [`Secondary Unicode limitation ${secondaryUnicodeText}.`],
          message: `Secondary Unicode message ${secondaryUnicodeText}.`,
          recommendation: `Secondary Unicode recommendation ${secondaryUnicodeText}.`,
          ruleTitle: `Secondary Unicode title ${secondaryUnicodeText}.`,
        },
        ...request.evaluation.findings.slice(1),
      ],
    },
  });
};

const assertControlledResult = (result) => {
  assert.equal(result.schemaVersion, '1.0.0');
  assert.equal(result.projectRoot, controlledProjectRoot);
  assert.equal(result.configuration.color, false);
  assert.equal(result.configuration.minimumSeverity, 'info');
  assert.equal(result.configuration.verbose, true);
  assert.deepEqual(result.configuration.formats, ['terminal', 'json', 'html']);
  assert.deepEqual(result.reportPaths, {
    html: `${outputDirectory}/${REPORT_FILE_NAMES.html}`,
    json: `${outputDirectory}/${REPORT_FILE_NAMES.json}`,
  });
  assert.deepEqual(result.summary.files, {
    discovered: 7,
    failed: 3,
    parsed: 2,
    selected: 5,
  });
  assert.deepEqual(result.summary.findings.bySeverity, {
    critical: 1,
    high: 1,
    info: 1,
    low: 1,
    medium: 1,
  });
  assert.deepEqual(result.summary.findings.byCategory, {
    accessibility: 2,
    performance: 1,
    seo: 1,
    ux: 1,
  });
  assert.deepEqual(result.summary.errors.byStage, {
    discovery: 1,
    extract: 1,
    parse: 1,
    read: 1,
    rule: 1,
  });
  assert.deepEqual(
    result.findings.map(({ ruleId }) => ruleId),
    expectedRuleIds,
  );
  assert.deepEqual(
    result.errors.map(({ stage }) => stage),
    ['discovery', 'extract', 'parse', 'read', 'rule'],
  );
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.findings), true);
};

const captureConfigurationError = async (load) => {
  try {
    await load();
  } catch (error) {
    assert.equal(error?.name, 'ConfigurationError');
    assert.equal(error?.code, 'CONFIGURATION_INVALID');

    return {
      code: error.code,
      message: error.message,
      name: error.name,
    };
  }

  assert.fail('Invalid controlled configuration must fail.');
};

const buildConfigurationMatrix = async () => {
  const knownRuleIds = [...expectedRuleIds, 'performance/img-dimensions'];
  const load = async (fileValue, overrides) => {
    const loader = createLoadAuditConfiguration({
      knownRuleIds,
      readFile: async () => fileValue,
    });

    return await loader({
      ...(overrides === undefined ? {} : { overrides }),
      projectRoot: controlledProjectRoot,
    });
  };
  const defaults = await load(null);
  const fileOnly = await load(
    JSON.stringify({
      color: false,
      formats: ['html', 'json'],
      minimumSeverity: 'medium',
      outputDirectory: 'file-reports',
      ruleIds: ['seo/multiple-h1'],
      schemaVersion: CONFIGURATION_SCHEMA_VERSION,
      verbose: true,
    }),
  );
  const cliPrecedence = await load(
    JSON.stringify({
      categories: ['seo'],
      color: false,
      formats: ['json'],
      minimumSeverity: 'high',
      outputDirectory: 'file-reports',
      schemaVersion: CONFIGURATION_SCHEMA_VERSION,
      verbose: false,
    }),
    {
      categories: ['accessibility'],
      color: true,
      formats: ['terminal', 'html'],
      minimumSeverity: 'low',
      outputDirectory: 'cli-reports',
      ruleIds: ['accessibility/img-alt'],
      verbose: true,
    },
  );
  const emptyFilters = await load(
    JSON.stringify({
      categories: [],
      ruleIds: [],
      schemaVersion: CONFIGURATION_SCHEMA_VERSION,
    }),
  );
  const invalidUnknownKey = await captureConfigurationError(
    async () =>
      await load(
        JSON.stringify({
          schemaVersion: CONFIGURATION_SCHEMA_VERSION,
          unexpected: true,
        }),
      ),
  );

  assert.deepEqual(defaults.formats, ['terminal']);
  assert.equal(defaults.outputDirectory, 'uxaudit-reports');
  assert.deepEqual(fileOnly.formats, ['json', 'html']);
  assert.equal(fileOnly.minimumSeverity, 'medium');
  assert.deepEqual(cliPrecedence.categories, ['accessibility']);
  assert.deepEqual(cliPrecedence.formats, ['terminal', 'html']);
  assert.equal(cliPrecedence.outputDirectory, 'cli-reports');
  assert.deepEqual(emptyFilters.categories, []);
  assert.deepEqual(emptyFilters.ruleIds, []);
  assert.equal(Object.isFrozen(defaults), true);
  assert.equal(Object.isFrozen(cliPrecedence.formats), true);

  return {
    schemaVersion,
    scenarioId,
    cases: [
      {
        configuration: defaults,
        name: 'defaults-without-file',
        passed: true,
      },
      {
        configuration: fileOnly,
        name: 'valid-partial-file',
        passed: true,
      },
      {
        configuration: cliPrecedence,
        name: 'cli-over-file-precedence',
        passed: true,
      },
      {
        configuration: emptyFilters,
        name: 'explicit-empty-filters',
        passed: true,
      },
      {
        error: invalidUnknownKey,
        name: 'unknown-key-rejected',
        passed: true,
      },
    ],
    precedence: 'defaults < file < CLI',
  };
};

const renderReporterOutputs = (result) => {
  const json = renderJsonReport(result);
  const html = renderHtmlReport(result);
  const terminal = renderTerminalReport(result);

  assert.equal(jsonReporter.render(result), json);
  assert.equal(htmlReporter.render(result), html);
  assert.equal(terminalReporter.render(result), terminal);
  assert.equal(jsonReporter.format, 'json');
  assert.equal(htmlReporter.format, 'html');
  assert.equal(terminalReporter.format, 'terminal');

  return { html, json, terminal };
};

const validateCrossReporterConsistency = (result, outputs) => {
  const parsedJson = JSON.parse(outputs.json);
  const essentialRecords = {
    errors: result.errors,
    findings: result.findings.map((entry) => ({
      category: entry.category,
      confidence: entry.confidence,
      explanation: entry.explanation,
      limitations: entry.limitations,
      location: entry.location,
      message: entry.message,
      recommendation: entry.recommendation,
      reference: entry.reference,
      ruleId: entry.ruleId,
      ruleTitle: entry.ruleTitle,
      severity: entry.severity,
    })),
  };

  assert.deepEqual(parsedJson, result);

  for (const entry of result.findings) {
    for (const value of [
      entry.ruleId,
      entry.ruleTitle,
      entry.category,
      entry.severity,
      entry.confidence,
      entry.message,
      entry.explanation,
      entry.recommendation,
      ...entry.limitations,
      ...(entry.reference === null
        ? []
        : [entry.reference.label, ...(entry.reference.url === null ? [] : [entry.reference.url])]),
    ]) {
      assert.equal(outputs.terminal.includes(sanitizeTerminalValue(value)), true);
      assert.equal(outputs.html.includes(escapeHtml(value)), true);
    }

    if (entry.location !== null) {
      assert.equal(outputs.terminal.includes(sanitizeTerminalValue(entry.location.filePath)), true);
      assert.equal(outputs.html.includes(escapeHtml(entry.location.filePath)), true);
      assert.equal(
        outputs.terminal.includes(
          `${entry.location.start.line}:${entry.location.start.column + 1}`,
        ),
        true,
      );
      assert.equal(
        outputs.html.includes(
          `:<code>${entry.location.start.line}</code>:<code>${
            entry.location.start.column + 1
          }</code>`,
        ),
        true,
      );
      assert.equal(
        outputs.html.includes(
          `<code>${entry.location.end.line}</code>:<code>${entry.location.end.column + 1}</code>`,
        ),
        true,
      );
      assert.equal(
        outputs.html.includes(`(offset <code>${entry.location.start.offset}</code>)`),
        true,
      );
      assert.equal(
        outputs.html.includes(`(offset <code>${entry.location.end.offset}</code>; end exclusive)`),
        true,
      );
    }
  }

  for (const error of result.errors) {
    const commonValues = [error.stage, error.code, error.message];

    for (const value of commonValues) {
      assert.equal(outputs.terminal.includes(sanitizeTerminalValue(value)), true);
      assert.equal(outputs.html.includes(escapeHtml(value)), true);
    }

    if (error.stage === 'discovery') {
      for (const value of [error.filePath, error.operation]) {
        assert.equal(outputs.terminal.includes(sanitizeTerminalValue(value)), true);
        assert.equal(outputs.html.includes(escapeHtml(value)), true);
      }
    } else if (error.stage === 'rule') {
      for (const value of [error.ruleId, error.category]) {
        assert.equal(outputs.terminal.includes(sanitizeTerminalValue(value)), true);
        assert.equal(outputs.html.includes(escapeHtml(value)), true);
      }
    } else {
      assert.equal(outputs.terminal.includes(sanitizeTerminalValue(error.filePath)), true);
      assert.equal(outputs.html.includes(escapeHtml(error.filePath)), true);

      if (error.position !== undefined) {
        assert.equal(
          outputs.terminal.includes(`${error.position.line}:${error.position.column + 1}`),
          true,
        );
        assert.equal(
          outputs.html.includes(
            `:<code>${error.position.line}</code>:<code>${error.position.column + 1}</code>`,
          ),
          true,
        );
        assert.equal(outputs.html.includes(`(offset <code>${error.position.offset}</code>)`), true);
      }
    }
  }

  assert.equal(outputs.terminal.includes('Reference: none'), true);
  assert.equal(outputs.html.includes('None (<code>null</code>)'), true);
  assert.equal(outputs.html.includes('(position unavailable)'), true);
  assert.equal(outputs.html.includes('end exclusive'), true);
  assert.deepEqual(parsedJson.findings[0]?.location, result.findings[0]?.location);
  assert.deepEqual(parsedJson.errors, result.errors);

  assert.equal(outputs.terminal.includes('Files: discovered=7 selected=5 parsed=2 failed=3'), true);
  assert.equal(
    outputs.terminal.includes('Rules: available=8 enabled=6 executed=6 succeeded=5 failed=1'),
    true,
  );
  assert.equal(outputs.terminal.includes('Findings: total=5 displayed=5 minimum=info'), true);
  assert.equal(
    outputs.terminal.includes(
      'Processing errors: total=5 discovery=1 read=1 parse=1 extract=1 rule=1',
    ),
    true,
  );

  for (const value of [
    result.projectRoot,
    result.tool.name,
    result.tool.version,
    result.schemaVersion,
    result.timing.startedAt,
    result.timing.completedAt,
    String(result.timing.durationMs),
    result.configuration.outputDirectory,
    result.configuration.minimumSeverity,
    ...result.configuration.formats,
    result.reportPaths.json ?? '',
    result.reportPaths.html ?? '',
  ]) {
    assert.equal(outputs.html.includes(escapeHtml(value)), true);
  }
  for (const label of [
    'Result metadata and report paths',
    'Normalized configuration',
    'Started at',
    'Completed at',
    'Duration (ms)',
    'Complete summary',
    'File processing',
    'Rule execution',
    'Findings by severity',
    'Findings by category',
    'Processing errors by stage',
  ]) {
    assert.equal(outputs.html.includes(label), true);
  }

  return {
    schemaVersion,
    scenarioId,
    auditResultDigest: digest(outputs.json),
    comparedErrorFields: [
      'stage',
      'code',
      'message',
      'filePath/operation',
      'filePath/position',
      'ruleId/category',
    ],
    comparedFindingFields: [
      'ruleId',
      'ruleTitle',
      'category',
      'severity',
      'confidence',
      'location',
      'message',
      'explanation',
      'recommendation',
      'limitations',
      'reference',
    ],
    coordinateProjections: {
      html: 'half-open start/end lines, one-based display columns, and stored offsets',
      json: 'complete stored zero-based UTF-16 columns and offsets',
      terminal: 'start line and one-based display column',
    },
    coordinatePolicyValidated: true,
    essentialFindingAndErrorRecordDigest: digest(JSON.stringify(essentialRecords)),
    errorCount: result.errors.length,
    findingCount: result.findings.length,
    htmlContainsEssentialFindingAndErrorFields: true,
    htmlMetadataConfigurationAndSummaryValidated: true,
    jsonDeepEqualsAuditResult: true,
    sameAuditResultSuppliedToAllReporters: true,
    terminalContainsEssentialFindingAndErrorFields: true,
    terminalSummaryValidated: true,
  };
};

const validateColor = (noColorReport) => {
  const colorResult = createControlledAuditResult(true);
  const colorReport = renderTerminalReport(colorResult);
  // eslint-disable-next-line no-control-regex -- This assertion recognizes reporter-owned ANSI.
  const ansiSequences = colorReport.match(/\u001b\[[0-9;]*m/gu) ?? [];
  // eslint-disable-next-line no-control-regex -- This assertion strips only reporter-owned ANSI.
  const strippedReport = colorReport.replace(/\u001b\[[0-9;]*m/gu, '');
  const escapeCount = [...colorReport].filter((character) => character === '\u001b').length;

  assert.ok(ansiSequences.length > 0);
  assert.equal(
    ansiSequences.every((sequence) => allowedAnsiSequences.has(sequence)),
    true,
  );
  assert.equal(escapeCount, ansiSequences.length);
  assert.equal(strippedReport, noColorReport);
  assert.equal(noColorReport.includes('\u001b'), false);

  return {
    schemaVersion,
    scenarioId,
    ansiSequenceCount: ansiSequences.length,
    colorReportDigest: digest(colorReport),
    noColorReportDigest: digest(noColorReport),
    onlyReporterOwnedAnsi: true,
    rawAnsiRetained: false,
    strippedMatchesNoColor: true,
    strippedReportDigest: digest(strippedReport),
  };
};

const validateXssStructure = (html) => {
  const escapedPayload = escapeHtml(hostileText);
  const secondaryResult = createSecondaryUnicodeResult();
  const secondaryTerminal = renderTerminalReport(secondaryResult);
  const secondaryHtml = renderHtmlReport(secondaryResult);
  const secondaryUnsafeCharacters = ['\u0085', '\u061c', '\u202e', '\u2066', '\ufeff', '\u2028'];
  const secondaryVisibleEscapes = [
    '\\u0085',
    '\\u061c',
    '\\u202e',
    '\\u2066',
    '\\ufeff',
    '\\u2028',
  ];
  const hrefs = [...html.matchAll(/\shref="([^"]*)"/gu)].map((match) => match[1]);
  const forbiddenMarkupPattern = /<(?:script|iframe|object|embed|link|img)\b/iu;
  const externalCssPattern = /(?:@import|url\s*\()/iu;
  const eventHandlerPattern = /\son[a-z]+\s*=/iu;
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${HTML_REPORT_CONTENT_SECURITY_POLICY}">`;

  assert.equal(html.startsWith('<!doctype html>\n'), true);
  assert.equal(html.endsWith('\n'), true);
  assert.equal(html.includes(cspMeta), true);
  assert.equal(html.includes(hostileText), false);
  assert.equal(html.includes(escapedPayload), true);
  assert.equal(forbiddenMarkupPattern.test(html), false);
  assert.equal(externalCssPattern.test(html), false);
  assert.equal(eventHandlerPattern.test(html), false);
  assert.equal(
    secondaryUnsafeCharacters.every(
      (character) => !secondaryTerminal.includes(character) && !secondaryHtml.includes(character),
    ),
    true,
  );
  assert.equal(
    secondaryVisibleEscapes.every(
      (escaped) => secondaryTerminal.includes(escaped) && secondaryHtml.includes(escaped),
    ),
    true,
  );
  assert.deepEqual(hrefs, [
    'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html?source=reporting&amp;mode=validation',
  ]);

  return {
    schemaVersion,
    scenarioId,
    browserExecutionPerformed: false,
    contentSecurityPolicy: HTML_REPORT_CONTENT_SECURITY_POLICY,
    escapedHostilePayloadPresent: true,
    eventHandlerAttributesAbsent: true,
    externalAssetsAbsent: true,
    inlineScriptElementsAbsent: true,
    safeReferenceLinkCount: hrefs.length,
    secondaryUnicodeHtmlDigest: digest(secondaryHtml),
    secondaryUnicodeTerminalDigest: digest(secondaryTerminal),
    secondaryUnicodeValueCount: secondaryUnsafeCharacters.length,
    secondaryUnicodeValuesRenderedAsVisibleEscapes: true,
    secondaryUnicodeValuesRetained: false,
    unsafeMarkupAbsent: true,
    validationMethod:
      'Structural string assertions and CSP inspection only; no browser execution was performed.',
  };
};

const captureReportWriteError = async (operation, expectedCode) => {
  try {
    await operation();
  } catch (error) {
    assert.equal(error instanceof ReportWriteError, true);
    assert.equal(error.code, expectedCode);

    return {
      code: error.code,
      message: error.message,
      name: error.name,
    };
  }

  assert.fail(`Controlled report write must fail with ${expectedCode}.`);
};

const validateReportWrites = async ({ html, json, result, temporaryRoot }) => {
  const writeProjectRoot = path.join(temporaryRoot, 'write-project');

  await mkdir(writeProjectRoot);

  const jsonWritten = await writeReportFile({
    content: json,
    format: 'json',
    projectRoot: writeProjectRoot,
    relativePath: result.reportPaths.json,
  });
  const htmlWritten = await writeHtmlReport(
    result,
    async (request) =>
      await writeReportFile({
        ...request,
        projectRoot: writeProjectRoot,
      }),
  );
  const jsonTarget = path.join(writeProjectRoot, ...jsonWritten.relativePath.split('/'));
  const htmlTarget = path.join(writeProjectRoot, ...htmlWritten.relativePath.split('/'));
  const [writtenJson, writtenHtml] = await Promise.all([
    readFile(jsonTarget, 'utf8'),
    readFile(htmlTarget, 'utf8'),
  ]);

  assert.equal(writtenJson, json);
  assert.equal(writtenHtml, html);
  assert.deepEqual(jsonWritten, {
    format: 'json',
    relativePath: `${outputDirectory}/${REPORT_FILE_NAMES.json}`,
  });
  assert.deepEqual(htmlWritten, {
    format: 'html',
    relativePath: `${outputDirectory}/${REPORT_FILE_NAMES.html}`,
  });

  const existingTargetError = await captureReportWriteError(
    async () =>
      await writeReportFile({
        content: 'replacement must not be written',
        format: 'json',
        projectRoot: writeProjectRoot,
        relativePath: result.reportPaths.json,
      }),
    REPORT_WRITE_ERROR_CODES.targetExists,
  );
  const unsafePathError = await captureReportWriteError(
    async () =>
      await writeReportFile({
        content: json,
        format: 'json',
        projectRoot: writeProjectRoot,
        relativePath: '../outside/audit-report.json',
      }),
    REPORT_WRITE_ERROR_CODES.pathUnsafe,
  );
  const controlledFailure = await captureReportWriteError(
    async () =>
      await writeHtmlReport(result, async () => {
        throw new ReportWriteError(REPORT_WRITE_ERROR_CODES.writeFailed);
      }),
    REPORT_WRITE_ERROR_CODES.writeFailed,
  );

  assert.equal(await readFile(jsonTarget, 'utf8'), json);
  assert.equal(await readFile(htmlTarget, 'utf8'), html);

  return {
    schemaVersion,
    scenarioId,
    controlledFailure,
    existingTargetError,
    existingTargetPreserved: true,
    html: {
      contentDigest: digest(writtenHtml),
      exactContentWritten: true,
      format: htmlWritten.format,
      relativePath: htmlWritten.relativePath,
    },
    json: {
      contentDigest: digest(writtenJson),
      exactContentWritten: true,
      format: jsonWritten.format,
      relativePath: jsonWritten.relativePath,
    },
    successClaimReturnedOnlyAfterExactWrite: true,
    unsafePathError,
  };
};

const assertRetainedTextIsSafe = (content, label, volatilePaths) => {
  assert.equal(content.includes('\r'), false, `${label} must use LF line endings.`);
  assert.equal(content.isWellFormed(), true, `${label} must contain well-formed Unicode.`);
  assert.equal(forbiddenControlPattern.test(content), false, `${label} contains unsafe controls.`);

  for (const volatilePath of volatilePaths) {
    assert.equal(
      content.includes(volatilePath),
      false,
      `${label} must not contain an absolute temporary or repository path.`,
    );
  }
};

const writeScenarioOutputs = async ({
  artifacts,
  auditResultExpected,
  html,
  json,
  output,
  terminal,
  volatilePaths,
}) => {
  if (output === undefined) {
    return;
  }

  await mkdir(output, { recursive: true });

  const directArtifacts = {
    'audit-report.html': html,
    'audit-report.json': json,
    'audit-result-expected.json': auditResultExpected,
    'terminal-report.txt': terminal,
  };

  for (const [fileName, content] of Object.entries(directArtifacts)) {
    assertRetainedTextIsSafe(content, fileName, volatilePaths);
    await writeFile(path.join(output, fileName), content, 'utf8');
  }

  for (const [fileName, value] of Object.entries(artifacts)) {
    const content = await toCanonicalJson(value);

    assertRetainedTextIsSafe(content, fileName, volatilePaths);
    await writeFile(path.join(output, fileName), content, 'utf8');
  }
};

const output = parseOutputDirectory(process.argv.slice(2));
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'uxaudit-reporting-scenario-'));

try {
  const result = createControlledAuditResult();
  const independentlyPreparedResult = createControlledAuditResult();

  assertControlledResult(result);
  assertControlledResult(independentlyPreparedResult);
  assert.deepEqual(independentlyPreparedResult, result);

  const first = renderReporterOutputs(result);
  const second = renderReporterOutputs(result);
  const independent = renderReporterOutputs(independentlyPreparedResult);
  const auditResultExpected = renderJsonReport(independentlyPreparedResult);

  assert.equal(first.json, auditResultExpected);
  assert.equal(first.json, second.json);
  assert.equal(first.html, second.html);
  assert.equal(first.terminal, second.terminal);
  assert.equal(first.json, independent.json);
  assert.equal(first.html, independent.html);
  assert.equal(first.terminal, independent.terminal);
  assert.equal(first.json, `${JSON.stringify(result, null, 2)}\n`);

  const configurationMatrix = await buildConfigurationMatrix();
  const terminalColorValidation = validateColor(first.terminal);
  const crossReporterConsistency = validateCrossReporterConsistency(result, first);
  const xssValidation = validateXssStructure(first.html);
  const writePathValidation = await validateReportWrites({
    ...first,
    result,
    temporaryRoot,
  });
  const deterministicComparison = {
    schemaVersion,
    scenarioId,
    independentlyPreparedResultMatched: true,
    reports: {
      html: {
        byteIdentical: first.html === second.html && first.html === independent.html,
        firstDigest: digest(first.html),
        independentDigest: digest(independent.html),
        secondDigest: digest(second.html),
      },
      json: {
        byteIdentical: first.json === second.json && first.json === independent.json,
        expectedMatched: first.json === auditResultExpected,
        expectedDigest: digest(auditResultExpected),
        firstDigest: digest(first.json),
        independentDigest: digest(independent.json),
        secondDigest: digest(second.json),
      },
      terminal: {
        byteIdentical:
          first.terminal === second.terminal && first.terminal === independent.terminal,
        firstDigest: digest(first.terminal),
        independentDigest: digest(independent.terminal),
        secondDigest: digest(second.terminal),
      },
    },
    timingMetadataHeldConstant: true,
  };

  await writeScenarioOutputs({
    artifacts: {
      'configuration-matrix.json': configurationMatrix,
      'cross-reporter-consistency.json': crossReporterConsistency,
      'deterministic-comparison.json': deterministicComparison,
      'terminal-color-validation.json': terminalColorValidation,
      'write-path-validation.json': writePathValidation,
      'xss-validation.json': xssValidation,
    },
    auditResultExpected,
    html: first.html,
    json: first.json,
    output,
    terminal: first.terminal,
    volatilePaths: [repositoryRoot, temporaryRoot],
  });

  process.stdout.write(
    await toCanonicalJson({
      scenarioId,
      configurationCases: configurationMatrix.cases.length,
      crossReporterConsistent: crossReporterConsistency.sameAuditResultSuppliedToAllReporters,
      deterministic: Object.values(deterministicComparison.reports).every(
        ({ byteIdentical }) => byteIdentical,
      ),
      errors: result.errors.length,
      findings: result.findings.length,
      htmlStructurallySafe: xssValidation.unsafeMarkupAbsent,
      reportWritesValidated: writePathValidation.successClaimReturnedOnlyAfterExactWrite,
      targetCodeExecuted: false,
    }),
  );
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}

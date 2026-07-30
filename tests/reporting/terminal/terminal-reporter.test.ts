import { describe, expect, it } from 'vitest';

import type { AuditConfiguration } from '../../../src/configuration/configuration.js';
import { createAuditResult, type AuditResult } from '../../../src/domain/audit/audit-result.js';
import type { Finding } from '../../../src/domain/findings/finding.js';
import type { RuleSeverity } from '../../../src/domain/rules/rule.js';
import {
  renderTerminalReport,
  terminalReporter,
} from '../../../src/reporting/terminal/terminal-reporter.js';
import { createAuditResultRequestFixture } from '../audit-result-fixture.js';

// eslint-disable-next-line no-control-regex -- The test removes only reporter-owned ANSI sequences.
const ansiPattern = /\u001b\[[0-9;]*m/gu;

const createResultWithConfiguration = (overrides: Partial<AuditConfiguration>): AuditResult => {
  const request = createAuditResultRequestFixture();

  return createAuditResult({
    ...request,
    configuration: {
      ...request.configuration,
      ...overrides,
    },
  });
};

const createEmptyResult = (verbose: boolean): AuditResult => {
  const request = createAuditResultRequestFixture();

  return createAuditResult({
    ...request,
    configuration: {
      ...request.configuration,
      color: false,
      formats: ['terminal'],
      verbose,
    },
    discoveryIssues: [],
    evaluation: {
      errors: [],
      findings: [],
      summary: {
        availableRuleCount: 0,
        enabledRuleCount: 0,
        executedRuleCount: 0,
        failedRuleCount: 0,
        findingCount: 0,
        succeededRuleCount: 0,
      },
    },
    files: {
      discovered: 0,
      failed: 0,
      parsed: 0,
      selected: 0,
    },
    parserErrors: [],
    reportPaths: {
      html: null,
      json: null,
    },
  });
};

const expectedPlainReport = (result: AuditResult): string =>
  [
    'UXAudit 0.1.0-test',
    `Project: ${result.projectRoot}`,
    '',
    'Summary',
    '  Files: discovered=4 selected=2 parsed=1 failed=1',
    '  Rules: available=3 enabled=3 executed=3 succeeded=2 failed=1',
    '  Findings: total=2 displayed=2 minimum=info',
    '  Severities (all): critical=0 high=1 medium=1 low=0 info=0',
    '  Categories (all): accessibility=1 performance=1 seo=0 ux=0',
    '  Processing errors: total=3 discovery=1 read=0 parse=1 extract=0 rule=1',
    '',
    'Findings (2 displayed / 2 total)',
    '1. [HIGH] Image alternative text (accessibility/img-alt)',
    '   Category: accessibility | Confidence: high',
    '   Location: src/App.tsx:4:5',
    '   Message: Intrinsic image has no alt attribute.',
    '   Explanation: The element needs a text alternative.',
    '   Recommendation: Add a descriptive alt value.',
    '   Limitations:',
    '     - Custom components are outside this static scope.',
    '   Reference: WCAG 2.2 (https://www.w3.org/WAI/WCAG22/)',
    '',
    '2. [MEDIUM] Image lazy loading (performance/img-lazy-loading)',
    '   Category: performance | Confidence: high',
    '   Location: src/App.tsx:4:5',
    '   Message: Intrinsic image has no alt attribute.',
    '   Explanation: The element needs a text alternative.',
    '   Recommendation: Add a descriptive alt value.',
    '   Limitations:',
    '     - Custom components are outside this static scope.',
    '   Reference: WCAG 2.2 (https://www.w3.org/WAI/WCAG22/)',
    '',
    'Processing errors (3)',
    '1. [DISCOVERY] DISCOVERY_NOT_ACCESSIBLE',
    '   Target: private',
    '   Operation: read-directory',
    '   Message: Project entry was not accessible during discovery.',
    '',
    '2. [PARSE] SOURCE_PARSE_FAILED',
    '   Location: src/Broken.tsx:3:3',
    '   Message: Source file contains invalid syntax.',
    '',
    '3. [RULE] RULE_EVALUATION_FAILED',
    '   Rule: seo/multiple-h1 (seo)',
    '   Message: Rule evaluation failed.',
    '',
  ].join('\n');

describe('terminal reporter', () => {
  it('renders the exact stable no-color summary, findings, and verbose errors', () => {
    const result = createResultWithConfiguration({ color: false });

    expect(terminalReporter.format).toBe('terminal');
    expect(terminalReporter.render(result)).toBe(expectedPlainReport(result));
  });

  it('adds ANSI only around trusted badges and strips exactly to the no-color report', () => {
    const colorResult = createResultWithConfiguration({ color: true });
    const plainResult = createResultWithConfiguration({ color: false });
    const rendered = renderTerminalReport(colorResult);

    expect(rendered).toContain('\u001b[31m[HIGH]\u001b[0m');
    expect(rendered).toContain('\u001b[33m[MEDIUM]\u001b[0m');
    expect(rendered).toContain('\u001b[35m[DISCOVERY]\u001b[0m');
    expect(rendered.replace(ansiPattern, '')).toBe(renderTerminalReport(plainResult));
  });

  it.each([
    ['info', 2],
    ['low', 2],
    ['medium', 2],
    ['high', 1],
    ['critical', 0],
  ] as const)(
    'applies inclusive %s display threshold without changing totals',
    (severity, count) => {
      const result = createResultWithConfiguration({
        color: false,
        minimumSeverity: severity,
        verbose: false,
      });
      const rendered = renderTerminalReport(result);

      expect(rendered).toContain(
        `Findings: total=2 displayed=${String(count)} minimum=${severity}`,
      );
      expect(rendered).toContain(`Findings (${String(count)} displayed / 2 total)`);
    },
  );

  it('preserves canonical finding order instead of sorting by severity', () => {
    const request = createAuditResultRequestFixture();
    const findings = request.evaluation.findings.map((finding, index): Finding => ({
      ...finding,
      severity: index === 0 ? 'critical' : 'low',
    }));
    const result = createAuditResult({
      ...request,
      configuration: {
        ...request.configuration,
        color: false,
        verbose: false,
      },
      evaluation: {
        ...request.evaluation,
        findings,
      },
    });
    const rendered = renderTerminalReport(result);

    expect(rendered.indexOf('[LOW] Image alternative text')).toBeLessThan(
      rendered.indexOf('[CRITICAL] Image lazy loading'),
    );
  });

  it('renders explicit empty states and suppresses individual errors when not verbose', () => {
    const empty = renderTerminalReport(createEmptyResult(true));
    const concise = renderTerminalReport(
      createResultWithConfiguration({
        color: false,
        verbose: false,
      }),
    );

    expect(empty).toContain('No findings were reported.');
    expect(empty).toContain('No recoverable processing errors were reported.');
    expect(empty.endsWith('\n')).toBe(true);
    expect(empty.endsWith('\n\n')).toBe(false);
    expect(concise).toContain(
      'Processing errors: total=3 discovery=1 read=0 parse=1 extract=0 rule=1',
    );
    expect(concise).not.toContain('\nProcessing errors (3)');
    expect(concise).not.toContain('DISCOVERY_NOT_ACCESSIBLE');
  });

  it('renders unavailable locations and nullable reference forms', () => {
    const request = createAuditResultRequestFixture();
    const findings: readonly Finding[] = request.evaluation.findings.map((finding, index) => ({
      ...finding,
      location: null,
      reference:
        index === 0
          ? {
              label: 'Local guidance',
              url: null,
            }
          : null,
    }));
    const rendered = renderTerminalReport(
      createAuditResult({
        ...request,
        configuration: {
          ...request.configuration,
          color: false,
          verbose: false,
        },
        evaluation: {
          ...request.evaluation,
          findings,
        },
      }),
    );

    expect(rendered.match(/Location: unavailable/gu)).toHaveLength(2);
    expect(rendered).toContain('Reference: Local guidance');
    expect(rendered).toContain('Reference: none');
  });

  it('renders every source error stage and converts only display columns to one-based', () => {
    const request = createAuditResultRequestFixture();
    const parserErrors = [
      {
        code: 'SOURCE_FILE_READ_FAILED',
        filePath: 'src/Unreadable.tsx',
        message: 'Source file could not be read.',
        recoverable: true,
        stage: 'read',
      },
      ...request.parserErrors,
      {
        code: 'SOURCE_EXTRACTION_FAILED',
        filePath: 'src/Extract.tsx',
        message: 'Source extraction failed.',
        position: { column: 0, line: 9, offset: 40 },
        recoverable: true,
        stage: 'extract',
      },
    ] as const;
    const result = createAuditResult({
      ...request,
      configuration: {
        ...request.configuration,
        color: false,
      },
      files: {
        discovered: 4,
        failed: 3,
        parsed: 1,
        selected: 4,
      },
      parserErrors,
    });
    const rendered = renderTerminalReport(result);

    expect(rendered).toContain(
      'Processing errors: total=5 discovery=1 read=1 parse=1 extract=1 rule=1',
    );
    expect(rendered).toContain('[READ] SOURCE_FILE_READ_FAILED');
    expect(rendered).toContain('Location: src/Unreadable.tsx');
    expect(rendered).toContain('[EXTRACT] SOURCE_EXTRACTION_FAILED');
    expect(rendered).toContain('Location: src/Extract.tsx:9:1');
  });

  it('neutralizes hostile values and lone surrogates while preserving valid Unicode', () => {
    const request = createAuditResultRequestFixture();
    const firstFinding = request.evaluation.findings[0];
    const secondFinding = request.evaluation.findings[1];

    if (firstFinding === undefined || secondFinding === undefined) {
      throw new TypeError(
        'The terminal fixture must contain two findings and one source location.',
      );
    }

    if (firstFinding.location === null) {
      throw new TypeError('The first terminal fixture finding must have a source location.');
    }

    const hostileFinding: Finding = {
      ...firstFinding,
      explanation: 'explain\u001b[31m',
      limitations: ['limit\u000dline\ud800'],
      location: {
        ...firstFinding.location,
        filePath: 'src/\u202efile\nname-😀.tsx',
      },
      message: 'message\nforged\u009b',
      recommendation: 'recommend\u2066hidden',
      reference: {
        label: 'label\u0007alert',
        url: null,
      },
      ruleTitle: 'title\u001b]0;owned',
    };
    const result = createAuditResult({
      ...request,
      configuration: {
        ...request.configuration,
        color: false,
        verbose: false,
      },
      evaluation: {
        ...request.evaluation,
        findings: [hostileFinding, secondFinding],
      },
      projectRoot: `${request.projectRoot}\nforged-root`,
      toolVersion: '0.1.0\u001b[2J-test',
    });
    const rendered = renderTerminalReport(result);

    expect(rendered).not.toMatch(
      // eslint-disable-next-line no-control-regex -- Raw terminal controls must not survive.
      /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u202e\u2066\ud800]/u,
    );
    expect(rendered).toContain('\\u000a');
    expect(rendered).toContain('\\u001b');
    expect(rendered).toContain('\\u202e');
    expect(rendered).toContain('\\u2066');
    expect(rendered).toContain('\\ud800');
    expect(rendered).toContain('😀');
    expect(rendered).not.toContain('\nforged-root');
  });

  it('is byte-deterministic and does not mutate the frozen result', () => {
    const result = createResultWithConfiguration({ color: false });
    const before = JSON.stringify(result);
    const first = renderTerminalReport(result);
    const second = renderTerminalReport(result);

    expect(first).toBe(second);
    expect(JSON.stringify(result)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.findings)).toBe(true);
  });
});

describe('terminal severity contract', () => {
  it('keeps every supported severity in the explicit threshold matrix', () => {
    const severities: readonly RuleSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

    for (const severity of severities) {
      expect(() =>
        renderTerminalReport(
          createResultWithConfiguration({
            color: false,
            minimumSeverity: severity,
          }),
        ),
      ).not.toThrow();
    }
  });
});

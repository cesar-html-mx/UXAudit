import { createHash } from 'node:crypto';

import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import type { AuditConfiguration } from '../../../src/configuration/configuration.js';
import { createAuditResult, type AuditResult } from '../../../src/domain/audit/audit-result.js';
import type { Finding } from '../../../src/domain/findings/finding.js';
import {
  HTML_REPORT_CONTENT_SECURITY_POLICY,
  htmlReporter,
  renderHtmlReport,
  writeHtmlReport,
} from '../../../src/reporting/html/html-reporter.js';
import { renderJsonReport } from '../../../src/reporting/json/json-reporter.js';
import type { Reporter } from '../../../src/reporting/reporter.js';
import {
  REPORT_WRITE_ERROR_CODES,
  ReportWriteError,
  type ReportFileWriter,
} from '../../../src/reporting/files/write-report-file.js';
import { renderTerminalReport } from '../../../src/reporting/terminal/terminal-reporter.js';
import {
  createAuditResultFixture,
  createAuditResultRequestFixture,
} from '../audit-result-fixture.js';

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

const createEmptyHtmlResult = (emptyFilters: boolean): AuditResult => {
  const request = createAuditResultRequestFixture();

  return createAuditResult({
    ...request,
    configuration: {
      ...request.configuration,
      categories: emptyFilters ? [] : null,
      color: false,
      formats: ['html'],
      minimumSeverity: 'critical',
      ruleIds: emptyFilters ? [] : null,
      verbose: false,
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
      html: request.reportPaths.html,
      json: null,
    },
  });
};

const createAllBucketsResult = (): AuditResult => {
  const request = createAuditResultRequestFixture();
  const template = request.evaluation.findings[0];

  if (template === undefined) {
    throw new TypeError('The HTML fixture must contain one finding template.');
  }

  const findings: readonly Finding[] = [
    {
      ...template,
      category: 'accessibility',
      ruleId: 'accessibility/critical-example',
      ruleTitle: 'Critical example',
      severity: 'critical',
    },
    {
      ...template,
      category: 'accessibility',
      ruleId: 'accessibility/high-example',
      ruleTitle: 'High example',
      severity: 'high',
    },
    {
      ...template,
      category: 'performance',
      ruleId: 'performance/medium-example',
      ruleTitle: 'Medium example',
      severity: 'medium',
    },
    {
      ...template,
      category: 'seo',
      reference: {
        label: 'Local SEO guidance',
        url: null,
      },
      ruleId: 'seo/low-example',
      ruleTitle: 'Low example',
      severity: 'low',
    },
    {
      ...template,
      category: 'ux',
      location: null,
      reference: null,
      ruleId: 'ux/info-example',
      ruleTitle: 'Info example',
      severity: 'info',
    },
  ];
  const parserErrors = [
    {
      code: 'SOURCE_FILE_READ_FAILED',
      filePath: 'src/Unreadable.tsx',
      message: 'Source file could not be read.',
      recoverable: true,
      stage: 'read',
    },
    {
      code: 'SOURCE_PARSE_FAILED',
      filePath: 'src/Broken.tsx',
      message: 'Source file contains invalid syntax.',
      position: { column: 2, line: 3, offset: 19 },
      recoverable: true,
      stage: 'parse',
    },
    {
      code: 'SOURCE_EXTRACTION_FAILED',
      filePath: 'src/Extract.tsx',
      message: 'Source extraction failed.',
      position: { column: 0, line: 9, offset: 40 },
      recoverable: true,
      stage: 'extract',
    },
  ] as const;

  return createAuditResult({
    ...request,
    configuration: {
      ...request.configuration,
      color: false,
      minimumSeverity: 'critical',
      verbose: false,
    },
    evaluation: {
      ...request.evaluation,
      findings,
      summary: {
        availableRuleCount: 6,
        enabledRuleCount: 6,
        executedRuleCount: 6,
        failedRuleCount: 1,
        findingCount: findings.length,
        succeededRuleCount: 5,
      },
    },
    files: {
      discovered: 6,
      failed: parserErrors.length,
      parsed: 1,
      selected: 4,
    },
    parserErrors,
  });
};

const withForgedReferenceUrl = (value: unknown): AuditResult => {
  const result = createAuditResultFixture();
  const finding = result.findings[0];

  if (finding === undefined) {
    throw new TypeError('The HTML fixture must contain one finding.');
  }

  return {
    ...result,
    findings: [
      {
        ...finding,
        reference: {
          label: 'Forged reference',
          url: value,
        },
      },
    ],
  } as unknown as AuditResult;
};

const getOpeningTags = (html: string): readonly string[] => html.match(/<[a-z][^>]*>/giu) ?? [];

const extractHtmlArticle = (
  html: string,
  articleClass: 'finding' | 'processing-error',
  marker: string,
): string => {
  const markerIndex = html.indexOf(marker);
  const startIndex = html.lastIndexOf(`<article class="${articleClass}">`, markerIndex);
  const endIndex = html.indexOf('</article>', markerIndex);

  if (markerIndex < 0 || startIndex < 0 || endIndex < 0) {
    throw new TypeError(`Expected ${articleClass} article marker was not rendered.`);
  }

  return html.slice(startIndex, endIndex + '</article>'.length);
};

const extractTerminalRecord = (terminal: string, marker: string): string => {
  const markerIndex = terminal.indexOf(marker);

  if (markerIndex < 0) {
    throw new TypeError('Expected terminal record marker was not rendered.');
  }

  const startIndex = terminal.lastIndexOf('\n', markerIndex) + 1;
  const blankLineIndex = terminal.indexOf('\n\n', markerIndex);
  const endIndex = blankLineIndex < 0 ? terminal.length : blankLineIndex;

  return terminal.slice(startIndex, endIndex);
};

describe('HTML reporter', () => {
  it('renders an exact standalone HTML5 boundary with one final LF and restrictive CSP', () => {
    const result = createAuditResultFixture();
    const rendered = htmlReporter.render(result);
    const exactPrefix = [
      '<!doctype html>',
      '<html lang="en">',
      '  <head>',
      '    <meta charset="utf-8">',
      `    <meta http-equiv="Content-Security-Policy" content="${HTML_REPORT_CONTENT_SECURITY_POLICY}">`,
      '    <meta name="viewport" content="width=device-width, initial-scale=1">',
      '    <title>UXAudit audit report</title>',
      '    <style>',
    ].join('\n');

    expect(htmlReporter.format).toBe('html');
    expect(Object.isFrozen(htmlReporter)).toBe(true);
    expectTypeOf(htmlReporter).toExtend<Reporter>();
    expect(rendered.startsWith(exactPrefix)).toBe(true);
    expect(rendered.endsWith('  </body>\n</html>\n')).toBe(true);
    expect(rendered.endsWith('\n\n')).toBe(false);
    expect(rendered).not.toContain('\r');
    expect(rendered.match(/<style>/gu)).toHaveLength(1);
    expect(rendered.match(/<\/style>/gu)).toHaveLength(1);
    expect(rendered).not.toMatch(/<(?:base|embed|form|iframe|img|link|object|script)\b/giu);
    expect(rendered).not.toMatch(/\s(?:src|srcset)\s*=/giu);
    expect(rendered).not.toMatch(/@import|url\s*\(/giu);
  });

  it('locks the exact deterministic representation of a controlled result', () => {
    const stableResult = {
      ...createAuditResultFixture(),
      projectRoot: '/controlled-project',
    } as AuditResult;
    const rendered = renderHtmlReport(stableResult);
    const digest = createHash('sha256').update(rendered, 'utf8').digest('hex');

    expect(digest).toBe('b4f15a9e976064ca669218be010d3d7edebd0fe4097a3b4790c34a6b197e4966');
  });

  it('shows complete metadata, counters, findings, errors, offsets, and fixed groups', () => {
    const result = createAllBucketsResult();
    const rendered = renderHtmlReport(result);
    const findingGroupIds = [
      'critical-findings',
      'high-findings',
      'medium-findings',
      'low-findings',
      'info-findings',
    ];
    const errorGroupIds = [
      'discovery-errors',
      'read-errors',
      'parse-errors',
      'extract-errors',
      'rule-errors',
    ];

    expect(rendered).toContain('<caption>Result metadata and report paths</caption>');
    expect(rendered).toContain('<code>1.0.0</code>');
    expect(rendered).toContain('<code>0.1.0-test</code>');
    expect(rendered).toContain('<code>2026-07-29T12:00:00.000Z</code>');
    expect(rendered).toContain('<code>2026-07-29T12:00:00.125Z</code>');
    expect(rendered).toContain('<code>uxaudit-reports/audit-report.json</code>');
    expect(rendered).toContain('<code>uxaudit-reports/audit-report.html</code>');
    expect(rendered).toContain('<caption>File processing</caption>');
    expect(rendered).toContain('<caption>Rule execution</caption>');
    expect(rendered).toContain('<caption>Findings by severity</caption>');
    expect(rendered).toContain('<caption>Findings by category</caption>');
    expect(rendered).toContain('<caption>Processing errors by stage</caption>');

    for (let index = 1; index < findingGroupIds.length; index += 1) {
      expect(rendered.indexOf(`id="${findingGroupIds[index - 1] ?? ''}"`)).toBeLessThan(
        rendered.indexOf(`id="${findingGroupIds[index] ?? ''}"`),
      );
      expect(rendered.indexOf(`id="${errorGroupIds[index - 1] ?? ''}"`)).toBeLessThan(
        rendered.indexOf(`id="${errorGroupIds[index] ?? ''}"`),
      );
    }

    for (const title of [
      'Critical example',
      'High example',
      'Medium example',
      'Low example',
      'Info example',
    ]) {
      expect(rendered).toContain(`<h4>${title}</h4>`);
    }

    expect(rendered.match(/<article class="finding">/gu)).toHaveLength(5);
    expect(rendered.match(/<article class="processing-error">/gu)).toHaveLength(5);
    expect(rendered).toContain(
      '<code>src/App.tsx</code>:<code>4</code>:<code>5</code> <span class="muted">(offset <code>60</code>)</span> &rarr; <code>4</code>:<code>17</code> <span class="muted">(offset <code>72</code>; end exclusive)</span>',
    );
    expect(rendered).toContain(
      '<code>src/Broken.tsx</code>:<code>3</code>:<code>3</code> <span class="muted">(offset <code>19</code>)</span>',
    );
    expect(rendered).toContain(
      '<code>src/Unreadable.tsx</code> <span class="muted">(position unavailable)</span>',
    );
    expect(rendered).toContain('<span class="muted">Unavailable (<code>null</code>)</span>');
    expect(rendered).toContain('<span class="muted">None (<code>null</code>)</span>');
    expect(rendered).toContain('Local SEO guidance');
    expect(rendered).toContain('(URL: <code>null</code>)');
    expect(rendered).toContain('DISCOVERY_NOT_ACCESSIBLE');
    expect(rendered).toContain('SOURCE_FILE_READ_FAILED');
    expect(rendered).toContain('SOURCE_PARSE_FAILED');
    expect(rendered).toContain('SOURCE_EXTRACTION_FAILED');
    expect(rendered).toContain('RULE_EVALUATION_FAILED');
  });

  it('does not apply terminal severity or verbosity filters to complete HTML records', () => {
    const rendered = renderHtmlReport(createAllBucketsResult());

    expect(rendered).toContain('<code>critical</code>');
    expect(rendered).toContain('<code>high</code>');
    expect(rendered).toContain('<code>medium</code>');
    expect(rendered).toContain('<code>low</code>');
    expect(rendered).toContain('<code>info</code>');
    expect(rendered).toContain('Source file could not be read.');
    expect(rendered).toContain('Source extraction failed.');
    expect(rendered).toContain(
      'The terminal minimum-severity setting does not filter this report.',
    );
  });

  it('renders explicit null and empty selections, paths, arrays, and every zero bucket', () => {
    const emptyFilters = renderHtmlReport(createEmptyHtmlResult(true));
    const nullFilters = renderHtmlReport(createEmptyHtmlResult(false));

    expect(emptyFilters.match(/<code>\[\]<\/code>/gu)).toHaveLength(2);
    expect(emptyFilters).toContain('(no categories selected)');
    expect(emptyFilters).toContain('(no rules selected)');
    expect(emptyFilters).toContain(
      '<code>null</code> <span class="muted">(format not selected)</span>',
    );
    expect(emptyFilters.match(/No findings in this severity bucket\./gu)).toHaveLength(5);
    expect(emptyFilters.match(/No errors in this processing-stage bucket\./gu)).toHaveLength(5);
    expect(emptyFilters).toContain('Findings <code>0</code>');
    expect(emptyFilters).toContain('Recoverable processing errors <code>0</code>');
    expect(
      nullFilters.match(/<code>null<\/code> <span class="muted">\(stable catalog\)<\/span>/gu),
    ).toHaveLength(2);
  });

  it('neutralizes hostile HTML, controls, bidi text, BOM, and lone surrogates', () => {
    const request = createAuditResultRequestFixture();
    const firstFinding = request.evaluation.findings[0];
    const secondFinding = request.evaluation.findings[1];
    const discoveryIssue = request.discoveryIssues[0];
    const parserError = request.parserErrors[0];
    const ruleError = request.evaluation.errors[0];
    const hostile =
      '</style><script>alert("x")</script><img src=x onerror=alert(1)>\u0000\n\u009b\u202e\u2066\ufeff\ud800😀&"\'safe';

    if (
      firstFinding === undefined ||
      secondFinding === undefined ||
      discoveryIssue === undefined ||
      parserError === undefined ||
      ruleError === undefined
    ) {
      throw new TypeError('The hostile HTML fixture is incomplete.');
    }

    if (firstFinding.location === null) {
      throw new TypeError('The hostile HTML fixture finding must have a source location.');
    }

    const result = createAuditResult({
      ...request,
      discoveryIssues: [
        {
          ...discoveryIssue,
          relativePath: `private-${hostile}`,
        },
      ],
      evaluation: {
        ...request.evaluation,
        findings: [
          {
            ...firstFinding,
            explanation: `Explanation ${hostile}`,
            limitations: [`Limitation ${hostile}`],
            location: {
              ...firstFinding.location,
              filePath: `src/${hostile}/App.tsx`,
            },
            message: `Message ${hostile}`,
            recommendation: `Recommendation ${hostile}`,
            reference: {
              label: `Reference ${hostile}`,
              url: null,
            },
            ruleTitle: `Title ${hostile}`,
          },
          secondFinding,
        ],
        errors: [
          {
            ...ruleError,
            message: `Rule error ${hostile}`,
          },
        ],
      },
      parserErrors: [
        {
          ...parserError,
          filePath: `src/${hostile}/Broken.tsx`,
          message: `Parser error ${hostile}`,
        },
      ],
      projectRoot: `${request.projectRoot}/${hostile}`,
      toolVersion: `0.1.0-${hostile}`,
    });
    const rendered = renderHtmlReport(result);

    expect(rendered).not.toMatch(/<script[\s>]/giu);
    expect(rendered).not.toMatch(/<img[\s>]/giu);
    expect(rendered.match(/<\/style>/gu)).toHaveLength(1);
    expect(getOpeningTags(rendered).some((tag) => /\son[a-z]+\s*=/iu.test(tag))).toBe(false);
    expect(rendered).not.toMatch(
      // eslint-disable-next-line no-control-regex -- Structural LF is allowed; untrusted controls are not.
      /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069\ufeff\ud800]/u,
    );
    expect(rendered).toContain('&lt;/style&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(rendered).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(rendered).toContain('&amp;&quot;&#39;safe');
    expect(rendered).toContain('\\u0000');
    expect(rendered).toContain('\\u000a');
    expect(rendered).toContain('\\u009b');
    expect(rendered).toContain('\\u202e');
    expect(rendered).toContain('\\u2066');
    expect(rendered).toContain('\\ufeff');
    expect(rendered).toContain('\\ud800');
    expect(rendered).toContain('😀');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///private/report',
    'https://user:secret@example.test/private',
    'https://example.test/\npath',
    'https://example.test/\u202epath',
    'not a URL',
    { href: 'https://example.test/' },
  ])('keeps a forged unsafe reference inert: %s', (unsafeUrl) => {
    const rendered = renderHtmlReport(withForgedReferenceUrl(unsafeUrl));

    expect(rendered).not.toContain('<a href=');
    expect(rendered).toContain('link unavailable');
    expect(rendered).not.toMatch(/\shref="(?:data|file|javascript|vbscript):/giu);
  });

  it('uses the parsed HTTP(S) URL as escaped href and preserves the original as escaped text', () => {
    const forgedUrl = 'https://example.test/a" onmouseover="alert(1)?x=<tag>&y=1';
    const rendered = renderHtmlReport(withForgedReferenceUrl(forgedUrl));

    expect(rendered).toContain(
      '<a href="https://example.test/a%22%20onmouseover=%22alert(1)?x=%3Ctag%3E&amp;y=1"',
    );
    expect(rendered).toContain(
      '<code>https://example.test/a&quot; onmouseover=&quot;alert(1)?x=&lt;tag&gt;&amp;y=1</code>',
    );
    expect(getOpeningTags(rendered).some((tag) => /\sonmouseover\s*=/iu.test(tag))).toBe(false);
  });

  it('renders the same normalized finding and error identities as JSON and terminal', () => {
    const result = createResultWithConfiguration({ color: false });
    const parsed = JSON.parse(renderJsonReport(result)) as AuditResult;
    const terminal = renderTerminalReport(result);
    const html = renderHtmlReport(result);

    expect(parsed).toEqual(result);

    result.findings.forEach((finding, index) => {
      const parsedFinding = parsed.findings[index];
      const terminalRecord = extractTerminalRecord(terminal, `(${finding.ruleId})`);
      const htmlRecord = extractHtmlArticle(html, 'finding', `<code>${finding.ruleId}</code>`);

      expect(parsedFinding).toEqual(finding);
      expect(terminalRecord).toContain(finding.ruleTitle);
      expect(terminalRecord).toContain(`(${finding.ruleId})`);
      expect(terminalRecord).toContain(`Category: ${finding.category}`);
      expect(terminalRecord).toContain(`Confidence: ${finding.confidence}`);
      expect(terminalRecord).toContain(`[${finding.severity.toUpperCase()}]`);
      expect(terminalRecord).toContain(`Message: ${finding.message}`);
      expect(terminalRecord).toContain(`Explanation: ${finding.explanation}`);
      expect(terminalRecord).toContain(`Recommendation: ${finding.recommendation}`);
      expect(htmlRecord).toContain(`<h4>${finding.ruleTitle}</h4>`);
      expect(htmlRecord).toContain(`<code>${finding.ruleId}</code>`);
      expect(htmlRecord).toContain(`<code>${finding.category}</code>`);
      expect(htmlRecord).toContain(`<code>${finding.severity}</code>`);
      expect(htmlRecord).toContain(`<code>${finding.confidence}</code>`);
      expect(htmlRecord).toContain(`<p>${finding.message}</p>`);
      expect(htmlRecord).toContain(`<p>${finding.explanation}</p>`);
      expect(htmlRecord).toContain(`<p>${finding.recommendation}</p>`);

      for (const limitation of finding.limitations) {
        expect(terminalRecord).toContain(`- ${limitation}`);
        expect(htmlRecord).toContain(`<li>${limitation}</li>`);
      }

      if (finding.reference === null) {
        expect(terminalRecord).toContain('Reference: none');
        expect(htmlRecord).toContain('None (<code>null</code>)');
      } else if (finding.reference.url === null) {
        expect(terminalRecord).toContain(`Reference: ${finding.reference.label}`);
        expect(htmlRecord).toContain(finding.reference.label);
        expect(htmlRecord).toContain('(URL: <code>null</code>)');
      } else {
        expect(terminalRecord).toContain(
          `Reference: ${finding.reference.label} (${finding.reference.url})`,
        );
        expect(htmlRecord).toContain(`>${finding.reference.label}</a>`);
        expect(htmlRecord).toContain(`<code>${finding.reference.url}</code>`);
      }

      if (finding.location === null) {
        expect(terminalRecord).toContain('Location: unavailable');
        expect(htmlRecord).toContain('Unavailable (<code>null</code>)');
      } else {
        const { end, filePath, start } = finding.location;

        expect(terminalRecord).toContain(
          `Location: ${filePath}:${String(start.line)}:${String(start.column + 1)}`,
        );
        expect(htmlRecord).toContain(
          `<code>${filePath}</code>:<code>${String(start.line)}</code>:<code>${String(
            start.column + 1,
          )}</code>`,
        );
        expect(htmlRecord).toContain(`(offset <code>${String(start.offset)}</code>)`);
        expect(htmlRecord).toContain(
          `<code>${String(end.line)}</code>:<code>${String(end.column + 1)}</code>`,
        );
        expect(htmlRecord).toContain(`(offset <code>${String(end.offset)}</code>; end exclusive)`);
      }
    });

    result.errors.forEach((error, index) => {
      const parsedError = parsed.errors[index];
      const terminalRecord = extractTerminalRecord(terminal, error.code);
      const htmlRecord = extractHtmlArticle(html, 'processing-error', `<h4>${error.code}</h4>`);

      expect(parsedError).toEqual(error);
      expect(terminalRecord).toContain(`[${error.stage.toUpperCase()}] ${error.code}`);
      expect(terminalRecord).toContain(`Message: ${error.message}`);
      expect(htmlRecord).toContain(`<code>${error.stage}</code>`);
      expect(htmlRecord).toContain(`<code>${error.code}</code>`);
      expect(htmlRecord).toContain('<code>true</code>');
      expect(htmlRecord).toContain(`<p>${error.message}</p>`);

      if (error.stage === 'discovery') {
        expect(terminalRecord).toContain(`Target: ${error.filePath}`);
        expect(terminalRecord).toContain(`Operation: ${error.operation}`);
        expect(htmlRecord).toContain(`<code>${error.filePath}</code>`);
        expect(htmlRecord).toContain(`<code>${error.operation}</code>`);
      } else if (error.stage === 'rule') {
        expect(terminalRecord).toContain(`Rule: ${error.ruleId} (${error.category})`);
        expect(htmlRecord).toContain(`<code>${error.ruleId}</code>`);
        expect(htmlRecord).toContain(`<code>${error.category}</code>`);
      } else {
        expect(terminalRecord).toContain(`Location: ${error.filePath}`);
        expect(htmlRecord).toContain(`<code>${error.filePath}</code>`);

        if (error.position !== undefined) {
          expect(terminalRecord).toContain(
            `${String(error.position.line)}:${String(error.position.column + 1)}`,
          );
          expect(htmlRecord).toContain(
            `<code>${String(error.position.line)}</code>:<code>${String(
              error.position.column + 1,
            )}</code>`,
          );
          expect(htmlRecord).toContain(`(offset <code>${String(error.position.offset)}</code>)`);
        }
      }
    });
  });

  it('preserves canonical order inside one fixed severity group', () => {
    const request = createAuditResultRequestFixture();
    const template = request.evaluation.findings[0];

    if (template === undefined) {
      throw new TypeError('The HTML order fixture must contain one finding template.');
    }

    const result = createAuditResult({
      ...request,
      evaluation: {
        ...request.evaluation,
        findings: [
          {
            ...template,
            category: 'accessibility',
            ruleId: 'accessibility/z-second',
            ruleTitle: 'Second canonical finding',
            severity: 'high',
          },
          {
            ...template,
            category: 'accessibility',
            ruleId: 'accessibility/a-first',
            ruleTitle: 'First canonical finding',
            severity: 'high',
          },
        ],
      },
    });
    const rendered = renderHtmlReport(result);
    const highGroupStart = rendered.indexOf('id="high-findings"');
    const highGroupEnd = rendered.indexOf('id="medium-findings"');
    const highGroup = rendered.slice(highGroupStart, highGroupEnd);

    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      'accessibility/a-first',
      'accessibility/z-second',
    ]);
    expect(highGroup.indexOf('<code>accessibility/a-first</code>')).toBeLessThan(
      highGroup.indexOf('<code>accessibility/z-second</code>'),
    );
  });

  it('is byte-deterministic and leaves the recursively frozen input unchanged', () => {
    const result = createAuditResultFixture();
    const before = JSON.stringify(result);
    const findings = result.findings;
    const errors = result.errors;
    const first = renderHtmlReport(result);
    const second = renderHtmlReport(result);
    const independentlyPrepared = renderHtmlReport(createAuditResultFixture());

    expect(first).toBe(second);
    expect(first).toBe(independentlyPrepared);
    expect(JSON.stringify(result)).toBe(before);
    expect(result.findings).toBe(findings);
    expect(result.errors).toBe(errors);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.findings)).toBe(true);
  });
});

describe('HTML report writer adapter', () => {
  it('delegates the exact HTML representation and fixed target to the shared writer', async () => {
    const result = createAuditResultFixture();
    const written = Object.freeze({
      format: 'html',
      relativePath: 'uxaudit-reports/audit-report.html',
    } as const);
    const writer = vi.fn<ReportFileWriter>().mockResolvedValue(written);

    await expect(writeHtmlReport(result, writer)).resolves.toBe(written);
    expect(writer).toHaveBeenCalledOnce();
    expect(writer).toHaveBeenCalledWith({
      content: renderHtmlReport(result),
      format: 'html',
      projectRoot: result.projectRoot,
      relativePath: result.reportPaths.html,
    });
  });

  it('propagates shared write failures without returning a generated-report claim', async () => {
    const result = createAuditResultFixture();
    const failure = new ReportWriteError(REPORT_WRITE_ERROR_CODES.writeFailed);
    const writer = vi.fn<ReportFileWriter>().mockRejectedValue(failure);

    await expect(writeHtmlReport(result, writer)).rejects.toBe(failure);
    expect(writer).toHaveBeenCalledOnce();
  });

  it('rejects an unselected HTML path before invoking the writer', async () => {
    const result = createEmptyHtmlResult(false);
    const withoutHtml = {
      ...result,
      reportPaths: {
        ...result.reportPaths,
        html: null,
      },
    } as AuditResult;
    const writer = vi.fn<ReportFileWriter>();

    await expect(writeHtmlReport(withoutHtml, writer)).rejects.toMatchObject({
      code: REPORT_WRITE_ERROR_CODES.invalidRequest,
      message: 'Report write request is invalid.',
    });
    expect(writer).not.toHaveBeenCalled();
  });
});

import { readFile } from 'node:fs/promises';

import { describe, expect, expectTypeOf, it } from 'vitest';

import { createAuditResult, type AuditResult } from '../../../src/domain/audit/audit-result.js';
import type { Finding } from '../../../src/domain/findings/finding.js';
import { jsonReporter, renderJsonReport } from '../../../src/reporting/json/json-reporter.js';
import type { Reporter } from '../../../src/reporting/reporter.js';
import { assertMatchesJsonSchema } from '../assert-json-schema.js';
import {
  createAuditResultFixture,
  createAuditResultRequestFixture,
} from '../audit-result-fixture.js';

const schemaUrl = new URL(
  '../../../.github/harness/schemas/audit-result.schema.json',
  import.meta.url,
);
const findingSchemaUrl = new URL(
  '../../../.github/harness/schemas/finding.schema.json',
  import.meta.url,
);

const createEmptyResult = (): AuditResult => {
  const request = createAuditResultRequestFixture();

  return createAuditResult({
    ...request,
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
  });
};

describe('JSON reporter', () => {
  it('exposes one frozen JSON reporter and renders exact two-space JSON with one final LF', () => {
    const result = createAuditResultFixture();
    const expected = `${JSON.stringify(result, null, 2)}\n`;
    const rendered = jsonReporter.render(result);

    expect(jsonReporter.format).toBe('json');
    expect(Object.isFrozen(jsonReporter)).toBe(true);
    expect(rendered).toBe(expected);
    expect(rendered.endsWith('\n')).toBe(true);
    expect(rendered.endsWith('\n\n')).toBe(false);
    expect(rendered).not.toContain('\r');
    expectTypeOf(jsonReporter).toExtend<Reporter>();
  });

  it('retains the complete result, timing metadata, and stored zero-based coordinates', () => {
    const result = createAuditResultFixture();
    const parsed = JSON.parse(renderJsonReport(result)) as AuditResult;

    expect(parsed).toEqual(result);
    expect(parsed.timing).toEqual({
      completedAt: '2026-07-29T12:00:00.125Z',
      durationMs: 125,
      startedAt: '2026-07-29T12:00:00.000Z',
    });
    expect(parsed.findings[0]?.location).toEqual({
      end: { column: 16, line: 4, offset: 72 },
      filePath: 'src/App.tsx',
      start: { column: 4, line: 4, offset: 60 },
    });
    expect(parsed.errors[1]).toMatchObject({
      position: { column: 2, line: 3, offset: 19 },
      stage: 'parse',
    });
  });

  it('produces data accepted by the exact local AuditResult and Finding schemas', async () => {
    const [schemaText, findingSchemaText] = await Promise.all([
      readFile(schemaUrl, 'utf8'),
      readFile(findingSchemaUrl, 'utf8'),
    ]);
    const schema = JSON.parse(schemaText) as unknown;
    const findingSchema = JSON.parse(findingSchemaText) as unknown;
    const parsed = JSON.parse(renderJsonReport(createAuditResultFixture())) as unknown;

    expect(() => {
      assertMatchesJsonSchema(parsed, schema, {
        'finding.schema.json': findingSchema,
      });
    }).not.toThrow();
  });

  it('round-trips hostile project strings without terminal or HTML projection', () => {
    const request = createAuditResultRequestFixture();
    const firstFinding = request.evaluation.findings[0];
    const parserError = request.parserErrors[0];

    if (firstFinding === undefined) {
      throw new TypeError('The JSON fixture must contain one located finding.');
    }

    if (firstFinding.location === null) {
      throw new TypeError('The JSON fixture finding must contain a source location.');
    }

    if (parserError === undefined) {
      throw new TypeError('The JSON fixture must contain one parser error.');
    }

    const hostileText = '<script>alert("x")</script>\u001b[2J\n\u202e\ud800';
    const hostileFinding: Finding = {
      ...firstFinding,
      explanation: `Explanation ${hostileText} remains data.`,
      limitations: [`Limitation ${hostileText} remains data.`],
      location: {
        ...firstFinding.location,
        filePath: `src/${hostileText}/App.tsx`,
      },
      message: `Message ${hostileText} remains data.`,
      recommendation: `Recommendation ${hostileText} remains data.`,
      reference: {
        label: `Reference ${hostileText} remains data.`,
        url: null,
      },
      ruleTitle: `Title ${hostileText} remains data.`,
    };
    const result = createAuditResult({
      ...request,
      evaluation: {
        ...request.evaluation,
        findings: [hostileFinding],
        summary: {
          ...request.evaluation.summary,
          findingCount: 1,
        },
      },
      parserErrors: [
        {
          ...parserError,
          filePath: `src/${hostileText}/Broken.tsx`,
          message: `Parser ${hostileText} remains data.`,
        },
      ],
      projectRoot: `${request.projectRoot}/${hostileText}/project`,
      toolVersion: `0.1.0-${hostileText}-test`,
    });
    const rendered = renderJsonReport(result);

    expect(JSON.parse(rendered)).toEqual(result);
    expect(rendered).toContain('<script>alert(\\"x\\")</script>');
    expect(rendered).toContain('\\u001b');
    expect(rendered).toContain('\\n');
    expect(rendered).toContain('\u202e');
    expect(rendered).toContain('\\ud800');
  });

  it('renders the complete empty result without omitting zero buckets or arrays', () => {
    const result = createEmptyResult();
    const parsed = JSON.parse(renderJsonReport(result)) as AuditResult;

    expect(parsed).toEqual(result);
    expect(parsed.findings).toEqual([]);
    expect(parsed.errors).toEqual([]);
    expect(parsed.summary.findings.total).toBe(0);
    expect(parsed.summary.findings.bySeverity).toEqual({
      critical: 0,
      high: 0,
      info: 0,
      low: 0,
      medium: 0,
    });
    expect(parsed.summary.errors.byStage).toEqual({
      discovery: 0,
      extract: 0,
      parse: 0,
      read: 0,
      rule: 0,
    });
  });

  it('is byte-deterministic and leaves the recursively frozen input unchanged', () => {
    const result = createAuditResultFixture();
    const before = JSON.stringify(result);
    const findings = result.findings;
    const errors = result.errors;
    const first = renderJsonReport(result);
    const second = renderJsonReport(result);
    const independentlyPrepared = renderJsonReport(createAuditResultFixture());

    expect(first).toBe(second);
    expect(first).toBe(independentlyPrepared);
    expect(JSON.stringify(result)).toBe(before);
    expect(result.findings).toBe(findings);
    expect(result.errors).toBe(errors);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.findings)).toBe(true);
  });
});

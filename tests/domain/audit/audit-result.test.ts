import { readFile } from 'node:fs/promises';

import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  AUDIT_RESULT_ERROR_CODES,
  AUDIT_RESULT_SCHEMA_VERSION,
  AuditResultInvariantError,
  createAuditResult,
  type AuditResult,
  type CreateAuditResultRequest,
} from '../../../src/domain/audit/audit-result.js';
import {
  AUDIT_PROCESSING_ERROR_STAGES,
  createDiscoveryProcessingError,
  createRuleProcessingError,
  createSourceProcessingError,
} from '../../../src/domain/audit/audit-processing-error.js';
import {
  createAuditResultRequestFixture,
  createConfigurationFixture,
} from '../../reporting/audit-result-fixture.js';
import { assertMatchesJsonSchema } from '../../reporting/assert-json-schema.js';

const schemaUrl = new URL('../../../schemas/audit-result.schema.json', import.meta.url);
const findingSchemaUrl = new URL('../../../schemas/finding.schema.json', import.meta.url);

type InvalidRequestFactory = (request: CreateAuditResultRequest) => unknown;

const invalidRequestCases: readonly (readonly [string, InvalidRequestFactory])[] = [
  [
    'relative project root',
    (request) => ({
      ...request,
      projectRoot: 'relative/project',
    }),
  ],
  [
    'inconsistent file counters',
    (request) => ({
      ...request,
      files: { ...request.files, parsed: 2 },
    }),
  ],
  [
    'failed-file count without parser errors',
    (request) => ({
      ...request,
      parserErrors: [],
    }),
  ],
  [
    'inconsistent rule counters',
    (request) => ({
      ...request,
      evaluation: {
        ...request.evaluation,
        summary: { ...request.evaluation.summary, findingCount: 99 },
      },
    }),
  ],
  [
    'invalid timestamp',
    (request) => ({
      ...request,
      timing: { ...request.timing, startedAt: 'yesterday' },
    }),
  ],
  [
    'unsafe output directory',
    (request) => ({
      ...request,
      configuration: { ...request.configuration, outputDirectory: '../outside' },
    }),
  ],
  [
    'missing configured report path',
    (request) => ({
      ...request,
      reportPaths: { ...request.reportPaths, html: null },
    }),
  ],
  [
    'duplicate formats',
    (request) => ({
      ...request,
      configuration: {
        ...request.configuration,
        formats: ['terminal', 'json', 'json'],
      },
    }),
  ],
  [
    'invalid finding',
    (request) => ({
      ...request,
      evaluation: {
        ...request.evaluation,
        findings: [{ ...request.evaluation.findings[0], message: '' }],
      },
    }),
  ],
  [
    'finding category and rule mismatch',
    (request) => ({
      ...request,
      evaluation: {
        ...request.evaluation,
        findings: [{ ...request.evaluation.findings[0], category: 'seo' }],
      },
    }),
  ],
  [
    'credential-bearing finding reference',
    (request) => ({
      ...request,
      evaluation: {
        ...request.evaluation,
        findings: [
          {
            ...request.evaluation.findings[0],
            reference: {
              label: 'Unsafe private reference',
              url: 'https://user:secret@example.test/reference',
            },
          },
        ],
      },
    }),
  ],
];

describe('AuditResult contracts', () => {
  it('builds one complete deterministic result with derived summaries and normalized errors', () => {
    const first = createAuditResult(createAuditResultRequestFixture());
    const second = createAuditResult(createAuditResultRequestFixture());

    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.schemaVersion).toBe(AUDIT_RESULT_SCHEMA_VERSION);
    expect(first.tool).toEqual({ name: 'UXAudit', version: '0.1.0-test' });
    expect(first.findings.map((finding) => finding.ruleId)).toEqual([
      'accessibility/img-alt',
      'performance/img-lazy-loading',
    ]);
    expect(first.summary).toEqual({
      errors: {
        byStage: {
          discovery: 1,
          extract: 0,
          parse: 1,
          read: 0,
          rule: 1,
        },
        total: 3,
      },
      files: {
        discovered: 4,
        failed: 1,
        parsed: 1,
        selected: 2,
      },
      findings: {
        byCategory: {
          accessibility: 1,
          performance: 1,
          seo: 0,
          ux: 0,
        },
        bySeverity: {
          critical: 0,
          high: 1,
          info: 0,
          low: 0,
          medium: 1,
        },
        total: 2,
      },
      rules: {
        availableRuleCount: 3,
        enabledRuleCount: 3,
        executedRuleCount: 3,
        failedRuleCount: 1,
        findingCount: 2,
        succeededRuleCount: 2,
      },
    });
    expect(first.errors.map((error) => error.stage)).toEqual(['discovery', 'parse', 'rule']);
    expect(first.errors).toEqual([
      {
        code: 'DISCOVERY_NOT_ACCESSIBLE',
        filePath: 'private',
        message: 'Project entry was not accessible during discovery.',
        operation: 'read-directory',
        recoverable: true,
        stage: 'discovery',
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
        category: 'seo',
        code: 'RULE_EVALUATION_FAILED',
        message: 'Rule evaluation failed.',
        recoverable: true,
        ruleId: 'seo/multiple-h1',
        stage: 'rule',
      },
    ]);
    expectTypeOf(first).toExtend<AuditResult>();
  });

  it('defensively copies and recursively freezes all reporter-facing data', () => {
    const request = createAuditResultRequestFixture();
    const result = createAuditResult(request);

    expect(result.configuration).not.toBe(request.configuration);
    expect(result.configuration.formats).not.toBe(request.configuration.formats);
    expect(result.findings).not.toBe(request.evaluation.findings);
    expect(result.findings[0]).not.toBe(request.evaluation.findings[1]);
    expect(result.findings[0]?.location).not.toBe(request.evaluation.findings[1]?.location);
    expect(result.errors).not.toBe(request.parserErrors);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.configuration.formats)).toBe(true);
    expect(Object.isFrozen(result.findings[0]?.limitations)).toBe(true);
    expect(Object.isFrozen(result.summary.findings.bySeverity)).toBe(true);
  });

  it('normalizes each upstream recoverable error without retaining its input object', () => {
    const discovery = {
      code: 'DISCOVERY_IO_FAILED',
      operation: 'inspect',
      recoverable: true,
      relativePath: 'src/entry.tsx',
    } as const;
    const source = {
      code: 'SOURCE_FILE_UNREADABLE',
      filePath: 'src/entry.tsx',
      message: 'Source file could not be read.',
      recoverable: true,
      stage: 'read',
    } as const;
    const rule = {
      category: 'ux',
      code: 'RULE_RESULT_INVALID',
      message: 'Rule returned an invalid result.',
      recoverable: true,
      ruleId: 'ux/small-inline-text',
    } as const;

    expect(createDiscoveryProcessingError(discovery)).toEqual({
      code: 'DISCOVERY_IO_FAILED',
      filePath: 'src/entry.tsx',
      message: 'Project entry could not be inspected during discovery.',
      operation: 'inspect',
      recoverable: true,
      stage: AUDIT_PROCESSING_ERROR_STAGES.discovery,
    });
    expect(createSourceProcessingError(source)).toEqual({
      ...source,
    });
    expect(createRuleProcessingError(rule)).toEqual({
      ...rule,
      stage: AUDIT_PROCESSING_ERROR_STAGES.rule,
    });
    expect(createSourceProcessingError(source)).not.toBe(source);
  });

  it.each(invalidRequestCases)(
    'rejects %s through one stable invariant boundary',
    (_label, mutate) => {
      const invalidRequest = mutate(createAuditResultRequestFixture());

      expect(() => createAuditResult(invalidRequest as CreateAuditResultRequest)).toThrow(
        AuditResultInvariantError,
      );

      try {
        createAuditResult(invalidRequest as CreateAuditResultRequest);
      } catch (error) {
        expect(error).toEqual(
          expect.objectContaining({
            code: AUDIT_RESULT_ERROR_CODES.invalidInput,
            message: 'Audit result input is invalid.',
            name: 'AuditResultInvariantError',
          }),
        );
        expect((error as Error).cause).toBeUndefined();
      }
    },
  );

  it('supports a terminal-only empty result with explicit zero buckets', () => {
    const request = createAuditResultRequestFixture();
    const result = createAuditResult({
      ...request,
      configuration: {
        ...createConfigurationFixture(),
        formats: ['terminal'],
      },
      discoveryIssues: [],
      evaluation: {
        errors: [],
        findings: [],
        summary: {
          availableRuleCount: 3,
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
      reportPaths: { html: null, json: null },
    });

    expect(result.findings).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.summary.findings.total).toBe(0);
    expect(result.summary.errors.total).toBe(0);
    expect(result.summary.findings.byCategory).toEqual({
      accessibility: 0,
      performance: 0,
      seo: 0,
      ux: 0,
    });
  });

  it('publishes an exact closed JSON Schema for every result section', async () => {
    const [schemaText, findingSchemaText] = await Promise.all([
      readFile(schemaUrl, 'utf8'),
      readFile(findingSchemaUrl, 'utf8'),
    ]);
    const schemaValue: unknown = JSON.parse(schemaText);
    const findingSchemaValue: unknown = JSON.parse(findingSchemaText);
    const schema = schemaValue as {
      readonly $defs: Readonly<Record<string, { readonly additionalProperties?: boolean }>>;
      readonly additionalProperties: boolean;
      readonly properties: {
        readonly schemaVersion: { readonly const: string };
      };
      readonly required: readonly string[];
    };
    const result = createAuditResult(createAuditResultRequestFixture());

    expect(() => {
      assertMatchesJsonSchema(result, schemaValue, {
        'finding.schema.json': findingSchemaValue,
      });
    }).not.toThrow();
    expect(() => {
      assertMatchesJsonSchema({ ...result, unexpected: true }, schemaValue, {
        'finding.schema.json': findingSchemaValue,
      });
    }).toThrow('unexpected property unexpected');

    expect(schema.properties.schemaVersion.const).toBe(AUDIT_RESULT_SCHEMA_VERSION);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual([
      'configuration',
      'errors',
      'findings',
      'projectRoot',
      'reportPaths',
      'schemaVersion',
      'summary',
      'timing',
      'tool',
    ]);

    for (const definition of [
      'configuration',
      'discoveryError',
      'errorStageSummary',
      'errorSummary',
      'fileSummary',
      'findingSummary',
      'reportPaths',
      'ruleError',
      'ruleSummary',
      'sourceError',
      'sourcePosition',
      'summary',
      'timing',
      'tool',
    ]) {
      expect(schema.$defs[definition]?.additionalProperties).toBe(false);
    }
  });
});

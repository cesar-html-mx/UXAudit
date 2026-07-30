import path from 'node:path';

import {
  CONFIGURATION_SCHEMA_VERSION,
  DEFAULT_OUTPUT_DIRECTORY,
  REPORT_FILE_NAMES,
  type AuditConfiguration,
} from '../../src/configuration/configuration.js';
import {
  createAuditResult,
  type AuditResult,
  type CreateAuditResultRequest,
} from '../../src/domain/audit/audit-result.js';
import type { Finding } from '../../src/domain/findings/finding.js';

const location = {
  end: { column: 16, line: 4, offset: 72 },
  filePath: 'src/App.tsx',
  start: { column: 4, line: 4, offset: 60 },
} as const;

const createFinding = (
  overrides: Partial<Pick<Finding, 'category' | 'ruleId' | 'ruleTitle' | 'severity'>> = {},
): Finding => ({
  category: 'accessibility',
  confidence: 'high',
  explanation: 'The element needs a text alternative.',
  limitations: ['Custom components are outside this static scope.'],
  location,
  message: 'Intrinsic image has no alt attribute.',
  recommendation: 'Add a descriptive alt value.',
  reference: {
    label: 'WCAG 2.2',
    url: 'https://www.w3.org/WAI/WCAG22/',
  },
  ruleId: 'accessibility/img-alt',
  ruleTitle: 'Image alternative text',
  severity: 'high',
  ...overrides,
});

export const createConfigurationFixture = (): AuditConfiguration => ({
  categories: null,
  color: true,
  formats: ['terminal', 'json', 'html'],
  minimumSeverity: 'info',
  outputDirectory: DEFAULT_OUTPUT_DIRECTORY,
  ruleIds: null,
  schemaVersion: CONFIGURATION_SCHEMA_VERSION,
  verbose: true,
});

export const createAuditResultRequestFixture = (): CreateAuditResultRequest => ({
  configuration: createConfigurationFixture(),
  discoveryIssues: [
    {
      code: 'DISCOVERY_NOT_ACCESSIBLE',
      operation: 'read-directory',
      recoverable: true,
      relativePath: 'private',
    },
  ],
  evaluation: {
    errors: [
      {
        category: 'seo',
        code: 'RULE_EVALUATION_FAILED',
        message: 'Rule evaluation failed.',
        recoverable: true,
        ruleId: 'seo/multiple-h1',
      },
    ],
    findings: [
      createFinding({
        category: 'performance',
        ruleId: 'performance/img-lazy-loading',
        ruleTitle: 'Image lazy loading',
        severity: 'medium',
      }),
      createFinding(),
    ],
    summary: {
      availableRuleCount: 3,
      enabledRuleCount: 3,
      executedRuleCount: 3,
      failedRuleCount: 1,
      findingCount: 2,
      succeededRuleCount: 2,
    },
  },
  files: {
    discovered: 4,
    failed: 1,
    parsed: 1,
    selected: 2,
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
  projectRoot: path.resolve('controlled-project'),
  reportPaths: {
    html: `${DEFAULT_OUTPUT_DIRECTORY}/${REPORT_FILE_NAMES.html}`,
    json: `${DEFAULT_OUTPUT_DIRECTORY}/${REPORT_FILE_NAMES.json}`,
  },
  timing: {
    completedAt: '2026-07-29T12:00:00.125Z',
    durationMs: 125,
    startedAt: '2026-07-29T12:00:00.000Z',
  },
  toolVersion: '0.1.0-test',
});

export const createAuditResultFixture = (): AuditResult =>
  createAuditResult(createAuditResultRequestFixture());

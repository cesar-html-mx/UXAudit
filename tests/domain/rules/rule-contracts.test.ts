import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  RULE_EXECUTION_ERROR_CODES,
  createRuleExecutionError,
  type RuleExecutionError,
} from '../../../src/domain/errors/rule-execution-error.js';
import { createFinding, type Finding } from '../../../src/domain/findings/finding.js';
import {
  FINDING_CONFIDENCES,
  RULE_CATEGORIES,
  RULE_SEVERITIES,
  RULE_STATUSES,
  type Rule,
  type RuleMetadata,
} from '../../../src/domain/rules/rule.js';
import type { RuleEvaluationResult } from '../../../src/domain/rules/rule-evaluation-result.js';

const location = {
  end: { column: 9, line: 2, offset: 30 },
  filePath: 'src/App.tsx',
  start: { column: 2, line: 2, offset: 23 },
} as const;

const metadata: RuleMetadata = {
  category: RULE_CATEGORIES.accessibility,
  defaultSeverity: RULE_SEVERITIES.high,
  explanation: 'Images need a text alternative for non-visual access.',
  id: 'accessibility/img-alt',
  limitations: ['Custom image components are not inferred.'],
  recommendation: 'Add a descriptive alt value or alt="" for a decorative image.',
  reference: {
    label: 'WCAG 2.2 — 1.1.1 Non-text Content',
    url: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
  },
  status: RULE_STATUSES.required,
  title: 'Image alternative text',
};

describe('rule and finding contracts', () => {
  it('publishes the complete classification vocabulary', () => {
    expect(RULE_CATEGORIES).toEqual({
      accessibility: 'accessibility',
      performance: 'performance',
      seo: 'seo',
      ux: 'ux',
    });
    expect(RULE_SEVERITIES).toEqual({
      critical: 'critical',
      high: 'high',
      info: 'info',
      low: 'low',
      medium: 'medium',
    });
    expect(RULE_STATUSES).toEqual({
      deferred: 'deferred',
      experimental: 'experimental',
      required: 'required',
      stable: 'stable',
    });
    expect(FINDING_CONFIDENCES).toEqual({
      high: 'high',
      low: 'low',
      medium: 'medium',
    });
  });

  it('defines a synchronous, model-driven, report-independent rule', () => {
    const rule: Rule = {
      evaluate: ({ model }) =>
        model.jsxNodes.length === 0
          ? []
          : [
              {
                confidence: FINDING_CONFIDENCES.high,
                location,
                message: 'Intrinsic image has no alt attribute.',
              },
            ],
      metadata,
    };

    const findings = rule.evaluate({
      model: {
        components: [],
        files: [],
        jsxNodes: [
          {
            attributes: [],
            childNodeIds: [],
            componentId: null,
            elementKind: 'intrinsic',
            id: 'jsx:src/App.tsx:23',
            kind: 'element',
            location,
            name: 'img',
            parentNodeId: null,
            textContent: { confidence: 'exact', value: '' },
          },
        ],
      },
    });

    expect(findings).toEqual([
      {
        confidence: 'high',
        location,
        message: 'Intrinsic image has no alt attribute.',
      },
    ]);
    expectTypeOf(rule).toExtend<Rule>();
  });

  it('normalizes a self-contained finding with a defensive location and reference copy', () => {
    const candidate = {
      confidence: FINDING_CONFIDENCES.high,
      location,
      message: 'Intrinsic image has no alt attribute.',
    } as const;

    const finding = createFinding(metadata, candidate);

    expect(finding).toEqual({
      category: 'accessibility',
      confidence: 'high',
      explanation: metadata.explanation,
      limitations: metadata.limitations,
      location,
      message: candidate.message,
      recommendation: metadata.recommendation,
      reference: metadata.reference,
      ruleId: 'accessibility/img-alt',
      ruleTitle: 'Image alternative text',
      severity: 'high',
    });
    expect(finding.location).not.toBe(location);
    expect(finding.location?.start).not.toBe(location.start);
    expect(finding.limitations).not.toBe(metadata.limitations);
    expect(finding.reference).not.toBe(metadata.reference);
    expectTypeOf(finding).toExtend<Finding>();
  });

  it('retains an explicit null location and reference when source evidence is unavailable', () => {
    const finding = createFinding(
      {
        ...metadata,
        reference: null,
      },
      {
        confidence: FINDING_CONFIDENCES.medium,
        location: null,
        message: 'Project-level condition needs review.',
      },
    );

    expect(finding.location).toBeNull();
    expect(finding.reference).toBeNull();
  });

  it.each([
    [RULE_EXECUTION_ERROR_CODES.evaluationFailed, 'Rule evaluation failed.'],
    [RULE_EXECUTION_ERROR_CODES.invalidResult, 'Rule returned an invalid result.'],
  ] as const)('creates a stable recoverable %s error without a native cause', (code, message) => {
    const error = createRuleExecutionError(metadata.id, metadata.category, code);

    expect(error).toEqual({
      category: 'accessibility',
      code,
      message,
      recoverable: true,
      ruleId: 'accessibility/img-alt',
    });
    expect(Object.keys(error)).not.toContain('cause');
    expect(Object.keys(error)).not.toContain('stack');
    expectTypeOf(error).toExtend<RuleExecutionError>();
  });

  it('defines the normalized engine result and counters independently of reporters', () => {
    const result: RuleEvaluationResult = {
      errors: [],
      findings: [],
      summary: {
        availableRuleCount: 8,
        enabledRuleCount: 8,
        executedRuleCount: 8,
        failedRuleCount: 0,
        findingCount: 0,
        succeededRuleCount: 8,
      },
    };

    expect(result.summary).toEqual({
      availableRuleCount: 8,
      enabledRuleCount: 8,
      executedRuleCount: 8,
      failedRuleCount: 0,
      findingCount: 0,
      succeededRuleCount: 8,
    });
    expectTypeOf(result).toExtend<RuleEvaluationResult>();
  });
});

import { describe, expect, it, vi } from 'vitest';

import { RULE_EXECUTION_ERROR_CODES } from '../../src/domain/errors/rule-execution-error.js';
import type { Rule } from '../../src/domain/rules/rule.js';
import { evaluateRules } from '../../src/rules/evaluate-rules.js';
import { loadRules } from '../../src/rules/load-rules.js';
import { createRuleRegistry } from '../../src/rules/rule-registry.js';
import {
  createTestRule,
  firstElementLocation,
  fontSizeLocation,
  model,
  secondElementLocation,
} from './rule-test-helpers.js';

const load = (rules: readonly Rule[]) =>
  loadRules({
    registry: createRuleRegistry(rules),
  });

describe('rule evaluator', () => {
  it('runs each enabled rule once and normalizes zero, one, and multiple findings', () => {
    const noFindingEvaluate = vi.fn(() => []);
    const oneFindingEvaluate = vi.fn(() => [
      {
        confidence: 'medium' as const,
        location: fontSizeLocation,
        message: 'Literal inline text may be too small.',
      },
    ]);
    const multipleFindingEvaluate = vi.fn(() => [
      {
        confidence: 'high' as const,
        location: secondElementLocation,
        message: 'Image has no text alternative.',
      },
      {
        confidence: 'high' as const,
        location: firstElementLocation,
        message: 'Image has no text alternative.',
      },
    ]);
    const loadedRules = load([
      createTestRule({
        category: 'ux',
        evaluate: oneFindingEvaluate,
        id: 'ux/small-inline-text',
      }),
      createTestRule({
        evaluate: multipleFindingEvaluate,
        id: 'accessibility/img-alt',
      }),
      createTestRule({
        category: 'seo',
        evaluate: noFindingEvaluate,
        id: 'seo/multiple-h1',
      }),
    ]);

    const result = evaluateRules({ loadedRules, model });

    expect(noFindingEvaluate).toHaveBeenCalledOnce();
    expect(oneFindingEvaluate).toHaveBeenCalledOnce();
    expect(multipleFindingEvaluate).toHaveBeenCalledOnce();
    expect(
      result.findings.map((finding) => [finding.ruleId, finding.location?.start.offset]),
    ).toEqual([
      ['accessibility/img-alt', 52],
      ['accessibility/img-alt', 110],
      ['ux/small-inline-text', 118],
    ]);
    expect(result.errors).toEqual([]);
    expect(result.summary).toEqual({
      availableRuleCount: 3,
      enabledRuleCount: 3,
      executedRuleCount: 3,
      failedRuleCount: 0,
      findingCount: 3,
      succeededRuleCount: 3,
    });
  });

  it('isolates a thrown rule without exposing its native error or discarding siblings', () => {
    const loadedRules = load([
      createTestRule({
        evaluate: () => {
          throw new Error('private rule stack detail');
        },
        id: 'accessibility/broken-rule',
      }),
      createTestRule({
        category: 'seo',
        findings: [
          {
            confidence: 'medium',
            location: firstElementLocation,
            message: 'Safe sibling finding.',
          },
        ],
        id: 'seo/safe-rule',
      }),
    ]);

    const result = evaluateRules({ loadedRules, model });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.ruleId).toBe('seo/safe-rule');
    expect(result.errors).toEqual([
      {
        category: 'accessibility',
        code: RULE_EXECUTION_ERROR_CODES.evaluationFailed,
        message: 'Rule evaluation failed.',
        recoverable: true,
        ruleId: 'accessibility/broken-rule',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('private rule stack detail');
    expect(result.summary).toMatchObject({
      executedRuleCount: 2,
      failedRuleCount: 1,
      succeededRuleCount: 1,
    });
  });

  it('deep-freezes the trusted model so a failing rule cannot contaminate siblings', () => {
    const siblingEvaluate = vi.fn<Rule['evaluate']>(({ model: siblingModel }) => {
      expect(siblingModel.files).toHaveLength(1);
      expect(siblingModel.jsxNodes).toHaveLength(2);
      return [];
    });
    const loadedRules = load([
      createTestRule({
        evaluate: ({ model: mutableModel }) => {
          (mutableModel.files as unknown[]).splice(0);
          return [];
        },
        id: 'accessibility/mutating-rule',
      }),
      createTestRule({
        category: 'seo',
        evaluate: siblingEvaluate,
        id: 'seo/sibling-rule',
      }),
    ]);

    const result = evaluateRules({ loadedRules, model });

    expect(result.errors[0]?.code).toBe(RULE_EXECUTION_ERROR_CODES.evaluationFailed);
    expect(siblingEvaluate).toHaveBeenCalledOnce();
    expect(model.files).toHaveLength(1);
    expect(model.jsxNodes).toHaveLength(2);
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.files)).toBe(true);
    const styledNode = model.jsxNodes[1];
    expect(styledNode?.kind).toBe('element');

    if (styledNode?.kind === 'element') {
      expect(Object.isFrozen(styledNode.attributes)).toBe(true);
    }
  });

  it.each([
    ['non-array output', { evaluate: () => ({}) }],
    [
      'invalid confidence',
      {
        findings: [
          {
            confidence: 'certain',
            location: firstElementLocation,
            message: 'Invalid confidence.',
          },
        ],
      },
    ],
    [
      'padded message',
      {
        findings: [
          {
            confidence: 'high',
            location: firstElementLocation,
            message: ' padded ',
          },
        ],
      },
    ],
    [
      'untraceable location',
      {
        findings: [
          {
            confidence: 'high',
            location: {
              ...firstElementLocation,
              filePath: '/private/project/App.tsx',
            },
            message: 'Untraceable.',
          },
        ],
      },
    ],
    [
      'duplicate finding',
      {
        findings: [
          {
            confidence: 'high',
            location: firstElementLocation,
            message: 'Duplicate.',
          },
          {
            confidence: 'high',
            location: firstElementLocation,
            message: 'Duplicate.',
          },
        ],
      },
    ],
    [
      'contradictory-confidence duplicate',
      {
        findings: [
          {
            confidence: 'high',
            location: firstElementLocation,
            message: 'Duplicate.',
          },
          {
            confidence: 'low',
            location: firstElementLocation,
            message: 'Duplicate.',
          },
        ],
      },
    ],
  ])('rejects a transactional %s and continues safe rules', (_label, invalidBehavior) => {
    const invalid =
      'evaluate' in invalidBehavior
        ? createTestRule({
            evaluate: invalidBehavior.evaluate as unknown as Rule['evaluate'],
            id: 'accessibility/invalid-rule',
          })
        : createTestRule({
            findings: invalidBehavior.findings as never,
            id: 'accessibility/invalid-rule',
          });
    const loadedRules = load([
      invalid,
      createTestRule({
        category: 'seo',
        findings: [
          {
            confidence: 'medium',
            location: null,
            message: 'Project-level safe finding.',
          },
        ],
        id: 'seo/safe-rule',
      }),
    ]);

    const result = evaluateRules({ loadedRules, model });

    expect(result.findings.map((finding) => finding.ruleId)).toEqual(['seo/safe-rule']);
    expect(result.errors).toEqual([
      {
        category: 'accessibility',
        code: RULE_EXECUTION_ERROR_CODES.invalidResult,
        message: 'Rule returned an invalid result.',
        recoverable: true,
        ruleId: 'accessibility/invalid-rule',
      },
    ]);
  });

  it('treats a throwing result accessor as invalid output without leaking details', () => {
    const candidate = {
      get confidence(): never {
        throw new Error('sensitive getter detail');
      },
      location: firstElementLocation,
      message: 'Candidate.',
    };
    const loadedRules = load([
      createTestRule({
        findings: [candidate],
      }),
    ]);

    const result = evaluateRules({ loadedRules, model });

    expect(result.errors[0]?.code).toBe(RULE_EXECUTION_ERROR_CODES.invalidResult);
    expect(JSON.stringify(result)).not.toContain('sensitive getter detail');
  });

  it('returns stable serialization across repeated evaluation', () => {
    const loadedRules = load([
      createTestRule({
        findings: [
          {
            confidence: 'high',
            location: secondElementLocation,
            message: 'Second source finding.',
          },
          {
            confidence: 'high',
            location: firstElementLocation,
            message: 'First source finding.',
          },
        ],
      }),
    ]);

    const first = evaluateRules({ loadedRules, model });
    const second = evaluateRules({ loadedRules, model });

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('uses a message tie-breaker for distinct findings at the same location', () => {
    const loadedRules = load([
      createTestRule({
        findings: [
          {
            confidence: 'medium',
            location: firstElementLocation,
            message: 'Second message.',
          },
          {
            confidence: 'high',
            location: firstElementLocation,
            message: 'First message.',
          },
        ],
      }),
    ]);

    const result = evaluateRules({ loadedRules, model });

    expect(result.findings.map((finding) => [finding.message, finding.confidence])).toEqual([
      ['First message.', 'high'],
      ['Second message.', 'medium'],
    ]);
  });
});

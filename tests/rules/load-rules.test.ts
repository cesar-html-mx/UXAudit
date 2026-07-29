import { describe, expect, it } from 'vitest';

import { RULE_LOAD_ERROR_CODES, RuleLoadError, loadRules } from '../../src/rules/load-rules.js';
import { createRuleRegistry } from '../../src/rules/rule-registry.js';
import { createTestRule } from './rule-test-helpers.js';

const registry = createRuleRegistry([
  createTestRule({
    category: 'seo',
    id: 'seo/multiple-h1',
  }),
  createTestRule({
    category: 'accessibility',
    id: 'accessibility/img-alt',
  }),
  createTestRule({
    category: 'performance',
    id: 'performance/img-dimensions',
  }),
]);

describe('rule loader', () => {
  it('loads every rule in canonical registry order when filters are absent', () => {
    const loaded = loadRules({ registry });

    expect(loaded.availableRuleCount).toBe(3);
    expect(loaded.rules.map((rule) => rule.metadata.id)).toEqual([
      'accessibility/img-alt',
      'performance/img-dimensions',
      'seo/multiple-h1',
    ]);
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded.rules)).toBe(true);
  });

  it('combines deduplicated category and ID filters by intersection', () => {
    const loaded = loadRules({
      filters: {
        categories: ['accessibility', 'seo', 'seo'],
        ruleIds: ['seo/multiple-h1', 'performance/img-dimensions', 'seo/multiple-h1'],
      },
      registry,
    });

    expect(loaded.availableRuleCount).toBe(3);
    expect(loaded.rules.map((rule) => rule.metadata.id)).toEqual(['seo/multiple-h1']);
  });

  it.each([
    [{ categories: [] }, []],
    [{ ruleIds: [] }, []],
    [{ categories: ['performance'] }, ['performance/img-dimensions']],
    [{ ruleIds: ['accessibility/img-alt'] }, ['accessibility/img-alt']],
  ] as const)('applies a validated filter %j', (filters, expectedRuleIds) => {
    const loaded = loadRules({ filters, registry });

    expect(loaded.rules.map((rule) => rule.metadata.id)).toEqual(expectedRuleIds);
  });

  it.each([
    [{ categories: ['unknown'] }, RULE_LOAD_ERROR_CODES.invalidFilter],
    [{ categories: 'seo' }, RULE_LOAD_ERROR_CODES.invalidFilter],
    [{ ruleIds: [' padded/id '] }, RULE_LOAD_ERROR_CODES.invalidFilter],
    [{ ruleIds: 'seo/multiple-h1' }, RULE_LOAD_ERROR_CODES.invalidFilter],
    [{ ruleIds: ['seo/not-registered'] }, RULE_LOAD_ERROR_CODES.unknownRuleId],
    [{ enabled: false }, RULE_LOAD_ERROR_CODES.invalidFilter],
    [null, RULE_LOAD_ERROR_CODES.invalidFilter],
  ])('rejects an invalid or unknown filter without reflecting its value', (filters, code) => {
    expect(() =>
      loadRules({
        filters: filters as never,
        registry,
      }),
    ).toThrow(
      expect.objectContaining({
        code,
        name: 'RuleLoadError',
      }),
    );

    try {
      loadRules({
        filters: filters as never,
        registry,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(RuleLoadError);
      expect(String(error)).not.toContain(JSON.stringify(filters));
      expect(error).not.toHaveProperty('cause');
    }
  });

  it('normalizes a throwing filter accessor into a stable load error', () => {
    const filters = {
      get categories(): never {
        throw new Error('sensitive filter detail');
      },
    };

    expect(() =>
      loadRules({
        filters,
        registry,
      }),
    ).toThrow(
      expect.objectContaining({
        code: RULE_LOAD_ERROR_CODES.invalidFilter,
        message: 'Rule filters are invalid.',
      }),
    );
  });

  it('requires explicit rule-ID opt-in for an experimental rule', () => {
    const experimental = createTestRule({
      category: 'ux',
      id: 'ux/experimental-rule',
    });
    const experimentalRegistry = createRuleRegistry([
      {
        ...experimental,
        metadata: {
          ...experimental.metadata,
          status: 'experimental',
        },
      },
    ]);

    expect(loadRules({ registry: experimentalRegistry }).rules).toEqual([]);
    expect(
      loadRules({
        filters: { ruleIds: ['ux/experimental-rule'] },
        registry: experimentalRegistry,
      }).rules.map((rule) => rule.metadata.id),
    ).toEqual(['ux/experimental-rule']);
  });
});

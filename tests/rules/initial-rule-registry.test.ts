import { describe, expect, it } from 'vitest';

import { initialRuleRegistry } from '../../src/rules/initial-rule-registry.js';
import { loadRules } from '../../src/rules/load-rules.js';

const expectedRuleIds = [
  'accessibility/button-name',
  'accessibility/img-alt',
  'accessibility/input-label',
  'performance/img-dimensions',
  'performance/img-lazy-loading',
  'seo/ambiguous-link-text',
  'seo/multiple-h1',
  'ux/small-inline-text',
];

describe('initial rule registry', () => {
  it('publishes exactly the eight stable rules in canonical order', () => {
    expect(Object.isFrozen(initialRuleRegistry)).toBe(true);
    expect(Object.isFrozen(initialRuleRegistry.rules)).toBe(true);
    expect(initialRuleRegistry.rules.map((rule) => rule.metadata.id)).toEqual(expectedRuleIds);
    expect(initialRuleRegistry.rules.every((rule) => rule.metadata.status === 'stable')).toBe(true);
    expect(initialRuleRegistry.rules.every((rule) => rule.metadata.limitations.length > 0)).toBe(
      true,
    );
  });

  it('contains the reviewed three/two/two/one category distribution', () => {
    expect(
      Object.fromEntries(
        ['accessibility', 'performance', 'seo', 'ux'].map((category) => [
          category,
          initialRuleRegistry.rules.filter((rule) => rule.metadata.category === category).length,
        ]),
      ),
    ).toEqual({
      accessibility: 3,
      performance: 2,
      seo: 2,
      ux: 1,
    });
  });

  it('loads all rules by default and retains fail-closed category filtering', () => {
    const complete = loadRules({ registry: initialRuleRegistry });
    const seoOnly = loadRules({
      filters: { categories: ['seo'] },
      registry: initialRuleRegistry,
    });

    expect(complete.availableRuleCount).toBe(8);
    expect(complete.rules.map((rule) => rule.metadata.id)).toEqual(expectedRuleIds);
    expect(seoOnly.availableRuleCount).toBe(8);
    expect(seoOnly.rules.map((rule) => rule.metadata.id)).toEqual([
      'seo/ambiguous-link-text',
      'seo/multiple-h1',
    ]);
  });
});

import { describe, expect, it } from 'vitest';

import { evaluateRules } from '../../../src/rules/evaluate-rules.js';
import { loadRules } from '../../../src/rules/load-rules.js';
import { createRuleRegistry } from '../../../src/rules/rule-registry.js';
import { seoRules } from '../../../src/rules/seo/seo-rules.js';
import { modelFromJsx } from '../model-from-source.js';

describe('SEO rule catalog integration', () => {
  it('publishes the two stable SEO rules in canonical order through a frozen array', () => {
    expect(Object.isFrozen(seoRules)).toBe(true);
    expect(seoRules.map((rule) => [rule.metadata.id, rule.metadata.status])).toEqual([
      ['seo/ambiguous-link-text', 'stable'],
      ['seo/multiple-h1', 'stable'],
    ]);
  });

  it('evaluates both rules through the normalized engine with deterministic findings', () => {
    const model = modelFromJsx(`
      <main>
        <h1>Primary heading</h1>
        <a href="/details">Read more</a>
        <h1>Secondary heading</h1>
        <a href="/dynamic">Read more {dynamicSuffix}</a>
      </main>
    `);
    const registry = createRuleRegistry([...seoRules].reverse());
    const loadedRules = loadRules({ registry });

    const firstResult = evaluateRules({ loadedRules, model });
    const secondResult = evaluateRules({ loadedRules, model });

    expect(firstResult.errors).toEqual([]);
    expect(firstResult.findings.map((finding) => finding.ruleId)).toEqual([
      'seo/ambiguous-link-text',
      'seo/multiple-h1',
    ]);
    expect(firstResult.findings.every((finding) => finding.category === 'seo')).toBe(true);
    expect(firstResult.findings.every((finding) => finding.severity === 'medium')).toBe(true);
    expect(firstResult.findings.every((finding) => finding.limitations.length > 0)).toBe(true);
    expect(secondResult).toEqual(firstResult);
  });
});

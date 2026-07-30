import { describe, expect, it } from 'vitest';

import { evaluateRules } from '../../../src/rules/evaluate-rules.js';
import { loadRules } from '../../../src/rules/load-rules.js';
import { performanceRules } from '../../../src/rules/performance/performance-rules.js';
import { createRuleRegistry } from '../../../src/rules/rule-registry.js';
import { modelFromJsx } from '../model-from-source.js';

describe('performance rule catalog', () => {
  it('exports a frozen canonical pair of stable performance rules', () => {
    expect(Object.isFrozen(performanceRules)).toBe(true);
    expect(performanceRules.map((rule) => [rule.metadata.id, rule.metadata.status])).toEqual([
      ['performance/img-dimensions', 'stable'],
      ['performance/img-lazy-loading', 'stable'],
    ]);
  });

  it('normalizes both rules through the registry, loader, and evaluator deterministically', () => {
    const model = modelFromJsx(`
      <>
        <img />
        <img loading="lazy" width={100} height={50} />
      </>
    `);
    const registry = createRuleRegistry([...performanceRules].reverse());
    const loadedRules = loadRules({ registry });

    const first = evaluateRules({ loadedRules, model });
    const second = evaluateRules({ loadedRules, model });

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.errors).toEqual([]);
    expect(first.findings.map((finding) => [finding.ruleId, finding.severity])).toEqual([
      ['performance/img-dimensions', 'medium'],
      ['performance/img-lazy-loading', 'low'],
    ]);
    expect(first.findings.every((finding) => finding.confidence === 'medium')).toBe(true);
    expect(first.findings.every((finding) => finding.limitations.length > 0)).toBe(true);
    expect(first.summary).toEqual({
      availableRuleCount: 2,
      enabledRuleCount: 2,
      executedRuleCount: 2,
      failedRuleCount: 0,
      findingCount: 2,
      succeededRuleCount: 2,
    });
  });
});

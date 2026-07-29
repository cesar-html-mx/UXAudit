import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { accessibilityRules } from '../../../src/rules/accessibility/accessibility-rules.js';
import { evaluateRules } from '../../../src/rules/evaluate-rules.js';
import { loadRules } from '../../../src/rules/load-rules.js';
import { createRuleRegistry } from '../../../src/rules/rule-registry.js';
import { modelFromSource } from '../model-from-source.js';

const fixtureUrl = new URL(
  '../../fixtures/m04-rules/accessibility-cases.tsx.fixture',
  import.meta.url,
);

describe('accessibility rule catalog integration', () => {
  it('evaluates the committed TSX fixture through the normalized model and engine', async () => {
    const sourceText = await readFile(fixtureUrl, 'utf8');
    const model = modelFromSource(sourceText, 'src/AccessibilityCases.tsx');
    const registry = createRuleRegistry([...accessibilityRules].reverse());
    const loadedRules = loadRules({ registry });

    const result = evaluateRules({ loadedRules, model });

    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      'accessibility/button-name',
      'accessibility/img-alt',
      'accessibility/input-label',
    ]);
    expect(result.findings.map((finding) => finding.location?.start.line)).toEqual([11, 3, 6]);
    expect(result.findings.every((finding) => finding.severity === 'high')).toBe(true);
    expect(result.findings.every((finding) => finding.limitations.length > 0)).toBe(true);
    expect(result.summary).toEqual({
      availableRuleCount: 3,
      enabledRuleCount: 3,
      executedRuleCount: 3,
      failedRuleCount: 0,
      findingCount: 3,
      succeededRuleCount: 3,
    });
  });

  it('publishes exactly the three stable accessibility rule IDs in canonical registry order', () => {
    const registry = createRuleRegistry(accessibilityRules);

    expect(registry.rules.map((rule) => [rule.metadata.id, rule.metadata.status])).toEqual([
      ['accessibility/button-name', 'stable'],
      ['accessibility/img-alt', 'stable'],
      ['accessibility/input-label', 'stable'],
    ]);
  });
});

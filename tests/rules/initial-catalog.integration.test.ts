import { access, readFile, rm } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RULE_EXECUTION_ERROR_CODES } from '../../src/domain/errors/rule-execution-error.js';
import type { AnalysisModel } from '../../src/domain/models/analysis-model.js';
import type { RuleEvaluationResult } from '../../src/domain/rules/rule-evaluation-result.js';
import type { Rule } from '../../src/domain/rules/rule.js';
import { evaluateRules } from '../../src/rules/evaluate-rules.js';
import { initialRuleRegistry } from '../../src/rules/initial-rule-registry.js';
import { loadRules } from '../../src/rules/load-rules.js';
import { createRuleRegistry } from '../../src/rules/rule-registry.js';
import { modelFromSource } from './model-from-source.js';

const catalogFixtureUrl = new URL(
  '../fixtures/rule-catalog/catalog-cases.tsx.fixture',
  import.meta.url,
);
const expectedCatalogResultUrl = new URL(
  '../fixtures/rule-catalog/expected-catalog-result.json',
  import.meta.url,
);
const targetCodeSentinelUrl = new URL(
  '../fixtures/rule-catalog/TARGET_CODE_EXECUTED',
  import.meta.url,
);
const catalogFilePath = 'src/catalog-cases.tsx';
const expectedRuleIds = [
  'accessibility/button-name',
  'accessibility/img-alt',
  'accessibility/input-label',
  'performance/img-dimensions',
  'performance/img-lazy-loading',
  'seo/ambiguous-link-text',
  'seo/multiple-h1',
  'ux/small-inline-text',
] as const;

interface ExpectedCatalogScenario {
  readonly analysis: {
    readonly componentCount: number;
    readonly failedFileCount: number;
    readonly jsxNodeCount: number;
    readonly parsedFileCount: number;
    readonly targetCodeExecuted: boolean;
  };
  readonly evaluation: RuleEvaluationResult;
  readonly scenarioId: 'UXAUDIT-RULE-CATALOG';
  readonly schemaVersion: 1;
}

const fileExists = async (fileUrl: URL): Promise<boolean> => {
  try {
    await access(fileUrl);
    return true;
  } catch {
    return false;
  }
};

const readCatalogFixture = async (): Promise<{
  readonly expected: ExpectedCatalogScenario;
  readonly model: AnalysisModel;
}> => {
  const [sourceText, expectedText] = await Promise.all([
    readFile(catalogFixtureUrl, 'utf8'),
    readFile(expectedCatalogResultUrl, 'utf8'),
  ]);

  return {
    expected: JSON.parse(expectedText) as ExpectedCatalogScenario,
    model: modelFromSource(sourceText, catalogFilePath),
  };
};

const buildObservedScenario = async (
  model: AnalysisModel,
  evaluation: RuleEvaluationResult,
): Promise<ExpectedCatalogScenario> => ({
  analysis: {
    componentCount: model.components.length,
    failedFileCount: 0,
    jsxNodeCount: model.jsxNodes.length,
    parsedFileCount: model.files.length,
    targetCodeExecuted: await fileExists(targetCodeSentinelUrl),
  },
  evaluation,
  scenarioId: 'UXAUDIT-RULE-CATALOG',
  schemaVersion: 1,
});

const serialize = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

beforeEach(async () => {
  await rm(targetCodeSentinelUrl, { force: true });
});

afterEach(async () => {
  await rm(targetCodeSentinelUrl, { force: true });
});

describe('initial rule-catalog integration', () => {
  it('matches the complete controlled result with one deterministic finding per stable rule', async () => {
    const { expected, model } = await readCatalogFixture();
    const loadedRules = loadRules({ registry: initialRuleRegistry });
    const firstEvaluation = evaluateRules({ loadedRules, model });
    const secondEvaluation = evaluateRules({ loadedRules, model });
    const firstScenario = await buildObservedScenario(model, firstEvaluation);
    const secondScenario = await buildObservedScenario(model, secondEvaluation);

    expect(firstScenario).toEqual(expected);
    expect(serialize(secondScenario)).toBe(serialize(firstScenario));
    expect(firstScenario.analysis.targetCodeExecuted).toBe(false);
    expect(firstEvaluation.errors).toEqual([]);
    expect(firstEvaluation.summary).toEqual({
      availableRuleCount: 8,
      enabledRuleCount: 8,
      executedRuleCount: 8,
      failedRuleCount: 0,
      findingCount: 8,
      succeededRuleCount: 8,
    });
    expect(firstEvaluation.findings.map((finding) => finding.ruleId)).toEqual(expectedRuleIds);

    const metadataByRuleId = new Map(
      initialRuleRegistry.rules.map((rule) => [rule.metadata.id, rule.metadata]),
    );
    const locationOffsets = new Set<number>();

    for (const ruleId of expectedRuleIds) {
      expect(firstEvaluation.findings.filter((finding) => finding.ruleId === ruleId)).toHaveLength(
        1,
      );
    }

    for (const finding of firstEvaluation.findings) {
      const metadata = metadataByRuleId.get(finding.ruleId);

      expect(metadata).toBeDefined();

      if (metadata === undefined) {
        throw new TypeError('Expected finding metadata from the initial rule registry.');
      }

      expect(metadata.status).toBe('stable');
      expect(finding).toMatchObject({
        category: metadata.category,
        explanation: metadata.explanation,
        recommendation: metadata.recommendation,
        reference: metadata.reference,
        ruleTitle: metadata.title,
        severity: metadata.defaultSeverity,
      });
      expect(finding.limitations).toEqual(metadata.limitations);
      expect(finding.limitations).not.toBe(metadata.limitations);
      expect(finding.limitations.length).toBeGreaterThan(0);
      expect(finding.location).not.toBeNull();

      if (finding.location === null) {
        throw new TypeError('Expected a source location for every controlled catalog finding.');
      }

      expect(finding.location.filePath).toBe(catalogFilePath);
      expect(finding.location.start.offset).toBeLessThan(finding.location.end.offset);
      locationOffsets.add(finding.location.start.offset);
    }

    expect(locationOffsets.size).toBe(8);
  });

  it('intersects category and rule-ID filters over the complete initial registry', async () => {
    const { expected, model } = await readCatalogFixture();
    const loadedRules = loadRules({
      filters: {
        categories: ['seo'],
        ruleIds: ['performance/img-dimensions', 'seo/multiple-h1'],
      },
      registry: initialRuleRegistry,
    });
    const result = evaluateRules({ loadedRules, model });

    expect(loadedRules.rules.map((rule) => rule.metadata.id)).toEqual(['seo/multiple-h1']);
    expect(result.errors).toEqual([]);
    expect(result.findings).toEqual(
      expected.evaluation.findings.filter((finding) => finding.ruleId === 'seo/multiple-h1'),
    );
    expect(result.summary).toEqual({
      availableRuleCount: 8,
      enabledRuleCount: 1,
      executedRuleCount: 1,
      failedRuleCount: 0,
      findingCount: 1,
      succeededRuleCount: 1,
    });
  });

  it('isolates one throwing rule without exposing its error or losing catalog siblings', async () => {
    const { expected, model } = await readCatalogFixture();
    const privateFailureDetail = 'private rule-catalog integration failure detail';
    const throwingEvaluate = vi.fn<Rule['evaluate']>(() => {
      throw new Error(privateFailureDetail);
    });
    const throwingRule: Rule = {
      evaluate: throwingEvaluate,
      metadata: {
        category: 'seo',
        defaultSeverity: 'medium',
        explanation: 'Controlled integration-only failure sentinel.',
        id: 'seo/catalog-failure-sentinel',
        limitations: ['This rule exists only to verify catalog failure isolation.'],
        recommendation: 'Keep sibling rule results when one rule fails.',
        reference: null,
        status: 'stable',
        title: 'Catalog failure sentinel',
      },
    };
    const registry = createRuleRegistry([...initialRuleRegistry.rules, throwingRule]);
    const result = evaluateRules({
      loadedRules: loadRules({ registry }),
      model,
    });

    expect(throwingEvaluate).toHaveBeenCalledOnce();
    expect(result.findings).toEqual(expected.evaluation.findings);
    expect(result.errors).toEqual([
      {
        category: 'seo',
        code: RULE_EXECUTION_ERROR_CODES.evaluationFailed,
        message: 'Rule evaluation failed.',
        recoverable: true,
        ruleId: 'seo/catalog-failure-sentinel',
      },
    ]);
    expect(result.summary).toEqual({
      availableRuleCount: 9,
      enabledRuleCount: 9,
      executedRuleCount: 9,
      failedRuleCount: 1,
      findingCount: 8,
      succeededRuleCount: 8,
    });
    expect(JSON.stringify(result)).not.toContain(privateFailureDetail);
    expect(await fileExists(targetCodeSentinelUrl)).toBe(false);
  });
});

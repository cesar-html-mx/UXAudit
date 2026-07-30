import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  DETECTION_CASE_CLASSIFICATIONS,
  DETECTION_METRICS_ERROR_CODES,
  DetectionMetricsError,
  calculateRuleDetectionMetrics,
  type CalculateRuleDetectionMetricsRequest,
  type RuleDetectionMetrics,
} from '../../src/validation/detection-metrics.js';

const createRequest = (): CalculateRuleDetectionMetricsRequest => ({
  cases: [
    {
      caseId: 'seo-positive-detected',
      classification: DETECTION_CASE_CLASSIFICATIONS.positive,
      detected: true,
      ruleId: 'seo/multiple-h1',
    },
    {
      caseId: 'seo-positive-missed',
      classification: DETECTION_CASE_CLASSIFICATIONS.positive,
      detected: false,
      ruleId: 'seo/multiple-h1',
    },
    {
      caseId: 'seo-negative-detected',
      classification: DETECTION_CASE_CLASSIFICATIONS.negative,
      detected: true,
      ruleId: 'seo/multiple-h1',
    },
    {
      caseId: 'seo-negative-clear',
      classification: DETECTION_CASE_CLASSIFICATIONS.negative,
      detected: false,
      ruleId: 'seo/multiple-h1',
    },
    {
      caseId: 'seo-unsupported-detected',
      classification: DETECTION_CASE_CLASSIFICATIONS.unsupported,
      detected: true,
      ruleId: 'seo/multiple-h1',
    },
    {
      caseId: 'seo-unsupported-clear',
      classification: DETECTION_CASE_CLASSIFICATIONS.unsupported,
      detected: false,
      ruleId: 'seo/multiple-h1',
    },
    {
      caseId: 'accessibility-negative-clear',
      classification: DETECTION_CASE_CLASSIFICATIONS.negative,
      detected: false,
      ruleId: 'accessibility/img-alt',
    },
  ],
  ruleIds: ['seo/multiple-h1', 'performance/img-dimensions', 'accessibility/img-alt'],
  unmatchedFindingsByRule: {
    'performance/img-dimensions': 2,
    'seo/multiple-h1': 2,
  },
});

const expectInvalidInput = (value: unknown): void => {
  expect(() =>
    calculateRuleDetectionMetrics(value as CalculateRuleDetectionMetricsRequest),
  ).toThrow(DetectionMetricsError);
};

describe('calculateRuleDetectionMetrics', () => {
  it('calculates exact per-rule confusion matrices and unsupported observations', () => {
    const result = calculateRuleDetectionMetrics(createRequest());

    expect(result).toEqual([
      {
        falseNegativeCount: 0,
        falsePositiveCount: 0,
        precision: null,
        recall: null,
        ruleId: 'accessibility/img-alt',
        trueNegativeCount: 1,
        truePositiveCount: 0,
        unmatchedFindingCount: 0,
        unsupportedCount: 0,
        unsupportedDetectedCount: 0,
      },
      {
        falseNegativeCount: 0,
        falsePositiveCount: 2,
        precision: 0,
        recall: null,
        ruleId: 'performance/img-dimensions',
        trueNegativeCount: 0,
        truePositiveCount: 0,
        unmatchedFindingCount: 2,
        unsupportedCount: 0,
        unsupportedDetectedCount: 0,
      },
      {
        falseNegativeCount: 1,
        falsePositiveCount: 3,
        precision: 0.25,
        recall: 0.5,
        ruleId: 'seo/multiple-h1',
        trueNegativeCount: 1,
        truePositiveCount: 1,
        unmatchedFindingCount: 2,
        unsupportedCount: 2,
        unsupportedDetectedCount: 1,
      },
    ]);
    expectTypeOf(result).toEqualTypeOf<readonly RuleDetectionMetrics[]>();
  });

  it('sorts rules ordinally, does not mutate input, and returns frozen data', () => {
    const request = createRequest();
    const originalRuleIds = [...request.ruleIds];
    const originalCases = request.cases.map((observation) => ({ ...observation }));
    const result = calculateRuleDetectionMetrics(request);

    expect(request.ruleIds).toEqual(originalRuleIds);
    expect(request.cases).toEqual(originalCases);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.every((metrics) => Object.isFrozen(metrics))).toBe(true);
  });

  it('accepts an empty closed data set', () => {
    expect(
      calculateRuleDetectionMetrics({
        cases: [],
        ruleIds: [],
        unmatchedFindingsByRule: {},
      }),
    ).toEqual([]);
  });

  it('scopes case identity by rule', () => {
    expect(
      calculateRuleDetectionMetrics({
        cases: [
          {
            caseId: 'shared-image',
            classification: 'positive',
            detected: true,
            ruleId: 'accessibility/img-alt',
          },
          {
            caseId: 'shared-image',
            classification: 'negative',
            detected: false,
            ruleId: 'performance/img-dimensions',
          },
        ],
        ruleIds: ['performance/img-dimensions', 'accessibility/img-alt'],
        unmatchedFindingsByRule: {},
      }),
    ).toMatchObject([
      {
        ruleId: 'accessibility/img-alt',
        truePositiveCount: 1,
      },
      {
        ruleId: 'performance/img-dimensions',
        trueNegativeCount: 1,
      },
    ]);
  });

  it('exposes one stable generic input error without retaining hostile details', () => {
    let accessed = false;
    const hostile = {
      cases: [],
      get ruleIds(): readonly string[] {
        accessed = true;
        throw new Error('private target detail');
      },
      unmatchedFindingsByRule: {},
    };

    try {
      calculateRuleDetectionMetrics(hostile);
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(DetectionMetricsError);
      expect(error).toMatchObject({
        code: DETECTION_METRICS_ERROR_CODES.invalidInput,
        message: 'Detection metrics input is invalid.',
        name: 'DetectionMetricsError',
      });
      expect(String(error)).not.toContain('private target detail');
    }

    expect(accessed).toBe(false);
  });

  it.each([
    ['non-record request', null],
    ['unknown request key', { ...createRequest(), extra: true }],
    [
      'missing request key',
      {
        cases: createRequest().cases,
        ruleIds: createRequest().ruleIds,
      },
    ],
    [
      'duplicate rule IDs',
      {
        ...createRequest(),
        ruleIds: ['seo/multiple-h1', 'seo/multiple-h1'],
      },
    ],
    [
      'malformed rule ID',
      {
        ...createRequest(),
        ruleIds: ['multiple-h1'],
      },
    ],
    [
      'duplicate case IDs',
      {
        ...createRequest(),
        cases: [
          {
            caseId: 'duplicate-case',
            classification: 'positive',
            detected: true,
            ruleId: 'seo/multiple-h1',
          },
          {
            caseId: 'duplicate-case',
            classification: 'positive',
            detected: false,
            ruleId: 'seo/multiple-h1',
          },
        ],
      },
    ],
    [
      'unknown case rule',
      {
        ...createRequest(),
        cases: [
          {
            caseId: 'unknown-rule-case',
            classification: 'positive',
            detected: true,
            ruleId: 'seo/unknown',
          },
        ],
      },
    ],
    [
      'unknown case key',
      {
        ...createRequest(),
        cases: [
          {
            ...createRequest().cases[0],
            note: 'not closed',
          },
        ],
      },
    ],
    [
      'invalid classification',
      {
        ...createRequest(),
        cases: [
          {
            ...createRequest().cases[0],
            classification: 'ambiguous',
          },
        ],
      },
    ],
    [
      'non-boolean detection',
      {
        ...createRequest(),
        cases: [
          {
            ...createRequest().cases[0],
            detected: 1,
          },
        ],
      },
    ],
    [
      'unknown unmatched-finding rule',
      {
        ...createRequest(),
        unmatchedFindingsByRule: { 'seo/unknown': 1 },
      },
    ],
    [
      'negative unmatched-finding count',
      {
        ...createRequest(),
        unmatchedFindingsByRule: { 'seo/multiple-h1': -1 },
      },
    ],
    [
      'fractional unmatched-finding count',
      {
        ...createRequest(),
        unmatchedFindingsByRule: { 'seo/multiple-h1': 0.5 },
      },
    ],
    [
      'overflowing false-positive count',
      {
        cases: [
          {
            caseId: 'overflow-negative',
            classification: 'negative',
            detected: true,
            ruleId: 'seo/multiple-h1',
          },
        ],
        ruleIds: ['seo/multiple-h1'],
        unmatchedFindingsByRule: {
          'seo/multiple-h1': Number.MAX_SAFE_INTEGER,
        },
      },
    ],
    [
      'overflowing precision denominator',
      {
        cases: [
          {
            caseId: 'overflow-positive',
            classification: 'positive',
            detected: true,
            ruleId: 'seo/multiple-h1',
          },
        ],
        ruleIds: ['seo/multiple-h1'],
        unmatchedFindingsByRule: {
          'seo/multiple-h1': Number.MAX_SAFE_INTEGER,
        },
      },
    ],
  ])('rejects %s', (_description, value) => {
    expectInvalidInput(value);
  });

  it('rejects sparse and exotic arrays and records', () => {
    const sparseCases = new Array<unknown>(1);
    const exoticRuleIds = ['seo/multiple-h1'];
    Object.setPrototypeOf(exoticRuleIds, null);
    const exoticRequest = Object.create({ inherited: true }) as Record<string, unknown>;
    exoticRequest['cases'] = [];
    exoticRequest['ruleIds'] = [];
    exoticRequest['unmatchedFindingsByRule'] = {};

    expectInvalidInput({
      ...createRequest(),
      cases: sparseCases,
    });
    expectInvalidInput({
      ...createRequest(),
      ruleIds: exoticRuleIds,
    });
    expectInvalidInput(exoticRequest);
    expectInvalidInput(
      new Proxy(createRequest(), {
        ownKeys: () => {
          throw new Error('private proxy detail');
        },
      }),
    );
  });
});

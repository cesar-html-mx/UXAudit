import { types as utilityTypes } from 'node:util';

export const DETECTION_CASE_CLASSIFICATIONS = Object.freeze({
  negative: 'negative',
  positive: 'positive',
  unsupported: 'unsupported',
} as const);

export const DETECTION_METRICS_ERROR_CODES = Object.freeze({
  invalidInput: 'DETECTION_METRICS_INVALID_INPUT',
} as const);

export type DetectionCaseClassification =
  (typeof DETECTION_CASE_CLASSIFICATIONS)[keyof typeof DETECTION_CASE_CLASSIFICATIONS];

export class DetectionMetricsError extends Error {
  public readonly code = DETECTION_METRICS_ERROR_CODES.invalidInput;

  public constructor() {
    super('Detection metrics input is invalid.');
    this.name = 'DetectionMetricsError';
  }
}

export interface DetectionCaseObservation {
  readonly caseId: string;
  readonly classification: DetectionCaseClassification;
  readonly detected: boolean;
  readonly ruleId: string;
}

export interface CalculateRuleDetectionMetricsRequest {
  readonly cases: readonly DetectionCaseObservation[];
  readonly ruleIds: readonly string[];
  readonly unmatchedFindingsByRule: Readonly<Record<string, number>>;
}

export interface RuleDetectionMetrics {
  readonly falseNegativeCount: number;
  readonly falsePositiveCount: number;
  readonly precision: number | null;
  readonly recall: number | null;
  readonly ruleId: string;
  readonly trueNegativeCount: number;
  readonly truePositiveCount: number;
  readonly unmatchedFindingCount: number;
  readonly unsupportedCount: number;
  readonly unsupportedDetectedCount: number;
}

interface MutableRuleDetectionCounts {
  falseNegativeCount: number;
  falsePositiveCount: number;
  trueNegativeCount: number;
  truePositiveCount: number;
  unsupportedCount: number;
  unsupportedDetectedCount: number;
}

const requestKeys = new Set(['cases', 'ruleIds', 'unmatchedFindingsByRule']);
const caseKeys = new Set(['caseId', 'classification', 'detected', 'ruleId']);
const ruleIdPattern = /^[a-z]+\/[a-z0-9-]+$/u;
const classifications: ReadonlySet<string> = new Set(Object.values(DETECTION_CASE_CLASSIFICATIONS));

const compareOrdinal = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const requirePlainDataRecord = (
  value: unknown,
  isAllowedKey: (key: string) => boolean,
): Readonly<Record<string, PropertyDescriptor>> => {
  if (
    typeof value !== 'object' ||
    value === null ||
    utilityTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    throw new DetectionMetricsError();
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  if (prototype !== Object.prototype && prototype !== null) {
    throw new DetectionMetricsError();
  }

  const ownKeys = Reflect.ownKeys(value);

  if (
    ownKeys.some((key) => typeof key !== 'string' || !isAllowedKey(key)) ||
    new Set(ownKeys).size !== ownKeys.length
  ) {
    throw new DetectionMetricsError();
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);

  for (const key of ownKeys) {
    if (typeof key !== 'string') {
      throw new DetectionMetricsError();
    }

    const descriptor = descriptors[key];

    if (descriptor === undefined || !('value' in descriptor) || descriptor.enumerable !== true) {
      throw new DetectionMetricsError();
    }
  }

  return descriptors;
};

const requireClosedRecord = (
  value: unknown,
  allowedKeys: ReadonlySet<string>,
): Readonly<Record<string, PropertyDescriptor>> => {
  const descriptors = requirePlainDataRecord(value, (key) => allowedKeys.has(key));

  if (
    Object.keys(descriptors).length !== allowedKeys.size ||
    [...allowedKeys].some((key) => descriptors[key] === undefined)
  ) {
    throw new DetectionMetricsError();
  }

  return descriptors;
};

const readDescriptorValue = (
  descriptors: Readonly<Record<string, PropertyDescriptor>>,
  key: string,
): unknown => descriptors[key]?.value;

const requirePlainArrayValues = (value: unknown): readonly unknown[] => {
  if (
    typeof value !== 'object' ||
    value === null ||
    utilityTypes.isProxy(value) ||
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) {
    throw new DetectionMetricsError();
  }

  const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
  const length = lengthDescriptor?.value;

  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) {
    throw new DetectionMetricsError();
  }

  const ownKeys = Reflect.ownKeys(value);

  if (
    ownKeys.length !== length + 1 ||
    ownKeys.some(
      (key) => typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key)),
    )
  ) {
    throw new DetectionMetricsError();
  }

  const values: unknown[] = [];

  for (let index = 0; index < length; index += 1) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));

    if (descriptor === undefined || !('value' in descriptor) || descriptor.enumerable !== true) {
      throw new DetectionMetricsError();
    }

    values.push(descriptor.value);
  }

  return values;
};

const requireCanonicalId = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value !== value.trim() ||
    !value.isWellFormed()
  ) {
    throw new DetectionMetricsError();
  }

  return value;
};

const requireRuleIds = (value: unknown): readonly string[] => {
  const ruleIds = requirePlainArrayValues(value).map((candidate) => {
    const ruleId = requireCanonicalId(candidate);

    if (!ruleIdPattern.test(ruleId)) {
      throw new DetectionMetricsError();
    }

    return ruleId;
  });

  if (new Set(ruleIds).size !== ruleIds.length) {
    throw new DetectionMetricsError();
  }

  return ruleIds.sort(compareOrdinal);
};

const requireCases = (
  value: unknown,
  knownRuleIds: ReadonlySet<string>,
): readonly DetectionCaseObservation[] => {
  const caseIdsByRule = new Set<string>();

  return requirePlainArrayValues(value).map((candidate) => {
    const descriptors = requireClosedRecord(candidate, caseKeys);
    const caseId = requireCanonicalId(readDescriptorValue(descriptors, 'caseId'));
    const classification = readDescriptorValue(descriptors, 'classification');
    const detected = readDescriptorValue(descriptors, 'detected');
    const ruleId = requireCanonicalId(readDescriptorValue(descriptors, 'ruleId'));
    const scopedCaseId = `${ruleId}\u0000${caseId}`;

    if (
      caseIdsByRule.has(scopedCaseId) ||
      !classifications.has(classification as string) ||
      typeof detected !== 'boolean' ||
      !knownRuleIds.has(ruleId)
    ) {
      throw new DetectionMetricsError();
    }

    caseIdsByRule.add(scopedCaseId);

    return {
      caseId,
      classification: classification as DetectionCaseClassification,
      detected,
      ruleId,
    };
  });
};

const requireUnmatchedFindings = (
  value: unknown,
  knownRuleIds: ReadonlySet<string>,
): ReadonlyMap<string, number> => {
  const descriptors = requirePlainDataRecord(value, (key) => knownRuleIds.has(key));
  const counts = new Map<string, number>();

  for (const [ruleId, descriptor] of Object.entries(descriptors)) {
    const count: unknown = descriptor.value;

    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
      throw new DetectionMetricsError();
    }

    counts.set(ruleId, count);
  }

  return counts;
};

const createCounts = (): MutableRuleDetectionCounts => ({
  falseNegativeCount: 0,
  falsePositiveCount: 0,
  trueNegativeCount: 0,
  truePositiveCount: 0,
  unsupportedCount: 0,
  unsupportedDetectedCount: 0,
});

const addCase = (
  counts: MutableRuleDetectionCounts,
  observation: DetectionCaseObservation,
): void => {
  if (observation.classification === DETECTION_CASE_CLASSIFICATIONS.positive) {
    if (observation.detected) {
      counts.truePositiveCount += 1;
    } else {
      counts.falseNegativeCount += 1;
    }
    return;
  }

  if (observation.classification === DETECTION_CASE_CLASSIFICATIONS.negative) {
    if (observation.detected) {
      counts.falsePositiveCount += 1;
    } else {
      counts.trueNegativeCount += 1;
    }
    return;
  }

  counts.unsupportedCount += 1;

  if (observation.detected) {
    counts.unsupportedDetectedCount += 1;
  }
};

const calculateRatio = (numerator: number, denominator: number): number | null =>
  denominator === 0 ? null : numerator / denominator;

const calculateValidatedMetrics = (
  ruleIds: readonly string[],
  cases: readonly DetectionCaseObservation[],
  unmatchedFindings: ReadonlyMap<string, number>,
): readonly RuleDetectionMetrics[] => {
  const countsByRule = new Map(ruleIds.map((ruleId) => [ruleId, createCounts()] as const));

  for (const observation of cases) {
    const counts = countsByRule.get(observation.ruleId);

    if (counts === undefined) {
      throw new DetectionMetricsError();
    }

    addCase(counts, observation);
  }

  const metrics = ruleIds.map((ruleId): RuleDetectionMetrics => {
    const counts = countsByRule.get(ruleId);
    const unmatchedFindingCount = unmatchedFindings.get(ruleId) ?? 0;

    if (counts === undefined) {
      throw new DetectionMetricsError();
    }

    const falsePositiveCount = counts.falsePositiveCount + unmatchedFindingCount;
    const precisionDenominator = counts.truePositiveCount + falsePositiveCount;
    const recallDenominator = counts.truePositiveCount + counts.falseNegativeCount;

    if (
      !Number.isSafeInteger(falsePositiveCount) ||
      !Number.isSafeInteger(precisionDenominator) ||
      !Number.isSafeInteger(recallDenominator)
    ) {
      throw new DetectionMetricsError();
    }

    return Object.freeze({
      falseNegativeCount: counts.falseNegativeCount,
      falsePositiveCount,
      precision: calculateRatio(counts.truePositiveCount, precisionDenominator),
      recall: calculateRatio(counts.truePositiveCount, recallDenominator),
      ruleId,
      trueNegativeCount: counts.trueNegativeCount,
      truePositiveCount: counts.truePositiveCount,
      unmatchedFindingCount,
      unsupportedCount: counts.unsupportedCount,
      unsupportedDetectedCount: counts.unsupportedDetectedCount,
    });
  });

  return Object.freeze(metrics);
};

export const calculateRuleDetectionMetrics = (
  request: CalculateRuleDetectionMetricsRequest,
): readonly RuleDetectionMetrics[] => {
  try {
    const descriptors = requireClosedRecord(request, requestKeys);
    const ruleIds = requireRuleIds(descriptors['ruleIds']?.value);
    const knownRuleIds = new Set(ruleIds);
    const cases = requireCases(descriptors['cases']?.value, knownRuleIds);
    const unmatchedFindings = requireUnmatchedFindings(
      descriptors['unmatchedFindingsByRule']?.value,
      knownRuleIds,
    );

    return calculateValidatedMetrics(ruleIds, cases, unmatchedFindings);
  } catch (error) {
    if (error instanceof DetectionMetricsError) {
      throw error;
    }

    throw new DetectionMetricsError();
  }
};

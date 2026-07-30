import { types as utilityTypes } from 'node:util';

export const PERFORMANCE_SUMMARY_ERROR_CODES = Object.freeze({
  invalidInput: 'PERFORMANCE_SUMMARY_INVALID_INPUT',
} as const);

export class PerformanceSummaryError extends Error {
  public readonly code = PERFORMANCE_SUMMARY_ERROR_CODES.invalidInput;

  public constructor() {
    super('Performance summary input is invalid.');
    this.name = 'PerformanceSummaryError';
  }
}

export interface PerformanceScale {
  readonly componentCount: number;
  readonly sourceFileCount: number;
}

export interface PerformanceSample {
  readonly durationMs: number;
  readonly peakRssBytes: number | null;
  readonly run: number;
}

export interface CreatePerformanceSummaryRequest {
  readonly environment: string;
  readonly samples: readonly PerformanceSample[];
  readonly scale: PerformanceScale;
}

export interface PerformanceDistribution {
  readonly max: number;
  readonly median: number;
  readonly min: number;
  readonly values: readonly number[];
}

export interface ObservedPeakRssDistribution extends PerformanceDistribution {
  readonly measurement: 'observed-linux-proc';
}

export interface UnavailablePeakRssDistribution {
  readonly max: null;
  readonly measurement: 'unavailable';
  readonly median: null;
  readonly min: null;
  readonly values: readonly [];
}

export interface PerformanceSummary {
  readonly durations: PerformanceDistribution;
  readonly environment: string;
  readonly peakRss: ObservedPeakRssDistribution | UnavailablePeakRssDistribution;
  readonly runCount: number;
  readonly scale: PerformanceScale;
}

const requestKeys = new Set(['environment', 'samples', 'scale']);
const sampleKeys = new Set(['durationMs', 'peakRssBytes', 'run']);
const scaleKeys = new Set(['componentCount', 'sourceFileCount']);
const minimumRunCount = 3;

const requireClosedRecord = (
  value: unknown,
  allowedKeys: ReadonlySet<string>,
): Readonly<Record<string, PropertyDescriptor>> => {
  if (
    typeof value !== 'object' ||
    value === null ||
    utilityTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    throw new PerformanceSummaryError();
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  if (prototype !== Object.prototype && prototype !== null) {
    throw new PerformanceSummaryError();
  }

  const ownKeys = Reflect.ownKeys(value);

  if (
    ownKeys.length !== allowedKeys.size ||
    ownKeys.some((key) => typeof key !== 'string' || !allowedKeys.has(key))
  ) {
    throw new PerformanceSummaryError();
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);

  for (const key of allowedKeys) {
    const descriptor = descriptors[key];

    if (descriptor === undefined || !('value' in descriptor) || descriptor.enumerable !== true) {
      throw new PerformanceSummaryError();
    }
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
    throw new PerformanceSummaryError();
  }

  const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
  const length = lengthDescriptor?.value;

  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < minimumRunCount) {
    throw new PerformanceSummaryError();
  }

  const ownKeys = Reflect.ownKeys(value);

  if (
    ownKeys.length !== length + 1 ||
    ownKeys.some(
      (key) => typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key)),
    )
  ) {
    throw new PerformanceSummaryError();
  }

  const values: unknown[] = [];

  for (let index = 0; index < length; index += 1) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));

    if (descriptor === undefined || !('value' in descriptor) || descriptor.enumerable !== true) {
      throw new PerformanceSummaryError();
    }

    values.push(descriptor.value);
  }

  return values;
};

const requireEnvironment = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value !== value.trim() ||
    !value.isWellFormed()
  ) {
    throw new PerformanceSummaryError();
  }

  return value;
};

const requireNonNegativeSafeInteger = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new PerformanceSummaryError();
  }

  return value;
};

const requirePositiveSafeInteger = (value: unknown): number => {
  const integer = requireNonNegativeSafeInteger(value);

  if (integer === 0) {
    throw new PerformanceSummaryError();
  }

  return integer;
};

const requireDuration = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new PerformanceSummaryError();
  }

  return value;
};

const requireScale = (value: unknown): PerformanceScale => {
  const descriptors = requireClosedRecord(value, scaleKeys);

  return {
    componentCount: requireNonNegativeSafeInteger(
      readDescriptorValue(descriptors, 'componentCount'),
    ),
    sourceFileCount: requireNonNegativeSafeInteger(
      readDescriptorValue(descriptors, 'sourceFileCount'),
    ),
  };
};

const requireSamples = (value: unknown): readonly PerformanceSample[] => {
  const samples = requirePlainArrayValues(value).map((candidate) => {
    const descriptors = requireClosedRecord(candidate, sampleKeys);
    const peakRssValue = readDescriptorValue(descriptors, 'peakRssBytes');

    return {
      durationMs: requireDuration(readDescriptorValue(descriptors, 'durationMs')),
      peakRssBytes: peakRssValue === null ? null : requireNonNegativeSafeInteger(peakRssValue),
      run: requirePositiveSafeInteger(readDescriptorValue(descriptors, 'run')),
    };
  });

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];

    if (
      previous === undefined ||
      current === undefined ||
      previous.run === Number.MAX_SAFE_INTEGER ||
      current.run !== previous.run + 1
    ) {
      throw new PerformanceSummaryError();
    }
  }

  return samples;
};

const median = (sortedValues: readonly number[]): number => {
  const middle = Math.floor(sortedValues.length / 2);
  const upper = sortedValues[middle];

  if (upper === undefined) {
    throw new PerformanceSummaryError();
  }

  if (sortedValues.length % 2 === 1) {
    return upper;
  }

  const lower = sortedValues[middle - 1];

  if (lower === undefined) {
    throw new PerformanceSummaryError();
  }

  return lower + (upper - lower) / 2;
};

const createDistribution = (values: readonly number[]): PerformanceDistribution => {
  const copiedValues = Object.freeze([...values]);
  const sortedValues = [...values].sort((left, right) => left - right);
  const minimum = sortedValues[0];
  const maximum = sortedValues.at(-1);

  if (minimum === undefined || maximum === undefined) {
    throw new PerformanceSummaryError();
  }

  return Object.freeze({
    max: maximum,
    median: median(sortedValues),
    min: minimum,
    values: copiedValues,
  });
};

const createPeakRssDistribution = (
  samples: readonly PerformanceSample[],
): ObservedPeakRssDistribution | UnavailablePeakRssDistribution => {
  const observedValues = samples
    .map(({ peakRssBytes }) => peakRssBytes)
    .filter((value): value is number => value !== null);

  if (observedValues.length === 0) {
    const values: readonly [] = Object.freeze([] as const);

    return Object.freeze({
      max: null,
      measurement: 'unavailable',
      median: null,
      min: null,
      values,
    });
  }

  if (observedValues.length !== samples.length) {
    throw new PerformanceSummaryError();
  }

  return Object.freeze({
    measurement: 'observed-linux-proc',
    ...createDistribution(observedValues),
  });
};

export const createPerformanceSummary = (
  request: CreatePerformanceSummaryRequest,
): PerformanceSummary => {
  try {
    const descriptors = requireClosedRecord(request, requestKeys);
    const environment = requireEnvironment(readDescriptorValue(descriptors, 'environment'));
    const scale = requireScale(readDescriptorValue(descriptors, 'scale'));
    const samples = requireSamples(readDescriptorValue(descriptors, 'samples'));

    return Object.freeze({
      durations: createDistribution(samples.map(({ durationMs }) => durationMs)),
      environment,
      peakRss: createPeakRssDistribution(samples),
      runCount: samples.length,
      scale: Object.freeze(scale),
    });
  } catch (error) {
    if (error instanceof PerformanceSummaryError) {
      throw error;
    }

    throw new PerformanceSummaryError();
  }
};

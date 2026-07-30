import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  PERFORMANCE_SUMMARY_ERROR_CODES,
  PerformanceSummaryError,
  createPerformanceSummary,
  type CreatePerformanceSummaryRequest,
  type PerformanceSummary,
} from '../../src/validation/performance-summary.js';

const createRequest = (): CreatePerformanceSummaryRequest => ({
  environment: 'Node.js 24.18.0 / linux x64',
  samples: [
    {
      durationMs: 14.5,
      peakRssBytes: 120_000,
      run: 1,
    },
    {
      durationMs: 11,
      peakRssBytes: 100_000,
      run: 2,
    },
    {
      durationMs: 21.25,
      peakRssBytes: 160_000,
      run: 3,
    },
    {
      durationMs: 13,
      peakRssBytes: 140_000,
      run: 4,
    },
  ],
  scale: {
    componentCount: 240,
    sourceFileCount: 240,
  },
});

const expectInvalidInput = (value: unknown): void => {
  expect(() => createPerformanceSummary(value as CreatePerformanceSummaryRequest)).toThrow(
    PerformanceSummaryError,
  );
};

describe('createPerformanceSummary', () => {
  it('summarizes durations and fully observed Linux RSS samples', () => {
    const result = createPerformanceSummary(createRequest());

    expect(result).toEqual({
      durations: {
        max: 21.25,
        median: 13.75,
        min: 11,
        values: [14.5, 11, 21.25, 13],
      },
      environment: 'Node.js 24.18.0 / linux x64',
      peakRss: {
        max: 160_000,
        measurement: 'observed-linux-proc',
        median: 130_000,
        min: 100_000,
        values: [120_000, 100_000, 160_000, 140_000],
      },
      runCount: 4,
      scale: {
        componentCount: 240,
        sourceFileCount: 240,
      },
    });
    expectTypeOf(result).toEqualTypeOf<PerformanceSummary>();
  });

  it('reports unavailable RSS only when every sample is unobserved', () => {
    const request = createRequest();
    const result = createPerformanceSummary({
      ...request,
      samples: request.samples.map((sample) => ({
        ...sample,
        peakRssBytes: null,
      })),
    });

    expect(result.peakRss).toEqual({
      max: null,
      measurement: 'unavailable',
      median: null,
      min: null,
      values: [],
    });
  });

  it('accepts three consecutive runs starting at any positive identifier and decimal durations', () => {
    const request = createRequest();

    expect(
      createPerformanceSummary({
        ...request,
        samples: [
          { durationMs: 0, peakRssBytes: null, run: 7 },
          { durationMs: 0.125, peakRssBytes: null, run: 8 },
          { durationMs: 1.5, peakRssBytes: null, run: 9 },
        ],
        scale: {
          componentCount: 0,
          sourceFileCount: 0,
        },
      }),
    ).toMatchObject({
      durations: {
        max: 1.5,
        median: 0.125,
        min: 0,
      },
      runCount: 3,
    });
  });

  it('does not mutate input and returns recursively frozen output', () => {
    const request = createRequest();
    const original = structuredClone(request);
    const result = createPerformanceSummary(request);

    expect(request).toEqual(original);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.scale)).toBe(true);
    expect(Object.isFrozen(result.durations)).toBe(true);
    expect(Object.isFrozen(result.durations.values)).toBe(true);
    expect(Object.isFrozen(result.peakRss)).toBe(true);
    expect(Object.isFrozen(result.peakRss.values)).toBe(true);
  });

  it('exposes one typed generic error without reading hostile accessors', () => {
    let accessed = false;
    const hostile = {
      get environment(): string {
        accessed = true;
        throw new Error('private performance detail');
      },
      samples: createRequest().samples,
      scale: createRequest().scale,
    };

    try {
      createPerformanceSummary(hostile);
      throw new Error('Expected performance validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(PerformanceSummaryError);
      expect(error).toMatchObject({
        code: PERFORMANCE_SUMMARY_ERROR_CODES.invalidInput,
        message: 'Performance summary input is invalid.',
        name: 'PerformanceSummaryError',
      });
      expect(String(error)).not.toContain('private performance detail');
    }

    expect(accessed).toBe(false);
  });

  it.each([
    ['non-record request', null],
    ['unknown request key', { ...createRequest(), unknown: true }],
    [
      'missing request key',
      {
        environment: createRequest().environment,
        samples: createRequest().samples,
      },
    ],
    ['empty environment', { ...createRequest(), environment: '' }],
    ['untrimmed environment', { ...createRequest(), environment: ' linux ' }],
    [
      'unknown scale key',
      {
        ...createRequest(),
        scale: {
          ...createRequest().scale,
          projectCount: 1,
        },
      },
    ],
    [
      'fractional source count',
      {
        ...createRequest(),
        scale: {
          ...createRequest().scale,
          sourceFileCount: 1.5,
        },
      },
    ],
    [
      'negative component count',
      {
        ...createRequest(),
        scale: {
          ...createRequest().scale,
          componentCount: -1,
        },
      },
    ],
    ['fewer than three runs', { ...createRequest(), samples: createRequest().samples.slice(0, 2) }],
    [
      'duplicate run',
      {
        ...createRequest(),
        samples: createRequest().samples.map((sample, index) => ({
          ...sample,
          run: index === 2 ? 2 : sample.run,
        })),
      },
    ],
    [
      'gapped run',
      {
        ...createRequest(),
        samples: createRequest().samples.map((sample, index) => ({
          ...sample,
          run: index === 2 ? 4 : sample.run,
        })),
      },
    ],
    [
      'reordered run',
      {
        ...createRequest(),
        samples: [
          createRequest().samples[1],
          createRequest().samples[0],
          ...createRequest().samples.slice(2),
        ],
      },
    ],
    [
      'zero run identifier',
      {
        ...createRequest(),
        samples: createRequest().samples.map((sample, index) => ({
          ...sample,
          run: index,
        })),
      },
    ],
    [
      'negative duration',
      {
        ...createRequest(),
        samples: createRequest().samples.map((sample, index) => ({
          ...sample,
          durationMs: index === 0 ? -1 : sample.durationMs,
        })),
      },
    ],
    [
      'non-finite duration',
      {
        ...createRequest(),
        samples: createRequest().samples.map((sample, index) => ({
          ...sample,
          durationMs: index === 0 ? Number.POSITIVE_INFINITY : sample.durationMs,
        })),
      },
    ],
    [
      'fractional RSS bytes',
      {
        ...createRequest(),
        samples: createRequest().samples.map((sample, index) => ({
          ...sample,
          peakRssBytes: index === 0 ? 1.5 : sample.peakRssBytes,
        })),
      },
    ],
    [
      'negative RSS bytes',
      {
        ...createRequest(),
        samples: createRequest().samples.map((sample, index) => ({
          ...sample,
          peakRssBytes: index === 0 ? -1 : sample.peakRssBytes,
        })),
      },
    ],
    [
      'mixed observed and unavailable RSS',
      {
        ...createRequest(),
        samples: createRequest().samples.map((sample, index) => ({
          ...sample,
          peakRssBytes: index === 0 ? null : sample.peakRssBytes,
        })),
      },
    ],
    [
      'unknown sample key',
      {
        ...createRequest(),
        samples: createRequest().samples.map((sample, index) =>
          index === 0 ? { ...sample, note: 'not closed' } : sample,
        ),
      },
    ],
  ])('rejects %s', (_description, value) => {
    expectInvalidInput(value);
  });

  it('rejects sparse or exotic arrays and records and normalizes throwing proxies', () => {
    const sparseSamples = new Array<unknown>(3);
    const exoticSamples = [...createRequest().samples];
    Object.setPrototypeOf(exoticSamples, null);
    const exoticRequest = Object.create({ inherited: true }) as Record<string, unknown>;
    exoticRequest['environment'] = createRequest().environment;
    exoticRequest['samples'] = createRequest().samples;
    exoticRequest['scale'] = createRequest().scale;

    expectInvalidInput({
      ...createRequest(),
      samples: sparseSamples,
    });
    expectInvalidInput({
      ...createRequest(),
      samples: exoticSamples,
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

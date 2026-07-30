import { describe, expect, it, vi } from 'vitest';

import {
  CONFIGURATION_ERROR_CODES,
  ConfigurationError,
  DEFAULT_AUDIT_CONFIGURATION,
  type AuditConfigurationOverrides,
} from '../../src/configuration/configuration.js';
import { isSafeOutputDirectory } from '../../src/configuration/configuration-validation.js';
import { createLoadAuditConfiguration } from '../../src/configuration/load-configuration.js';
import type { ReadConfigurationFile } from '../../src/configuration/read-configuration-file.js';

const knownRuleIds = ['accessibility/img-alt', 'seo/multiple-h1'] as const;

const createLoader = (text: null | string) => {
  const readFile = vi.fn<ReadConfigurationFile>().mockResolvedValue(text);
  return {
    load: createLoadAuditConfiguration({ knownRuleIds, readFile }),
    readFile,
  };
};

const expectConfigurationError = async (
  promise: Promise<unknown>,
  code: ConfigurationError['code'],
): Promise<void> => {
  await expect(promise).rejects.toEqual(
    expect.objectContaining({
      code,
      name: 'ConfigurationError',
    }),
  );
};

describe('loadAuditConfiguration', () => {
  it('returns complete immutable defaults when the default file is absent', async () => {
    const { load, readFile } = createLoader(null);
    const configuration = await load({ projectRoot: '/controlled/project' });

    expect(configuration).toEqual(DEFAULT_AUDIT_CONFIGURATION);
    expect(configuration).not.toBe(DEFAULT_AUDIT_CONFIGURATION);
    expect(Object.isFrozen(configuration)).toBe(true);
    expect(Object.isFrozen(configuration.formats)).toBe(true);
    expect(readFile).toHaveBeenCalledWith({
      projectRoot: '/controlled/project',
    });
  });

  it('normalizes a partial file and applies CLI replacements over file and defaults', async () => {
    const { load, readFile } = createLoader(
      JSON.stringify({
        categories: ['ux', 'accessibility'],
        color: false,
        formats: ['html', 'terminal', 'json'],
        outputDirectory: 'reports/nested',
        ruleIds: ['seo/multiple-h1', 'accessibility/img-alt'],
        schemaVersion: 1,
        verbose: true,
      }),
    );
    const configuration = await load({
      configurationPath: '/authorized/config.json',
      overrides: {
        categories: [],
        color: true,
        formats: ['json'],
        minimumSeverity: 'high',
        ruleIds: ['accessibility/img-alt'],
      },
      projectRoot: '/controlled/project',
    });

    expect(configuration).toEqual({
      categories: [],
      color: true,
      formats: ['json'],
      minimumSeverity: 'high',
      outputDirectory: 'reports/nested',
      ruleIds: ['accessibility/img-alt'],
      schemaVersion: 1,
      verbose: true,
    });
    expect(readFile).toHaveBeenCalledWith({
      configurationPath: '/authorized/config.json',
      projectRoot: '/controlled/project',
    });
  });

  it('canonicalizes unordered file arrays and preserves explicit null or empty filters', async () => {
    const withFilters = createLoader(
      JSON.stringify({
        categories: ['ux', 'accessibility', 'seo'],
        formats: ['html', 'terminal'],
        ruleIds: ['seo/multiple-h1', 'accessibility/img-alt'],
        schemaVersion: 1,
      }),
    );
    const withNullFilters = createLoader(
      JSON.stringify({
        categories: null,
        ruleIds: null,
        schemaVersion: 1,
      }),
    );
    const withEmptyFilters = createLoader(
      JSON.stringify({
        categories: [],
        ruleIds: [],
        schemaVersion: 1,
      }),
    );

    await expect(withFilters.load({ projectRoot: '/project' })).resolves.toMatchObject({
      categories: ['accessibility', 'seo', 'ux'],
      formats: ['terminal', 'html'],
      ruleIds: ['accessibility/img-alt', 'seo/multiple-h1'],
    });
    await expect(withNullFilters.load({ projectRoot: '/project' })).resolves.toMatchObject({
      categories: null,
      ruleIds: null,
    });
    await expect(withEmptyFilters.load({ projectRoot: '/project' })).resolves.toMatchObject({
      categories: [],
      ruleIds: [],
    });
  });

  it.each([
    ['malformed JSON', '{', CONFIGURATION_ERROR_CODES.invalidJson],
    ['non-object JSON', '[]', CONFIGURATION_ERROR_CODES.invalidConfiguration],
    [
      'missing schema version',
      JSON.stringify({ verbose: true }),
      CONFIGURATION_ERROR_CODES.invalidConfiguration,
    ],
    [
      'unknown schema version',
      JSON.stringify({ schemaVersion: 2 }),
      CONFIGURATION_ERROR_CODES.invalidConfiguration,
    ],
    [
      'unknown key',
      JSON.stringify({ future: true, schemaVersion: 1 }),
      CONFIGURATION_ERROR_CODES.invalidConfiguration,
    ],
    [
      'unknown rule ID',
      JSON.stringify({ ruleIds: ['seo/not-registered'], schemaVersion: 1 }),
      CONFIGURATION_ERROR_CODES.invalidConfiguration,
    ],
    [
      'invalid category',
      JSON.stringify({ categories: ['security'], schemaVersion: 1 }),
      CONFIGURATION_ERROR_CODES.invalidConfiguration,
    ],
    [
      'invalid severity',
      JSON.stringify({ minimumSeverity: 'urgent', schemaVersion: 1 }),
      CONFIGURATION_ERROR_CODES.invalidConfiguration,
    ],
    [
      'empty formats',
      JSON.stringify({ formats: [], schemaVersion: 1 }),
      CONFIGURATION_ERROR_CODES.invalidConfiguration,
    ],
    [
      'duplicate formats',
      JSON.stringify({ formats: ['json', 'json'], schemaVersion: 1 }),
      CONFIGURATION_ERROR_CODES.conflict,
    ],
    [
      'duplicate top-level key',
      '{"schemaVersion":1,"verbose":false,"\\u0076erbose":true}',
      CONFIGURATION_ERROR_CODES.conflict,
    ],
    [
      'unsafe output path',
      JSON.stringify({ outputDirectory: '../outside', schemaVersion: 1 }),
      CONFIGURATION_ERROR_CODES.unsafePath,
    ],
  ] as const)('rejects %s through stable code %s', async (_label, text, code) => {
    const { load } = createLoader(text);
    await expectConfigurationError(load({ projectRoot: '/project' }), code);
  });

  it('rejects exotic CLI objects and accessors without invoking their values', async () => {
    const getter = vi.fn(() => true);
    const accessorOverrides = {};
    Object.defineProperty(accessorOverrides, 'verbose', {
      enumerable: true,
      get: getter,
    });
    const sparseOverrides = {
      categories: new Array(1),
    };
    const { load } = createLoader(null);

    await expectConfigurationError(
      load({
        overrides: accessorOverrides,
        projectRoot: '/project',
      }),
      CONFIGURATION_ERROR_CODES.invalidConfiguration,
    );
    expect(getter).not.toHaveBeenCalled();

    await expectConfigurationError(
      load({
        overrides: sparseOverrides,
        projectRoot: '/project',
      }),
      CONFIGURATION_ERROR_CODES.invalidConfiguration,
    );
  });

  it('rejects CLI proxies and explicit null overrides without invoking traps', async () => {
    const nullOverrides = { categories: null } as unknown as AuditConfigurationOverrides;
    const recordTrap = vi.fn(() => {
      throw new Error('PRIVATE_RECORD_PROXY_DETAIL');
    });
    const arrayTrap = vi.fn(() => {
      throw new Error('PRIVATE_ARRAY_PROXY_DETAIL');
    });
    const recordProxy = new Proxy(
      { verbose: true },
      {
        getPrototypeOf: recordTrap,
      },
    );
    const arrayProxy = new Proxy(['seo'] as const, {
      getPrototypeOf: arrayTrap,
    });
    const proxy = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new Error('PRIVATE_PROXY_DETAIL');
        },
      },
    );
    const { load } = createLoader(null);

    await expectConfigurationError(
      load({
        overrides: recordProxy,
        projectRoot: '/project',
      }),
      CONFIGURATION_ERROR_CODES.invalidConfiguration,
    );
    expect(recordTrap).not.toHaveBeenCalled();

    await expectConfigurationError(
      load({
        overrides: { categories: arrayProxy },
        projectRoot: '/project',
      }),
      CONFIGURATION_ERROR_CODES.invalidConfiguration,
    );
    expect(arrayTrap).not.toHaveBeenCalled();

    await expectConfigurationError(
      load({
        overrides: proxy,
        projectRoot: '/project',
      }),
      CONFIGURATION_ERROR_CODES.invalidConfiguration,
    );
    await expectConfigurationError(
      load({
        overrides: nullOverrides,
        projectRoot: '/project',
      }),
      CONFIGURATION_ERROR_CODES.invalidConfiguration,
    );
  });

  it('copies mutable CLI arrays and produces byte-stable normalized results', async () => {
    const categories: ('accessibility' | 'seo')[] = ['seo', 'accessibility'];
    const ruleIds = ['seo/multiple-h1', 'accessibility/img-alt'];
    const overrides = { categories, ruleIds } as const;
    const { load } = createLoader(null);
    const first = await load({ overrides, projectRoot: '/project' });

    categories.push('seo');
    ruleIds.reverse();
    const second = await load({
      overrides: {
        categories: ['seo', 'accessibility'],
        ruleIds: ['seo/multiple-h1', 'accessibility/img-alt'],
      },
      projectRoot: '/project',
    });

    expect(first.categories).toEqual(['accessibility', 'seo']);
    expect(first.ruleIds).toEqual(['accessibility/img-alt', 'seo/multiple-h1']);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(Object.isFrozen(first.categories)).toBe(true);
    expect(Object.isFrozen(first.ruleIds)).toBe(true);
  });

  it('preserves typed reader failures without exposing a native cause', async () => {
    const readFile = vi
      .fn<ReadConfigurationFile>()
      .mockRejectedValue(new ConfigurationError(CONFIGURATION_ERROR_CODES.fileReadFailed));
    const load = createLoadAuditConfiguration({ knownRuleIds, readFile });

    await expectConfigurationError(
      load({ projectRoot: '/project' }),
      CONFIGURATION_ERROR_CODES.fileReadFailed,
    );
  });
});

describe('safe output-directory policy', () => {
  it.each(['uxaudit-reports', 'reports/nested', 'informes/estables'])(
    'accepts portable relative path %s',
    (value) => {
      expect(isSafeOutputDirectory(value)).toBe(true);
    },
  );

  it.each([
    '',
    '.',
    '..',
    '../outside',
    '/absolute',
    'C:/absolute',
    'reports\\windows',
    'reports//double',
    'reports/CON',
    'reports/trailing.',
    'reports/trailing ',
    'reports/<unsafe>',
    'reports/\u202eevil',
    'reports/COM¹.txt',
    'reports/LPT³',
    `reports/${'é'.repeat(128)}`,
    'reports/\ud800',
  ])('rejects non-portable or ambiguous path %s', (value) => {
    expect(isSafeOutputDirectory(value)).toBe(false);
  });
});

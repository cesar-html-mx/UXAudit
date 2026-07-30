import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  CONFIGURATION_ERROR_CODES,
  CONFIGURATION_FILE_NAME,
  CONFIGURATION_SCHEMA_VERSION,
  ConfigurationError,
  DEFAULT_AUDIT_CONFIGURATION,
  DEFAULT_OUTPUT_DIRECTORY,
  REPORT_FILE_NAMES,
  REPORT_FORMATS,
  type AuditConfiguration,
  type AuditConfigurationOverrides,
} from '../../src/configuration/configuration.js';

describe('configuration contracts', () => {
  it('publishes complete versioned defaults and stable report names', () => {
    expect(CONFIGURATION_SCHEMA_VERSION).toBe(1);
    expect(CONFIGURATION_FILE_NAME).toBe('uxaudit.config.json');
    expect(DEFAULT_OUTPUT_DIRECTORY).toBe('uxaudit-reports');
    expect(REPORT_FORMATS).toEqual({
      html: 'html',
      json: 'json',
      terminal: 'terminal',
    });
    expect(REPORT_FILE_NAMES).toEqual({
      html: 'audit-report.html',
      json: 'audit-report.json',
    });
    expect(DEFAULT_AUDIT_CONFIGURATION).toEqual({
      categories: null,
      color: true,
      formats: ['terminal'],
      minimumSeverity: 'info',
      outputDirectory: 'uxaudit-reports',
      ruleIds: null,
      schemaVersion: 1,
      verbose: false,
    });
    expect(Object.isFrozen(DEFAULT_AUDIT_CONFIGURATION)).toBe(true);
    expect(Object.isFrozen(DEFAULT_AUDIT_CONFIGURATION.formats)).toBe(true);
    expectTypeOf(DEFAULT_AUDIT_CONFIGURATION).toExtend<AuditConfiguration>();
  });

  it('distinguishes a missing filter from an explicit empty filter in typed overrides', () => {
    const absent: AuditConfigurationOverrides = {};
    const explicitEmpty: AuditConfigurationOverrides = {
      categories: [],
      ruleIds: [],
    };

    expect(absent.categories).toBeUndefined();
    expect(explicitEmpty.categories).toEqual([]);
    expect(explicitEmpty.ruleIds).toEqual([]);
  });

  it.each(Object.values(CONFIGURATION_ERROR_CODES))(
    'exposes stable non-reflective error %s',
    (code) => {
      const error = new ConfigurationError(code);

      expect(error.code).toBe(code);
      expect(error.message.length).toBeGreaterThan(0);
      expect(error.message).not.toContain('undefined');
      expect(error.cause).toBeUndefined();
    },
  );
});

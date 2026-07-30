import type { RuleCategory, RuleSeverity } from '../domain/rules/rule.js';

export const CONFIGURATION_SCHEMA_VERSION = 1 as const;
export const CONFIGURATION_FILE_NAME = 'uxaudit.config.json';
export const DEFAULT_OUTPUT_DIRECTORY = 'uxaudit-reports';

export const REPORT_FORMATS = Object.freeze({
  html: 'html',
  json: 'json',
  terminal: 'terminal',
} as const);

export type ReportFormat = (typeof REPORT_FORMATS)[keyof typeof REPORT_FORMATS];

export const REPORT_FILE_NAMES = Object.freeze({
  html: 'audit-report.html',
  json: 'audit-report.json',
} as const);

/**
 * Complete, validated configuration used by the application and every reporter.
 *
 * `null` rule filters mean "use the stable default catalog"; an empty array is an
 * intentional filter that enables no rules.
 */
export interface AuditConfiguration {
  readonly categories: null | readonly RuleCategory[];
  readonly color: boolean;
  readonly formats: readonly ReportFormat[];
  readonly minimumSeverity: RuleSeverity;
  readonly outputDirectory: string;
  readonly ruleIds: null | readonly string[];
  readonly schemaVersion: typeof CONFIGURATION_SCHEMA_VERSION;
  readonly verbose: boolean;
}

/**
 * Programmatic representation of CLI values. M05 validates and merges it after
 * file configuration, while Commander wiring remains an M06 responsibility.
 */
export interface AuditConfigurationOverrides {
  readonly categories?: readonly RuleCategory[];
  readonly color?: boolean;
  readonly formats?: readonly ReportFormat[];
  readonly minimumSeverity?: RuleSeverity;
  readonly outputDirectory?: string;
  readonly ruleIds?: readonly string[];
  readonly verbose?: boolean;
}

export const DEFAULT_AUDIT_CONFIGURATION: AuditConfiguration = Object.freeze({
  categories: null,
  color: true,
  formats: Object.freeze([REPORT_FORMATS.terminal]),
  minimumSeverity: 'info',
  outputDirectory: DEFAULT_OUTPUT_DIRECTORY,
  ruleIds: null,
  schemaVersion: CONFIGURATION_SCHEMA_VERSION,
  verbose: false,
});

export const CONFIGURATION_ERROR_CODES = Object.freeze({
  conflict: 'CONFIGURATION_CONFLICT',
  explicitFileNotFound: 'CONFIGURATION_FILE_NOT_FOUND',
  fileInvalidEncoding: 'CONFIGURATION_FILE_INVALID_ENCODING',
  fileNotRegular: 'CONFIGURATION_FILE_NOT_REGULAR',
  fileReadFailed: 'CONFIGURATION_FILE_READ_FAILED',
  fileTooLarge: 'CONFIGURATION_FILE_TOO_LARGE',
  invalidConfiguration: 'CONFIGURATION_INVALID',
  invalidJson: 'CONFIGURATION_JSON_INVALID',
  unsafePath: 'CONFIGURATION_PATH_UNSAFE',
} as const);

export type ConfigurationErrorCode =
  (typeof CONFIGURATION_ERROR_CODES)[keyof typeof CONFIGURATION_ERROR_CODES];

const CONFIGURATION_ERROR_MESSAGES: Readonly<Record<ConfigurationErrorCode, string>> =
  Object.freeze({
    [CONFIGURATION_ERROR_CODES.conflict]: 'Configuration options conflict.',
    [CONFIGURATION_ERROR_CODES.explicitFileNotFound]:
      'The explicitly selected configuration file does not exist.',
    [CONFIGURATION_ERROR_CODES.fileInvalidEncoding]: 'The configuration file is not valid UTF-8.',
    [CONFIGURATION_ERROR_CODES.fileNotRegular]: 'The configuration path is not a regular file.',
    [CONFIGURATION_ERROR_CODES.fileReadFailed]: 'The configuration file could not be read.',
    [CONFIGURATION_ERROR_CODES.fileTooLarge]: 'The configuration file exceeds the size limit.',
    [CONFIGURATION_ERROR_CODES.invalidConfiguration]:
      'Configuration contains unknown or invalid values.',
    [CONFIGURATION_ERROR_CODES.invalidJson]: 'The configuration file is not valid JSON.',
    [CONFIGURATION_ERROR_CODES.unsafePath]: 'Configuration contains an unsafe local path.',
  });

export class ConfigurationError extends Error {
  public readonly code: ConfigurationErrorCode;

  public constructor(code: ConfigurationErrorCode) {
    super(CONFIGURATION_ERROR_MESSAGES[code]);
    this.name = 'ConfigurationError';
    this.code = code;
  }
}

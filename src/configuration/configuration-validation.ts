import { Buffer } from 'node:buffer';
import path from 'node:path';
import { types as utilityTypes } from 'node:util';

import {
  RULE_CATEGORIES,
  RULE_SEVERITIES,
  type RuleCategory,
  type RuleSeverity,
} from '../domain/rules/rule.js';
import {
  CONFIGURATION_ERROR_CODES,
  CONFIGURATION_SCHEMA_VERSION,
  ConfigurationError,
  DEFAULT_AUDIT_CONFIGURATION,
  REPORT_FORMATS,
  type AuditConfiguration,
  type AuditConfigurationOverrides,
  type ReportFormat,
} from './configuration.js';

export const MAX_CONFIGURATION_ARRAY_LENGTH = 128;
export const MAX_OUTPUT_DIRECTORY_LENGTH = 512;

export interface ValidatedConfigurationLayer {
  readonly categories: null | readonly RuleCategory[] | undefined;
  readonly color: boolean | undefined;
  readonly formats: readonly ReportFormat[] | undefined;
  readonly minimumSeverity: RuleSeverity | undefined;
  readonly outputDirectory: string | undefined;
  readonly ruleIds: null | readonly string[] | undefined;
  readonly verbose: boolean | undefined;
}

const categoryOrder: readonly RuleCategory[] = [
  RULE_CATEGORIES.accessibility,
  RULE_CATEGORIES.performance,
  RULE_CATEGORIES.seo,
  RULE_CATEGORIES.ux,
];
const formatOrder: readonly ReportFormat[] = [
  REPORT_FORMATS.terminal,
  REPORT_FORMATS.json,
  REPORT_FORMATS.html,
];
const severityValues = Object.values(RULE_SEVERITIES);
const ruleIdPattern = /^[a-z]+\/[a-z0-9-]+$/u;
const windowsDrivePattern = /^[a-zA-Z]:/u;
const windowsReservedNamePattern = /^(?:aux|com(?:[1-9¹²³])|con|lpt(?:[1-9¹²³])|nul|prn)(?:\.|$)/iu;
const windowsInvalidCharacterPattern = /[<>:"|?*]/u;
const fileKeys = new Set([
  'categories',
  'color',
  'formats',
  'minimumSeverity',
  'outputDirectory',
  'ruleIds',
  'schemaVersion',
  'verbose',
]);
const overrideKeys = new Set([
  'categories',
  'color',
  'formats',
  'minimumSeverity',
  'outputDirectory',
  'ruleIds',
  'verbose',
]);

const compareOrdinal = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const containsUnsafePathCharacter = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);

    if (
      (codeUnit >= 0 && codeUnit <= 31) ||
      (codeUnit >= 127 && codeUnit <= 159) ||
      codeUnit === 0x200e ||
      codeUnit === 0x200f ||
      (codeUnit >= 0x202a && codeUnit <= 0x202e) ||
      (codeUnit >= 0x2066 && codeUnit <= 0x2069)
    ) {
      return true;
    }
  }

  return false;
};

export const isSafeOutputDirectory = (value: string): boolean => {
  if (
    value.length === 0 ||
    value.length > MAX_OUTPUT_DIRECTORY_LENGTH ||
    !value.isWellFormed() ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    windowsDrivePattern.test(value) ||
    value.includes('\\') ||
    windowsInvalidCharacterPattern.test(value) ||
    containsUnsafePathCharacter(value)
  ) {
    return false;
  }

  const segments = value.split('/');

  return segments.every(
    (segment) =>
      segment.length > 0 &&
      Buffer.byteLength(segment, 'utf8') <= 255 &&
      segment !== '.' &&
      segment !== '..' &&
      !segment.endsWith('.') &&
      !segment.endsWith(' ') &&
      !windowsReservedNamePattern.test(segment),
  );
};

const requirePlainRecordDescriptors = (
  value: unknown,
  allowedKeys: ReadonlySet<string>,
): Readonly<Record<string, PropertyDescriptor>> => {
  if (
    typeof value !== 'object' ||
    value === null ||
    utilityTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidConfiguration);
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  if (prototype !== Object.prototype && prototype !== null) {
    throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidConfiguration);
  }

  const ownKeys = Reflect.ownKeys(value);

  if (
    ownKeys.some((key) => typeof key !== 'string' || !allowedKeys.has(key)) ||
    ownKeys.length > allowedKeys.size
  ) {
    throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidConfiguration);
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);

  for (const key of ownKeys) {
    if (typeof key !== 'string') {
      throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidConfiguration);
    }

    const descriptor = descriptors[key];

    if (descriptor === undefined || !('value' in descriptor) || descriptor.enumerable !== true) {
      throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidConfiguration);
    }
  }

  return descriptors;
};

const requirePlainArrayValues = (value: unknown): readonly unknown[] => {
  if (
    typeof value !== 'object' ||
    value === null ||
    utilityTypes.isProxy(value) ||
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) {
    throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidConfiguration);
  }

  const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
  const lengthValue: unknown = lengthDescriptor?.value;

  if (
    lengthDescriptor === undefined ||
    typeof lengthValue !== 'number' ||
    !Number.isSafeInteger(lengthValue) ||
    lengthValue < 0 ||
    lengthValue > MAX_CONFIGURATION_ARRAY_LENGTH
  ) {
    throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidConfiguration);
  }

  const length = lengthValue;
  const ownKeys = Reflect.ownKeys(value);

  if (
    ownKeys.length !== length + 1 ||
    ownKeys.some(
      (key) => typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key)),
    )
  ) {
    throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidConfiguration);
  }

  const values: unknown[] = [];

  for (let index = 0; index < length; index += 1) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));

    if (descriptor === undefined || !('value' in descriptor) || descriptor.enumerable !== true) {
      throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidConfiguration);
    }

    const candidate: unknown = descriptor.value;
    values.push(candidate);
  }

  return values;
};

const requireUniqueStrings = <Value extends string>(
  value: unknown,
  isAllowed: (candidate: string) => candidate is Value,
  order: readonly Value[] | 'ordinal',
): readonly Value[] => {
  const values = requirePlainArrayValues(value);
  const normalized: Value[] = [];

  for (const candidate of values) {
    if (typeof candidate !== 'string' || candidate !== candidate.trim() || !isAllowed(candidate)) {
      throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidConfiguration);
    }

    normalized.push(candidate);
  }

  if (new Set(normalized).size !== normalized.length) {
    throw new ConfigurationError(CONFIGURATION_ERROR_CODES.conflict);
  }

  return normalized.sort(
    order === 'ordinal'
      ? compareOrdinal
      : (left, right) => order.indexOf(left) - order.indexOf(right),
  );
};

const requireCategories = (value: unknown, allowNull: boolean): null | readonly RuleCategory[] => {
  if (value === null && allowNull) {
    return null;
  }

  return requireUniqueStrings(
    value,
    (candidate): candidate is RuleCategory => categoryOrder.includes(candidate as RuleCategory),
    categoryOrder,
  );
};

const requireFormats = (value: unknown): readonly ReportFormat[] => {
  const formats = requireUniqueStrings(
    value,
    (candidate): candidate is ReportFormat => formatOrder.includes(candidate as ReportFormat),
    formatOrder,
  );

  if (formats.length === 0) {
    throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidConfiguration);
  }

  return formats;
};

const requireRuleIds = (
  value: unknown,
  allowNull: boolean,
  knownRuleIds: ReadonlySet<string>,
): null | readonly string[] => {
  if (value === null && allowNull) {
    return null;
  }

  return requireUniqueStrings(
    value,
    (candidate): candidate is string =>
      ruleIdPattern.test(candidate) && knownRuleIds.has(candidate),
    'ordinal',
  );
};

const readOptionalValue = (
  descriptors: Readonly<Record<string, PropertyDescriptor>>,
  key: string,
): unknown => descriptors[key]?.value;

const normalizeLayer = (
  value: unknown,
  options: {
    readonly allowNullFilters: boolean;
    readonly file: boolean;
    readonly knownRuleIds: ReadonlySet<string>;
  },
): ValidatedConfigurationLayer => {
  const descriptors = requirePlainRecordDescriptors(value, options.file ? fileKeys : overrideKeys);

  if (
    options.file &&
    readOptionalValue(descriptors, 'schemaVersion') !== CONFIGURATION_SCHEMA_VERSION
  ) {
    throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidConfiguration);
  }

  const categories = readOptionalValue(descriptors, 'categories');
  const color = readOptionalValue(descriptors, 'color');
  const formats = readOptionalValue(descriptors, 'formats');
  const minimumSeverity = readOptionalValue(descriptors, 'minimumSeverity');
  const outputDirectory = readOptionalValue(descriptors, 'outputDirectory');
  const ruleIds = readOptionalValue(descriptors, 'ruleIds');
  const verbose = readOptionalValue(descriptors, 'verbose');

  if (color !== undefined && typeof color !== 'boolean') {
    throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidConfiguration);
  }

  if (
    minimumSeverity !== undefined &&
    (typeof minimumSeverity !== 'string' ||
      !severityValues.includes(minimumSeverity as RuleSeverity))
  ) {
    throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidConfiguration);
  }

  if (verbose !== undefined && typeof verbose !== 'boolean') {
    throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidConfiguration);
  }

  if (
    outputDirectory !== undefined &&
    (typeof outputDirectory !== 'string' || !isSafeOutputDirectory(outputDirectory))
  ) {
    throw new ConfigurationError(CONFIGURATION_ERROR_CODES.unsafePath);
  }

  return {
    categories:
      categories === undefined
        ? undefined
        : requireCategories(categories, options.allowNullFilters),
    color,
    formats: formats === undefined ? undefined : requireFormats(formats),
    minimumSeverity: minimumSeverity === undefined ? undefined : (minimumSeverity as RuleSeverity),
    outputDirectory,
    ruleIds:
      ruleIds === undefined
        ? undefined
        : requireRuleIds(ruleIds, options.allowNullFilters, options.knownRuleIds),
    verbose,
  };
};

const freezeConfiguration = (configuration: AuditConfiguration): AuditConfiguration =>
  Object.freeze({
    ...configuration,
    categories:
      configuration.categories === null ? null : Object.freeze([...configuration.categories]),
    formats: Object.freeze([...configuration.formats]),
    ruleIds: configuration.ruleIds === null ? null : Object.freeze([...configuration.ruleIds]),
  });

const assertUniqueTopLevelJsonKeys = (text: string): void => {
  const firstTokenIndex = text.search(/\S/u);

  if (firstTokenIndex < 0 || text[firstTokenIndex] !== '{') {
    return;
  }

  const keys = new Set<string>();
  let depth = 0;
  let expectsKey = false;

  for (let index = firstTokenIndex; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      const startIndex = index;

      for (index += 1; index < text.length; index += 1) {
        if (text[index] === '\\') {
          index += 1;
        } else if (text[index] === '"') {
          break;
        }
      }

      if (depth === 1 && expectsKey) {
        const key: unknown = JSON.parse(text.slice(startIndex, index + 1));

        if (typeof key !== 'string') {
          throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidJson);
        }

        if (keys.has(key)) {
          throw new ConfigurationError(CONFIGURATION_ERROR_CODES.conflict);
        }

        keys.add(key);
        expectsKey = false;
      }

      continue;
    }

    if (character === '{' || character === '[') {
      depth += 1;

      if (depth === 1) {
        expectsKey = true;
      }
    } else if (character === '}' || character === ']') {
      depth -= 1;
    } else if (character === ',' && depth === 1) {
      expectsKey = true;
    }
  }
};

export const parseConfigurationJson = (
  text: string,
  knownRuleIds: ReadonlySet<string>,
): ValidatedConfigurationLayer => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidJson);
  }

  assertUniqueTopLevelJsonKeys(text);

  try {
    return normalizeLayer(parsed, {
      allowNullFilters: true,
      file: true,
      knownRuleIds,
    });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }

    throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidConfiguration);
  }
};

export const validateConfigurationOverrides = (
  overrides: AuditConfigurationOverrides | undefined,
  knownRuleIds: ReadonlySet<string>,
): ValidatedConfigurationLayer => {
  try {
    return normalizeLayer(overrides ?? {}, {
      allowNullFilters: false,
      file: false,
      knownRuleIds,
    });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }

    throw new ConfigurationError(CONFIGURATION_ERROR_CODES.invalidConfiguration);
  }
};

export const mergeAuditConfiguration = (
  file: ValidatedConfigurationLayer | undefined,
  overrides: ValidatedConfigurationLayer,
): AuditConfiguration => {
  const select = <Value>(
    cliValue: Value | undefined,
    fileValue: Value | undefined,
    defaultValue: Value,
  ): Value => {
    if (cliValue !== undefined) {
      return cliValue;
    }

    if (fileValue !== undefined) {
      return fileValue;
    }

    return defaultValue;
  };

  return freezeConfiguration({
    categories: select(
      overrides.categories,
      file?.categories,
      DEFAULT_AUDIT_CONFIGURATION.categories,
    ),
    color: select(overrides.color, file?.color, DEFAULT_AUDIT_CONFIGURATION.color),
    formats: select(overrides.formats, file?.formats, DEFAULT_AUDIT_CONFIGURATION.formats),
    minimumSeverity: select(
      overrides.minimumSeverity,
      file?.minimumSeverity,
      DEFAULT_AUDIT_CONFIGURATION.minimumSeverity,
    ),
    outputDirectory: select(
      overrides.outputDirectory,
      file?.outputDirectory,
      DEFAULT_AUDIT_CONFIGURATION.outputDirectory,
    ),
    ruleIds: select(overrides.ruleIds, file?.ruleIds, DEFAULT_AUDIT_CONFIGURATION.ruleIds),
    schemaVersion: CONFIGURATION_SCHEMA_VERSION,
    verbose: select(overrides.verbose, file?.verbose, DEFAULT_AUDIT_CONFIGURATION.verbose),
  });
};

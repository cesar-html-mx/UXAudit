import {
  RULE_CATEGORIES,
  RULE_SEVERITIES,
  RULE_STATUSES,
  type Rule,
  type RuleCategory,
  type RuleMetadata,
  type RuleSeverity,
  type RuleStatus,
} from '../domain/rules/rule.js';
import { compareOrdinal } from './rule-order.js';

export const RULE_REGISTRY_ERROR_CODES = Object.freeze({
  duplicateRuleId: 'RULE_REGISTRY_DUPLICATE_ID',
  invalidRule: 'RULE_REGISTRY_INVALID_RULE',
} as const);

export type RuleRegistryErrorCode =
  (typeof RULE_REGISTRY_ERROR_CODES)[keyof typeof RULE_REGISTRY_ERROR_CODES];

const RULE_REGISTRY_ERROR_MESSAGES: Readonly<Record<RuleRegistryErrorCode, string>> = Object.freeze(
  {
    [RULE_REGISTRY_ERROR_CODES.duplicateRuleId]: 'Rule registry contains a duplicate rule ID.',
    [RULE_REGISTRY_ERROR_CODES.invalidRule]: 'Rule registry contains invalid rule metadata.',
  },
);

export class RuleRegistryError extends Error {
  public readonly code: RuleRegistryErrorCode;

  public constructor(code: RuleRegistryErrorCode) {
    super(RULE_REGISTRY_ERROR_MESSAGES[code]);
    this.name = 'RuleRegistryError';
    this.code = code;
  }
}

export interface RuleRegistry {
  readonly rules: readonly Rule[];
}

const ruleIdPattern = /^[a-z]+\/[a-z0-9-]+$/u;
const categories = Object.values(RULE_CATEGORIES);
const severities = Object.values(RULE_SEVERITIES);
const statuses = Object.values(RULE_STATUSES);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOwnedString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();

const isSafeReferenceUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
};

const isMember = <Value extends string>(values: readonly Value[], value: unknown): value is Value =>
  typeof value === 'string' && values.includes(value as Value);

const requireReference = (
  value: unknown,
): null | { readonly label: string; readonly url: null | string } => {
  if (value === null) {
    return null;
  }

  if (!isRecord(value) || !isOwnedString(value['label'])) {
    throw new RuleRegistryError(RULE_REGISTRY_ERROR_CODES.invalidRule);
  }

  const url = value['url'];

  if (url !== null && (!isOwnedString(url) || !isSafeReferenceUrl(url))) {
    throw new RuleRegistryError(RULE_REGISTRY_ERROR_CODES.invalidRule);
  }

  return Object.freeze({
    label: value['label'],
    url,
  });
};

const requireLimitations = (value: unknown): readonly string[] => {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((limitation) => isOwnedString(limitation))
  ) {
    throw new RuleRegistryError(RULE_REGISTRY_ERROR_CODES.invalidRule);
  }

  return Object.freeze([...value]);
};

const requireMetadata = (value: unknown): RuleMetadata => {
  if (!isRecord(value)) {
    throw new RuleRegistryError(RULE_REGISTRY_ERROR_CODES.invalidRule);
  }

  const category = value['category'];
  const defaultSeverity = value['defaultSeverity'];
  const explanation = value['explanation'];
  const id = value['id'];
  const recommendation = value['recommendation'];
  const status = value['status'];
  const title = value['title'];

  if (
    !isMember<RuleCategory>(categories, category) ||
    !isMember<RuleSeverity>(severities, defaultSeverity) ||
    !isOwnedString(explanation) ||
    !isOwnedString(id) ||
    !ruleIdPattern.test(id) ||
    !id.startsWith(`${category}/`) ||
    !isOwnedString(recommendation) ||
    !isMember<RuleStatus>(statuses, status) ||
    status === RULE_STATUSES.deferred ||
    !isOwnedString(title)
  ) {
    throw new RuleRegistryError(RULE_REGISTRY_ERROR_CODES.invalidRule);
  }

  return Object.freeze({
    category,
    defaultSeverity,
    explanation,
    id,
    limitations: requireLimitations(value['limitations']),
    recommendation,
    reference: requireReference(value['reference']),
    status,
    title,
  });
};

const requireRule = (value: unknown): Rule => {
  if (!isRecord(value) || typeof value['evaluate'] !== 'function') {
    throw new RuleRegistryError(RULE_REGISTRY_ERROR_CODES.invalidRule);
  }

  return Object.freeze({
    evaluate: value['evaluate'] as Rule['evaluate'],
    metadata: requireMetadata(value['metadata']),
  });
};

export const createRuleRegistry = (rules: readonly Rule[]): RuleRegistry => {
  try {
    const normalizedRules = rules.map((rule) => requireRule(rule));
    const ruleIds = normalizedRules.map((rule) => rule.metadata.id);

    if (new Set(ruleIds).size !== ruleIds.length) {
      throw new RuleRegistryError(RULE_REGISTRY_ERROR_CODES.duplicateRuleId);
    }

    normalizedRules.sort((left, right) => compareOrdinal(left.metadata.id, right.metadata.id));

    return Object.freeze({
      rules: Object.freeze(normalizedRules),
    });
  } catch (error) {
    if (error instanceof RuleRegistryError) {
      throw error;
    }

    throw new RuleRegistryError(RULE_REGISTRY_ERROR_CODES.invalidRule);
  }
};

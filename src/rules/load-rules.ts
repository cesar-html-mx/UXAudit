import { RULE_CATEGORIES, type Rule, type RuleCategory } from '../domain/rules/rule.js';
import type { RuleRegistry } from './rule-registry.js';

export const RULE_LOAD_ERROR_CODES = Object.freeze({
  invalidFilter: 'RULE_FILTER_INVALID',
  unknownRuleId: 'RULE_FILTER_UNKNOWN_ID',
} as const);

export type RuleLoadErrorCode = (typeof RULE_LOAD_ERROR_CODES)[keyof typeof RULE_LOAD_ERROR_CODES];

const RULE_LOAD_ERROR_MESSAGES: Readonly<Record<RuleLoadErrorCode, string>> = Object.freeze({
  [RULE_LOAD_ERROR_CODES.invalidFilter]: 'Rule filters are invalid.',
  [RULE_LOAD_ERROR_CODES.unknownRuleId]: 'Rule filter references an unknown rule ID.',
});

export class RuleLoadError extends Error {
  public readonly code: RuleLoadErrorCode;

  public constructor(code: RuleLoadErrorCode) {
    super(RULE_LOAD_ERROR_MESSAGES[code]);
    this.name = 'RuleLoadError';
    this.code = code;
  }
}

export interface RuleFilters {
  readonly categories?: readonly RuleCategory[];
  readonly ruleIds?: readonly string[];
}

export interface LoadedRuleSet {
  readonly availableRuleCount: number;
  readonly rules: readonly Rule[];
}

export interface LoadRulesRequest {
  readonly filters?: RuleFilters;
  readonly registry: RuleRegistry;
}

const categories = Object.values(RULE_CATEGORIES);
const ruleIdPattern = /^[a-z]+\/[a-z0-9-]+$/u;
const filterKeys = new Set(['categories', 'ruleIds']);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireCategoryFilter = (value: unknown): ReadonlySet<RuleCategory> | null => {
  if (value === undefined) {
    return null;
  }

  if (
    !Array.isArray(value) ||
    !value.every(
      (category) => typeof category === 'string' && categories.includes(category as RuleCategory),
    )
  ) {
    throw new RuleLoadError(RULE_LOAD_ERROR_CODES.invalidFilter);
  }

  return new Set(value as readonly RuleCategory[]);
};

const requireRuleIdFilter = (
  value: unknown,
  availableRuleIds: ReadonlySet<string>,
): ReadonlySet<string> | null => {
  if (value === undefined) {
    return null;
  }

  if (
    !Array.isArray(value) ||
    !value.every(
      (ruleId) =>
        typeof ruleId === 'string' && ruleId === ruleId.trim() && ruleIdPattern.test(ruleId),
    )
  ) {
    throw new RuleLoadError(RULE_LOAD_ERROR_CODES.invalidFilter);
  }

  if (value.some((ruleId) => !availableRuleIds.has(ruleId as string))) {
    throw new RuleLoadError(RULE_LOAD_ERROR_CODES.unknownRuleId);
  }

  return new Set(value as readonly string[]);
};

export const loadRules = ({ filters, registry }: LoadRulesRequest): LoadedRuleSet => {
  try {
    if (filters !== undefined) {
      const prototype: unknown = isRecord(filters) ? Object.getPrototypeOf(filters) : undefined;

      if (
        !isRecord(filters) ||
        (prototype !== Object.prototype && prototype !== null) ||
        Object.keys(filters).some((key) => !filterKeys.has(key))
      ) {
        throw new RuleLoadError(RULE_LOAD_ERROR_CODES.invalidFilter);
      }
    }

    const categoryFilter = requireCategoryFilter(filters?.['categories']);
    const availableRuleIds = new Set(registry.rules.map((rule) => rule.metadata.id));
    const ruleIdFilter = requireRuleIdFilter(filters?.['ruleIds'], availableRuleIds);
    const rules = registry.rules.filter(
      (rule) =>
        (rule.metadata.status !== 'experimental' || ruleIdFilter?.has(rule.metadata.id) === true) &&
        (categoryFilter === null || categoryFilter.has(rule.metadata.category)) &&
        (ruleIdFilter === null || ruleIdFilter.has(rule.metadata.id)),
    );

    return Object.freeze({
      availableRuleCount: registry.rules.length,
      rules: Object.freeze(rules),
    });
  } catch (error) {
    if (error instanceof RuleLoadError) {
      throw error;
    }

    throw new RuleLoadError(RULE_LOAD_ERROR_CODES.invalidFilter);
  }
};

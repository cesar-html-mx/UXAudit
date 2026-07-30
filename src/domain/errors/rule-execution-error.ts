import type { RuleCategory } from '../rules/rule.js';

export const RULE_EXECUTION_ERROR_CODES = Object.freeze({
  evaluationFailed: 'RULE_EVALUATION_FAILED',
  invalidResult: 'RULE_RESULT_INVALID',
} as const);

export type RuleExecutionErrorCode =
  (typeof RULE_EXECUTION_ERROR_CODES)[keyof typeof RULE_EXECUTION_ERROR_CODES];

export interface RuleExecutionError {
  readonly category: RuleCategory;
  readonly code: RuleExecutionErrorCode;
  readonly message: string;
  readonly recoverable: true;
  readonly ruleId: string;
}

const RULE_EXECUTION_ERROR_MESSAGES: Readonly<Record<RuleExecutionErrorCode, string>> =
  Object.freeze({
    [RULE_EXECUTION_ERROR_CODES.evaluationFailed]: 'Rule evaluation failed.',
    [RULE_EXECUTION_ERROR_CODES.invalidResult]: 'Rule returned an invalid result.',
  });

export const createRuleExecutionError = (
  ruleId: string,
  category: RuleCategory,
  code: RuleExecutionErrorCode,
): RuleExecutionError => ({
  category,
  code,
  message: RULE_EXECUTION_ERROR_MESSAGES[code],
  recoverable: true,
  ruleId,
});

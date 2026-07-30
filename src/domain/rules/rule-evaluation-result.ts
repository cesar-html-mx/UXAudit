import type { RuleExecutionError } from '../errors/rule-execution-error.js';
import type { Finding } from '../findings/finding.js';

export interface RuleEvaluationSummary {
  readonly availableRuleCount: number;
  readonly enabledRuleCount: number;
  readonly executedRuleCount: number;
  readonly failedRuleCount: number;
  readonly findingCount: number;
  readonly succeededRuleCount: number;
}

export interface RuleEvaluationResult {
  readonly errors: readonly RuleExecutionError[];
  readonly findings: readonly Finding[];
  readonly summary: RuleEvaluationSummary;
}

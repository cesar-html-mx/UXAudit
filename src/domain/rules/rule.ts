import type { AnalysisModel } from '../models/analysis-model.js';
import type { SourceLocation } from '../models/source-location.js';

export const RULE_CATEGORIES = Object.freeze({
  accessibility: 'accessibility',
  performance: 'performance',
  seo: 'seo',
  ux: 'ux',
} as const);

export type RuleCategory = (typeof RULE_CATEGORIES)[keyof typeof RULE_CATEGORIES];

export const RULE_SEVERITIES = Object.freeze({
  critical: 'critical',
  high: 'high',
  info: 'info',
  low: 'low',
  medium: 'medium',
} as const);

export type RuleSeverity = (typeof RULE_SEVERITIES)[keyof typeof RULE_SEVERITIES];

export const RULE_STATUSES = Object.freeze({
  deferred: 'deferred',
  experimental: 'experimental',
  required: 'required',
  stable: 'stable',
} as const);

export type RuleStatus = (typeof RULE_STATUSES)[keyof typeof RULE_STATUSES];

export const FINDING_CONFIDENCES = Object.freeze({
  high: 'high',
  low: 'low',
  medium: 'medium',
} as const);

export type FindingConfidence = (typeof FINDING_CONFIDENCES)[keyof typeof FINDING_CONFIDENCES];

export interface RuleReference {
  readonly label: string;
  readonly url: null | string;
}

export interface RuleMetadata {
  readonly category: RuleCategory;
  readonly defaultSeverity: RuleSeverity;
  readonly explanation: string;
  readonly id: string;
  readonly limitations: readonly string[];
  readonly recommendation: string;
  readonly reference: null | RuleReference;
  readonly status: RuleStatus;
  readonly title: string;
}

/**
 * One rule-local observation before metadata is normalized into a Finding.
 */
export interface RuleFinding {
  readonly confidence: FindingConfidence;
  readonly location: null | SourceLocation;
  readonly message: string;
}

export interface RuleContext {
  readonly model: AnalysisModel;
}

/**
 * A report-independent, synchronously evaluated static-analysis rule.
 */
export interface Rule {
  readonly evaluate: (context: RuleContext) => readonly RuleFinding[];
  readonly metadata: RuleMetadata;
}

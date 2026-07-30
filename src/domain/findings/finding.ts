import type { SourceLocation } from '../models/source-location.js';
import type { FindingConfidence, RuleFinding, RuleMetadata, RuleReference } from '../rules/rule.js';
import type { RuleCategory, RuleSeverity } from '../rules/rule.js';

export interface Finding {
  readonly category: RuleCategory;
  readonly confidence: FindingConfidence;
  readonly explanation: string;
  readonly limitations: readonly string[];
  readonly location: null | SourceLocation;
  readonly message: string;
  readonly recommendation: string;
  readonly reference: null | RuleReference;
  readonly ruleId: string;
  readonly ruleTitle: string;
  readonly severity: RuleSeverity;
}

const cloneLocation = (location: SourceLocation): SourceLocation => ({
  end: { ...location.end },
  filePath: location.filePath,
  start: { ...location.start },
});

const cloneReference = (reference: RuleReference): RuleReference => ({
  label: reference.label,
  url: reference.url,
});

/**
 * Copies rule-owned data into one self-contained reporter-facing domain record.
 *
 * The evaluator validates boundary values before calling this normalizer.
 */
export const createFinding = (metadata: RuleMetadata, candidate: RuleFinding): Finding => ({
  category: metadata.category,
  confidence: candidate.confidence,
  explanation: metadata.explanation,
  limitations: [...metadata.limitations],
  location: candidate.location === null ? null : cloneLocation(candidate.location),
  message: candidate.message,
  recommendation: metadata.recommendation,
  reference: metadata.reference === null ? null : cloneReference(metadata.reference),
  ruleId: metadata.id,
  ruleTitle: metadata.title,
  severity: metadata.defaultSeverity,
});

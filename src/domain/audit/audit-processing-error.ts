import type { RuleExecutionError, RuleExecutionErrorCode } from '../errors/rule-execution-error.js';
import type { SourcePosition } from '../models/source-location.js';
import type { RuleCategory } from '../rules/rule.js';
import type {
  SourceParserError,
  SourceParserErrorCode,
  SourceParserErrorStage,
} from '../../parsing/parser-contracts.js';
import type {
  DiscoveryIssue,
  DiscoveryIssueCode,
  DiscoveryOperation,
} from '../../project/discovery/discovery-types.js';

export const AUDIT_PROCESSING_ERROR_STAGES = Object.freeze({
  discovery: 'discovery',
  extract: 'extract',
  parse: 'parse',
  read: 'read',
  rule: 'rule',
} as const);

export type AuditProcessingErrorStage =
  (typeof AUDIT_PROCESSING_ERROR_STAGES)[keyof typeof AUDIT_PROCESSING_ERROR_STAGES];

export interface DiscoveryProcessingError {
  readonly code: DiscoveryIssueCode;
  readonly filePath: string;
  readonly message: string;
  readonly operation: DiscoveryOperation;
  readonly recoverable: true;
  readonly stage: typeof AUDIT_PROCESSING_ERROR_STAGES.discovery;
}

export interface SourceProcessingError {
  readonly code: SourceParserErrorCode;
  readonly filePath: string;
  readonly message: string;
  readonly position?: SourcePosition;
  readonly recoverable: true;
  readonly stage: SourceParserErrorStage;
}

export interface RuleProcessingError {
  readonly category: RuleCategory;
  readonly code: RuleExecutionErrorCode;
  readonly message: string;
  readonly recoverable: true;
  readonly ruleId: string;
  readonly stage: typeof AUDIT_PROCESSING_ERROR_STAGES.rule;
}

export type AuditProcessingError =
  DiscoveryProcessingError | RuleProcessingError | SourceProcessingError;

const DISCOVERY_ISSUE_MESSAGES: Readonly<Record<DiscoveryIssueCode, string>> = Object.freeze({
  DISCOVERY_ENTRY_DISAPPEARED: 'Project entry disappeared during discovery.',
  DISCOVERY_IO_FAILED: 'Project entry could not be inspected during discovery.',
  DISCOVERY_NOT_ACCESSIBLE: 'Project entry was not accessible during discovery.',
  DISCOVERY_SYMLINK_LOOP: 'Symbolic-link loop was isolated during discovery.',
});

export const createDiscoveryProcessingError = (
  issue: DiscoveryIssue,
): DiscoveryProcessingError => ({
  code: issue.code,
  filePath: issue.relativePath,
  message: DISCOVERY_ISSUE_MESSAGES[issue.code],
  operation: issue.operation,
  recoverable: true,
  stage: AUDIT_PROCESSING_ERROR_STAGES.discovery,
});

export const createSourceProcessingError = (error: SourceParserError): SourceProcessingError => ({
  code: error.code,
  filePath: error.filePath,
  message: error.message,
  ...(error.position === undefined ? {} : { position: { ...error.position } }),
  recoverable: true,
  stage: error.stage,
});

export const createRuleProcessingError = (error: RuleExecutionError): RuleProcessingError => ({
  category: error.category,
  code: error.code,
  message: error.message,
  recoverable: true,
  ruleId: error.ruleId,
  stage: AUDIT_PROCESSING_ERROR_STAGES.rule,
});

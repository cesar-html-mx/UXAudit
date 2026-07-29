import type { AnalyzedSourceFile } from '../domain/models/analysis-model.js';
import type { SourcePosition } from '../domain/models/source-location.js';
import type { SourceCandidate } from '../project/classification/source-candidate.js';

export const SOURCE_PARSER_ERROR_CODES = Object.freeze({
  extractLimitExceeded: 'SOURCE_EXTRACTION_LIMIT_EXCEEDED',
  extractFailed: 'SOURCE_EXTRACTION_FAILED',
  fileChanged: 'SOURCE_FILE_CHANGED',
  fileNotRegular: 'SOURCE_FILE_NOT_REGULAR',
  fileOutsideRoot: 'SOURCE_FILE_OUTSIDE_ROOT',
  fileReadFailed: 'SOURCE_FILE_READ_FAILED',
  fileTooLarge: 'SOURCE_FILE_TOO_LARGE',
  fileUnreadable: 'SOURCE_FILE_UNREADABLE',
  invalidEncoding: 'SOURCE_FILE_INVALID_ENCODING',
  parseFailed: 'SOURCE_PARSE_FAILED',
} as const);

export type SourceParserErrorCode =
  (typeof SOURCE_PARSER_ERROR_CODES)[keyof typeof SOURCE_PARSER_ERROR_CODES];

export const SOURCE_PARSER_ERROR_STAGES = Object.freeze({
  extract: 'extract',
  parse: 'parse',
  read: 'read',
} as const);

export type SourceParserErrorStage =
  (typeof SOURCE_PARSER_ERROR_STAGES)[keyof typeof SOURCE_PARSER_ERROR_STAGES];

export interface SourceParserError {
  readonly code: SourceParserErrorCode;
  readonly filePath: string;
  readonly message: string;
  readonly position?: SourcePosition;
  readonly recoverable: true;
  readonly stage: SourceParserErrorStage;
}

export interface SourceParserRequest {
  readonly candidate: SourceCandidate;
  readonly projectRoot: string;
}

export interface SourceParserSuccess {
  readonly analyzedFile: AnalyzedSourceFile;
  readonly success: true;
}

export interface SourceParserFailure {
  readonly error: SourceParserError;
  readonly success: false;
}

export type SourceParserResult = SourceParserFailure | SourceParserSuccess;

export type SourceParser = (request: SourceParserRequest) => Promise<SourceParserResult>;

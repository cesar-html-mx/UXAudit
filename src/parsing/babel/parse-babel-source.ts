import { parse, type ParseResult, type ParserOptions, type ParserPlugin } from '@babel/parser';

import type { SourcePosition } from '../../domain/models/source-location.js';
import {
  SOURCE_PARSER_ERROR_CODES,
  SOURCE_PARSER_ERROR_STAGES,
  type SourceParserError,
} from '../parser-contracts.js';
import { SOURCE_KINDS, type SourceKind } from '../../project/classification/source-candidate.js';

export interface BabelParseRequest {
  readonly filePath: string;
  readonly sourceKind: SourceKind;
  readonly sourceText: string;
}

export interface BabelParseSuccess {
  readonly ast: ParseResult;
  readonly success: true;
}

export interface BabelParseFailure {
  readonly error: SourceParserError;
  readonly success: false;
}

export type BabelParseResult = BabelParseFailure | BabelParseSuccess;

const pluginsBySourceKind = {
  [SOURCE_KINDS.javascript]: [],
  [SOURCE_KINDS.javascriptJsx]: ['jsx'],
  [SOURCE_KINDS.typescript]: ['typescript'],
  [SOURCE_KINDS.typescriptJsx]: ['typescript', 'jsx'],
} as const satisfies Readonly<Record<SourceKind, readonly ParserPlugin[]>>;

const createParserOptions = (request: BabelParseRequest): ParserOptions => ({
  attachComment: false,
  errorRecovery: false,
  locations: true,
  plugins: [...pluginsBySourceKind[request.sourceKind]],
  sourceFilename: request.filePath,
  sourceType: 'unambiguous',
  tokens: false,
});

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

const isFiniteInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);

const toErrorPosition = (error: unknown): SourcePosition | undefined => {
  if (!isRecord(error) || !isRecord(error['loc'])) {
    return undefined;
  }

  const location = error['loc'];
  const line = location['line'];
  const column = location['column'];
  const locationIndex = location['index'];
  const errorPosition = error['pos'];
  const offset = isFiniteInteger(locationIndex) ? locationIndex : errorPosition;

  if (
    !isFiniteInteger(line) ||
    line < 1 ||
    !isFiniteInteger(column) ||
    column < 0 ||
    !isFiniteInteger(offset) ||
    offset < 0
  ) {
    return undefined;
  }

  return {
    column,
    line,
    offset,
  };
};

const toParseError = (filePath: string, error: unknown): SourceParserError => {
  const position = toErrorPosition(error);
  const stableError = {
    code: SOURCE_PARSER_ERROR_CODES.parseFailed,
    filePath,
    message: 'Source file contains invalid or unsupported syntax.',
    recoverable: true,
    stage: SOURCE_PARSER_ERROR_STAGES.parse,
  } as const;

  return position === undefined
    ? stableError
    : {
        ...stableError,
        position,
      };
};

export const parseBabelSource = (request: BabelParseRequest): BabelParseResult => {
  try {
    return {
      ast: parse(request.sourceText, createParserOptions(request)),
      success: true,
    };
  } catch (error) {
    return {
      error: toParseError(request.filePath, error),
      success: false,
    };
  }
};

import { describe, expect, expectTypeOf, it } from 'vitest';

import type { AnalyzedSourceFile } from '../../src/domain/models/analysis-model.js';
import {
  SOURCE_PARSER_ERROR_CODES,
  SOURCE_PARSER_ERROR_STAGES,
  type SourceParser,
  type SourceParserError,
  type SourceParserResult,
} from '../../src/parsing/parser-contracts.js';
import { SOURCE_KINDS } from '../../src/project/classification/source-candidate.js';

const candidate = {
  absolutePath: '/canonical/project/src/App.tsx',
  extension: '.tsx',
  kind: 'file',
  relativePath: 'src/App.tsx',
  sourceKind: SOURCE_KINDS.typescriptJsx,
} as const;

describe('source parser contracts', () => {
  it('narrows a successful per-file result to direct model-builder input', async () => {
    const parser: SourceParser = ({ candidate: sourceCandidate }) =>
      Promise.resolve({
        analyzedFile: {
          components: [],
          file: {
            componentIds: [],
            filePath: sourceCandidate.relativePath,
            jsxNodeIds: [],
            language: 'typescript',
            location: {
              end: { column: 0, line: 1, offset: 0 },
              filePath: sourceCandidate.relativePath,
              start: { column: 0, line: 1, offset: 0 },
            },
            usesJsx: true,
          },
          jsxNodes: [],
        },
        success: true,
      });

    const result = await parser({
      candidate,
      projectRoot: '/canonical/project',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.analyzedFile.file.filePath).toBe('src/App.tsx');
      expectTypeOf(result.analyzedFile).toExtend<AnalyzedSourceFile>();
    }
  });

  it.each([
    [SOURCE_PARSER_ERROR_STAGES.read, SOURCE_PARSER_ERROR_CODES.fileUnreadable, undefined],
    [
      SOURCE_PARSER_ERROR_STAGES.parse,
      SOURCE_PARSER_ERROR_CODES.parseFailed,
      { column: 4, line: 2, offset: 20 },
    ],
    [
      SOURCE_PARSER_ERROR_STAGES.extract,
      SOURCE_PARSER_ERROR_CODES.extractFailed,
      { column: 0, line: 1, offset: 0 },
    ],
  ] as const)(
    'represents a recoverable %s failure without parser internals',
    (stage, code, position) => {
      const error: SourceParserError =
        position === undefined
          ? {
              code,
              filePath: candidate.relativePath,
              message: 'Source file could not be processed.',
              recoverable: true,
              stage,
            }
          : {
              code,
              filePath: candidate.relativePath,
              message: 'Source file could not be processed.',
              position,
              recoverable: true,
              stage,
            };
      const result: SourceParserResult = {
        error,
        success: false,
      };

      expect(result).toEqual({
        error: {
          code,
          filePath: 'src/App.tsx',
          message: 'Source file could not be processed.',
          ...(position === undefined ? {} : { position }),
          recoverable: true,
          stage,
        },
        success: false,
      });
      expectTypeOf(result.error).toExtend<SourceParserError>();
      expect(Object.keys(result.error)).not.toContain('ast');
      expect(Object.keys(result.error)).not.toContain('cause');
    },
  );

  it('publishes stable parser stages and error codes', () => {
    expect(SOURCE_PARSER_ERROR_STAGES).toEqual({
      extract: 'extract',
      parse: 'parse',
      read: 'read',
    });
    expect(SOURCE_PARSER_ERROR_CODES).toEqual({
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
    });
  });
});

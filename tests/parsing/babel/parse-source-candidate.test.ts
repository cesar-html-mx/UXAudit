import { describe, expect, it, vi } from 'vitest';

import {
  extractBabelAnalysis,
  type ExtractBabelAnalysisRequest,
} from '../../../src/parsing/babel/extract-babel-analysis.js';
import {
  parseBabelSource,
  type BabelParseRequest,
} from '../../../src/parsing/babel/parse-babel-source.js';
import { createParseSourceCandidate } from '../../../src/parsing/babel/parse-source-candidate.js';
import {
  SOURCE_PARSER_ERROR_CODES,
  SOURCE_PARSER_ERROR_STAGES,
  type SourceParserError,
  type SourceParserRequest,
} from '../../../src/parsing/parser-contracts.js';
import type { SourceCandidateReader } from '../../../src/parsing/read-source-candidate.js';
import { SOURCE_KINDS } from '../../../src/project/classification/source-candidate.js';

const projectRoot = '/canonical/project';
const candidate = {
  absolutePath: '/canonical/project/src/View.tsx',
  extension: '.tsx',
  kind: 'file',
  relativePath: 'src/View.tsx',
  sourceKind: SOURCE_KINDS.typescriptJsx,
} as const;
const request: SourceParserRequest = {
  candidate,
  projectRoot,
};
const sourceText = 'export const View = () => <main aria-label="Welcome">Hello</main>;\n';

const createError = (
  stage: SourceParserError['stage'],
  code: SourceParserError['code'],
  message: string,
): SourceParserError => ({
  code,
  filePath: candidate.relativePath,
  message,
  recoverable: true,
  stage,
});

const successfulReader: SourceCandidateReader = () =>
  Promise.resolve({
    sourceText,
    success: true,
  });

describe('createParseSourceCandidate', () => {
  it('composes read, Babel parse, and extraction without exposing AST or source text', async () => {
    const calls: string[] = [];
    const readSource: SourceCandidateReader = (receivedRequest) => {
      calls.push('read');
      expect(receivedRequest).toBe(request);

      return Promise.resolve({
        sourceText,
        success: true,
      });
    };
    const parseSource = (parseRequest: BabelParseRequest) => {
      calls.push('parse');
      expect(parseRequest).toEqual({
        filePath: candidate.relativePath,
        sourceKind: candidate.sourceKind,
        sourceText,
      });

      return parseBabelSource(parseRequest);
    };
    const extractAnalysis = (extractRequest: ExtractBabelAnalysisRequest) => {
      calls.push('extract');
      expect(extractRequest.filePath).toBe(candidate.relativePath);
      expect(extractRequest.sourceKind).toBe(candidate.sourceKind);

      return extractBabelAnalysis(extractRequest);
    };
    const parseCandidate = createParseSourceCandidate({
      extractAnalysis,
      parseSource,
      readSource,
    });

    const result = await parseCandidate(request);

    expect(calls).toEqual(['read', 'parse', 'extract']);
    expect(result.success).toBe(true);

    if (!result.success) {
      throw new TypeError('Expected source analysis to succeed.');
    }

    expect(result.analyzedFile).toMatchObject({
      components: [
        {
          name: 'View',
        },
      ],
      file: {
        filePath: candidate.relativePath,
        language: 'typescript',
        usesJsx: true,
      },
      jsxNodes: [
        {
          name: 'main',
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('"ast"');
    expect(JSON.stringify(result)).not.toContain('"program"');
    expect(JSON.stringify(result)).not.toContain(sourceText);
    expect(Object.keys(result)).toEqual(['analyzedFile', 'success']);
  });

  it('returns a recoverable reader error without parsing or extracting', async () => {
    const error = createError(
      SOURCE_PARSER_ERROR_STAGES.read,
      SOURCE_PARSER_ERROR_CODES.fileUnreadable,
      'Source file could not be read.',
    );
    const parseSource = vi.fn(parseBabelSource);
    const extractAnalysis = vi.fn(extractBabelAnalysis);
    const parseCandidate = createParseSourceCandidate({
      extractAnalysis,
      parseSource,
      readSource: () =>
        Promise.resolve({
          error,
          success: false,
        }),
    });

    await expect(parseCandidate(request)).resolves.toEqual({
      error,
      success: false,
    });
    expect(parseSource).not.toHaveBeenCalled();
    expect(extractAnalysis).not.toHaveBeenCalled();
  });

  it('returns a recoverable parse error without extracting', async () => {
    const extractAnalysis = vi.fn(extractBabelAnalysis);
    const parseCandidate = createParseSourceCandidate({
      extractAnalysis,
      parseSource: parseBabelSource,
      readSource: () =>
        Promise.resolve({
          sourceText: 'export const View = () => <main>;',
          success: true,
        }),
    });

    const result = await parseCandidate(request);

    expect(result).toMatchObject({
      error: {
        code: SOURCE_PARSER_ERROR_CODES.parseFailed,
        filePath: candidate.relativePath,
        recoverable: true,
        stage: SOURCE_PARSER_ERROR_STAGES.parse,
      },
      success: false,
    });
    expect(extractAnalysis).not.toHaveBeenCalled();
  });

  it('returns a recoverable extraction error after one successful parse', async () => {
    const parseSource = vi.fn(parseBabelSource);
    const parseCandidate = createParseSourceCandidate({
      extractAnalysis: (extractRequest) =>
        extractBabelAnalysis({
          ...extractRequest,
          maxNodes: 1,
        }),
      parseSource,
      readSource: successfulReader,
    });

    const result = await parseCandidate(request);

    expect(parseSource).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      error: {
        code: SOURCE_PARSER_ERROR_CODES.extractLimitExceeded,
        filePath: candidate.relativePath,
        recoverable: true,
        stage: SOURCE_PARSER_ERROR_STAGES.extract,
      },
      success: false,
    });
  });

  it.each(['read', 'parse', 'extract'] as const)(
    'propagates a fatal %s-stage exception unchanged and stops the pipeline',
    async (fatalStage) => {
      const fatalError = new Error(`fatal ${fatalStage} invariant`);
      const calls: string[] = [];
      const readSource: SourceCandidateReader = () => {
        calls.push('read');

        if (fatalStage === 'read') {
          throw fatalError;
        }

        return Promise.resolve({
          sourceText,
          success: true,
        });
      };
      const parseSource = (parseRequest: BabelParseRequest) => {
        calls.push('parse');

        if (fatalStage === 'parse') {
          throw fatalError;
        }

        return parseBabelSource(parseRequest);
      };
      const extractAnalysis = (extractRequest: ExtractBabelAnalysisRequest) => {
        calls.push('extract');

        if (fatalStage === 'extract') {
          throw fatalError;
        }

        return extractBabelAnalysis(extractRequest);
      };
      const parseCandidate = createParseSourceCandidate({
        extractAnalysis,
        parseSource,
        readSource,
      });

      await expect(parseCandidate(request)).rejects.toBe(fatalError);
      expect(calls).toEqual(
        fatalStage === 'read'
          ? ['read']
          : fatalStage === 'parse'
            ? ['read', 'parse']
            : ['read', 'parse', 'extract'],
      );
    },
  );
});

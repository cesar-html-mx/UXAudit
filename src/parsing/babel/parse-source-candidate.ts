import type { SourceParser } from '../parser-contracts.js';
import { readSourceCandidate, type SourceCandidateReader } from '../read-source-candidate.js';
import {
  extractBabelAnalysis,
  type ExtractBabelAnalysisRequest,
  type ExtractBabelAnalysisResult,
} from './extract-babel-analysis.js';
import {
  parseBabelSource,
  type BabelParseRequest,
  type BabelParseResult,
} from './parse-babel-source.js';

export interface ParseSourceCandidateDependencies {
  readonly extractAnalysis: (request: ExtractBabelAnalysisRequest) => ExtractBabelAnalysisResult;
  readonly parseSource: (request: BabelParseRequest) => BabelParseResult;
  readonly readSource: SourceCandidateReader;
}

export const createParseSourceCandidate =
  ({ extractAnalysis, parseSource, readSource }: ParseSourceCandidateDependencies): SourceParser =>
  async (request) => {
    const readResult = await readSource(request);

    if (!readResult.success) {
      return readResult;
    }

    const filePath = request.candidate.relativePath;
    const sourceKind = request.candidate.sourceKind;
    const parseResult = parseSource({
      filePath,
      sourceKind,
      sourceText: readResult.sourceText,
    });

    if (!parseResult.success) {
      return parseResult;
    }

    return extractAnalysis({
      ast: parseResult.ast,
      filePath,
      sourceKind,
    });
  };

export const parseSourceCandidate = createParseSourceCandidate({
  extractAnalysis: extractBabelAnalysis,
  parseSource: parseBabelSource,
  readSource: readSourceCandidate,
});

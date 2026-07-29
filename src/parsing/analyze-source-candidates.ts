import type { AnalyzedSourceFile } from '../domain/models/analysis-model.js';
import type { SourceCandidate } from '../project/classification/source-candidate.js';
import { compareOrdinal } from '../project/project-paths.js';
import { parseSourceCandidate } from './babel/parse-source-candidate.js';
import type { SourceParser, SourceParserError } from './parser-contracts.js';

export interface AnalyzeSourceCandidatesRequest {
  readonly candidates: readonly SourceCandidate[];
  readonly projectRoot: string;
}

export interface AnalyzeSourceCandidatesResult {
  readonly analyzedFiles: readonly AnalyzedSourceFile[];
  readonly parserErrors: readonly SourceParserError[];
}

export interface AnalyzeSourceCandidatesDependencies {
  readonly parseSource: SourceParser;
}

export type AnalyzeSourceCandidates = (
  request: AnalyzeSourceCandidatesRequest,
) => Promise<AnalyzeSourceCandidatesResult>;

export class SourceCandidateAnalysisInvariantError extends Error {
  public readonly code = 'SOURCE_CANDIDATE_ANALYSIS_INVARIANT_FAILED';

  public constructor() {
    super('Source candidate analysis reached an invalid internal state.');
    this.name = 'SourceCandidateAnalysisInvariantError';
  }
}

const throwInvariantError = (): never => {
  throw new SourceCandidateAnalysisInvariantError();
};

const sortAndValidateCandidates = (
  candidates: readonly SourceCandidate[],
): readonly SourceCandidate[] => {
  const sortedCandidates = candidates.toSorted((left, right) =>
    compareOrdinal(left.relativePath, right.relativePath),
  );

  for (let index = 1; index < sortedCandidates.length; index += 1) {
    if (sortedCandidates[index - 1]?.relativePath === sortedCandidates[index]?.relativePath) {
      throwInvariantError();
    }
  }

  return sortedCandidates;
};

export const createAnalyzeSourceCandidates =
  ({ parseSource }: AnalyzeSourceCandidatesDependencies): AnalyzeSourceCandidates =>
  async ({ candidates, projectRoot }) => {
    const analyzedFiles: AnalyzedSourceFile[] = [];
    const parserErrors: SourceParserError[] = [];
    const sortedCandidates = sortAndValidateCandidates(candidates);

    for (const candidate of sortedCandidates) {
      const result = await parseSource({
        candidate,
        projectRoot,
      });

      if (result.success) {
        if (result.analyzedFile.file.filePath !== candidate.relativePath) {
          throwInvariantError();
        }

        analyzedFiles.push(result.analyzedFile);
      } else {
        if (result.error.filePath !== candidate.relativePath) {
          throwInvariantError();
        }

        parserErrors.push(result.error);
      }
    }

    return {
      analyzedFiles,
      parserErrors,
    };
  };

export const analyzeSourceCandidates = createAnalyzeSourceCandidates({
  parseSource: parseSourceCandidate,
});

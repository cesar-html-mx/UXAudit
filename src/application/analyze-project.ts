import {
  buildAnalysisModel,
  type BuildAnalysisModel,
} from '../domain/models/build-analysis-model.js';
import type { AnalysisModel } from '../domain/models/analysis-model.js';
import {
  analyzeSourceCandidates,
  type AnalyzeSourceCandidates,
} from '../parsing/analyze-source-candidates.js';
import type { SourceParserError } from '../parsing/parser-contracts.js';
import {
  scanProject,
  type ScanProject,
  type ScanProjectRequest,
  type ScanProjectResult,
} from './scan-project.js';

export const ANALYZE_PROJECT_ERROR_CODES = Object.freeze({
  analysisFailed: 'ANALYZE_PROJECT_SOURCE_ANALYSIS_FAILED',
  modelFailed: 'ANALYZE_PROJECT_MODEL_FAILED',
} as const);

export type AnalyzeProjectErrorCode =
  (typeof ANALYZE_PROJECT_ERROR_CODES)[keyof typeof ANALYZE_PROJECT_ERROR_CODES];

const ANALYZE_PROJECT_ERROR_MESSAGES: Readonly<Record<AnalyzeProjectErrorCode, string>> =
  Object.freeze({
    [ANALYZE_PROJECT_ERROR_CODES.analysisFailed]:
      'Project source candidates could not be analyzed.',
    [ANALYZE_PROJECT_ERROR_CODES.modelFailed]: 'Project analysis model could not be built.',
  });

export class AnalyzeProjectError extends Error {
  public readonly code: AnalyzeProjectErrorCode;

  public constructor(code: AnalyzeProjectErrorCode) {
    super(ANALYZE_PROJECT_ERROR_MESSAGES[code]);
    this.name = 'AnalyzeProjectError';
    this.code = code;
  }
}

export interface AnalyzeProjectParsingSummary {
  readonly components: number;
  readonly failedFiles: number;
  readonly jsxNodes: number;
  readonly parsedFiles: number;
}

export interface AnalyzeProjectResult extends ScanProjectResult {
  readonly model: AnalysisModel;
  readonly parserErrors: readonly SourceParserError[];
  readonly parsingSummary: AnalyzeProjectParsingSummary;
}

export interface AnalyzeProjectDependencies {
  readonly analyzeCandidates: AnalyzeSourceCandidates;
  readonly buildModel: BuildAnalysisModel;
  readonly scanProject: ScanProject;
}

export type AnalyzeProject = (request: ScanProjectRequest) => Promise<AnalyzeProjectResult>;

export const createAnalyzeProject =
  ({
    analyzeCandidates,
    buildModel,
    scanProject: scanProjectDependency,
  }: AnalyzeProjectDependencies): AnalyzeProject =>
  async (request) => {
    const scanResult = await scanProjectDependency(request);
    let analysisResult: Awaited<ReturnType<AnalyzeSourceCandidates>>;

    try {
      analysisResult = await analyzeCandidates({
        candidates: scanResult.sourceCandidates,
        projectRoot: scanResult.projectPath,
      });
    } catch {
      throw new AnalyzeProjectError(ANALYZE_PROJECT_ERROR_CODES.analysisFailed);
    }

    let model: AnalysisModel;

    try {
      model = buildModel(analysisResult.analyzedFiles);
    } catch {
      throw new AnalyzeProjectError(ANALYZE_PROJECT_ERROR_CODES.modelFailed);
    }

    return {
      ...scanResult,
      model,
      parserErrors: analysisResult.parserErrors,
      parsingSummary: {
        components: model.components.length,
        failedFiles: analysisResult.parserErrors.length,
        jsxNodes: model.jsxNodes.length,
        parsedFiles: analysisResult.analyzedFiles.length,
      },
    };
  };

export const analyzeProject = createAnalyzeProject({
  analyzeCandidates: analyzeSourceCandidates,
  buildModel: buildAnalysisModel,
  scanProject,
});

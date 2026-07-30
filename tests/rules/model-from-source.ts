import { expect } from 'vitest';

import { buildAnalysisModel } from '../../src/domain/models/build-analysis-model.js';
import type { AnalysisModel } from '../../src/domain/models/analysis-model.js';
import {
  extractBabelAnalysis,
  type ExtractBabelAnalysisSuccess,
} from '../../src/parsing/babel/extract-babel-analysis.js';
import {
  parseBabelSource,
  type BabelParseSuccess,
} from '../../src/parsing/babel/parse-babel-source.js';
import { SOURCE_KINDS } from '../../src/project/classification/source-candidate.js';

const requireParseSuccess = (result: ReturnType<typeof parseBabelSource>): BabelParseSuccess => {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new TypeError('Expected the rule fixture to parse.');
  }

  return result;
};

const requireExtractionSuccess = (
  result: ReturnType<typeof extractBabelAnalysis>,
): ExtractBabelAnalysisSuccess => {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new TypeError('Expected the rule fixture to extract.');
  }

  return result;
};

export const modelFromSource = (
  sourceText: string,
  filePath = 'src/RuleFixture.tsx',
): AnalysisModel => {
  const parsed = requireParseSuccess(
    parseBabelSource({
      filePath,
      sourceKind: SOURCE_KINDS.typescriptJsx,
      sourceText,
    }),
  );
  const extracted = requireExtractionSuccess(
    extractBabelAnalysis({
      ast: parsed.ast,
      filePath,
      sourceKind: SOURCE_KINDS.typescriptJsx,
    }),
  );

  return buildAnalysisModel([extracted.analyzedFile]);
};

export const modelFromJsx = (jsx: string): AnalysisModel =>
  modelFromSource(`export const RuleFixture = () => (${jsx});\n`);

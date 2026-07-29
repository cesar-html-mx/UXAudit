import { extname } from 'node:path';

import { compareOrdinal } from '../project-paths.js';
import {
  SOURCE_KIND_BY_EXTENSION,
  SUPPORTED_SOURCE_EXTENSIONS,
  type ClassifySourceCandidates,
  type SourceCandidate,
  type SupportedSourceExtension,
} from './source-candidate.js';

const supportedExtensions: ReadonlySet<string> = new Set(SUPPORTED_SOURCE_EXTENSIONS);
const configurationFilePattern = /(?:^|\/)(?:[^/]+\.)?config\.(?:js|jsx|ts|tsx)$/u;

const isSupportedExtension = (extension: string): extension is SupportedSourceExtension =>
  supportedExtensions.has(extension);

const isConservativeExclusion = (relativePath: string): boolean => {
  const normalizedPath = relativePath.toLowerCase();

  return normalizedPath.endsWith('.d.ts') || configurationFilePattern.test(normalizedPath);
};

export const classifySourceCandidates: ClassifySourceCandidates = (entries) => {
  const candidates: SourceCandidate[] = [];

  for (const entry of entries) {
    const extension = extname(entry.relativePath).toLowerCase();

    if (!isSupportedExtension(extension) || isConservativeExclusion(entry.relativePath)) {
      continue;
    }

    candidates.push({
      ...entry,
      extension,
      sourceKind: SOURCE_KIND_BY_EXTENSION[extension],
    });
  }

  return candidates.sort((left, right) => compareOrdinal(left.relativePath, right.relativePath));
};

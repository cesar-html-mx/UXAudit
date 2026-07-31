import {
  COMPONENT_USE_KINDS,
  type AnalyzedComponentExport,
  type AnalyzedComponentUse,
  type ComponentLink,
} from './analysis-model.js';

export type ComponentExportFact = AnalyzedComponentExport;

/**
 * A normalized component use supplied by the parser/model boundary.
 *
 * Only `imported` uses participate in this resolver. Optional import fields
 * keep the input structural so other use kinds can share the same collection.
 */
export type ComponentUseFact = AnalyzedComponentUse;

export interface ComponentLinkInputFile {
  readonly componentExports: readonly ComponentExportFact[];
  readonly componentUses: readonly ComponentUseFact[];
  readonly filePath: string;
}

const supportedExtensions = Object.freeze(['.ts', '.tsx', '.js', '.jsx'] as const);
const windowsDrivePrefixPattern = /^[A-Za-z]:/u;

const compareOrdinal = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }

  return left > right ? 1 : 0;
};

const isNormalizedProjectFilePath = (filePath: string): boolean => {
  if (
    filePath.length === 0 ||
    filePath.startsWith('/') ||
    filePath.endsWith('/') ||
    filePath.includes('\\') ||
    filePath.includes('\0') ||
    windowsDrivePrefixPattern.test(filePath)
  ) {
    return false;
  }

  return filePath
    .split('/')
    .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
};

const resolveRelativeBase = (sourceFilePath: string, moduleSpecifier: string): null | string => {
  if (
    (!moduleSpecifier.startsWith('./') && !moduleSpecifier.startsWith('../')) ||
    moduleSpecifier.includes('\\') ||
    moduleSpecifier.includes('\0') ||
    moduleSpecifier.includes('?') ||
    moduleSpecifier.includes('#')
  ) {
    return null;
  }

  const sourceSegments = sourceFilePath.split('/');
  sourceSegments.pop();
  const specifierSegments = moduleSpecifier.split('/');

  for (const segment of specifierSegments) {
    if (segment.length === 0) {
      return null;
    }

    if (segment === '.') {
      continue;
    }

    if (segment === '..') {
      if (sourceSegments.length === 0) {
        return null;
      }

      sourceSegments.pop();
      continue;
    }

    sourceSegments.push(segment);
  }

  const finalSpecifierSegment = specifierSegments.at(-1);

  if (
    finalSpecifierSegment === undefined ||
    finalSpecifierSegment === '.' ||
    finalSpecifierSegment === '..' ||
    sourceSegments.length === 0
  ) {
    return null;
  }

  return sourceSegments.join('/');
};

const getLastSegmentExtension = (path: string): string => {
  const finalSegment = path.split('/').at(-1);

  if (finalSegment === undefined) {
    return '';
  }

  const dotIndex = finalSegment.lastIndexOf('.');
  return dotIndex < 0 ? '' : finalSegment.slice(dotIndex);
};

const createModuleCandidates = (
  sourceFilePath: string,
  moduleSpecifier: string,
): readonly string[] => {
  const basePath = resolveRelativeBase(sourceFilePath, moduleSpecifier);

  if (basePath === null) {
    return [];
  }

  const extension = getLastSegmentExtension(basePath);

  if (extension.length > 0) {
    return supportedExtensions.includes(extension as (typeof supportedExtensions)[number])
      ? [basePath]
      : [];
  }

  return supportedExtensions.flatMap((supportedExtension) => [
    `${basePath}${supportedExtension}`,
    `${basePath}/index${supportedExtension}`,
  ]);
};

const compareUses = (left: ComponentUseFact, right: ComponentUseFact): number => {
  const getOffset = (jsxNodeId: string): number => {
    const separatorIndex = jsxNodeId.lastIndexOf(':');
    const offset = Number(jsxNodeId.slice(separatorIndex + 1));
    return Number.isSafeInteger(offset) && offset >= 0 ? offset : Number.MAX_SAFE_INTEGER;
  };
  const offsetDifference = getOffset(left.jsxNodeId) - getOffset(right.jsxNodeId);

  if (offsetDifference !== 0) {
    return offsetDifference;
  }

  const jsxDifference = compareOrdinal(left.jsxNodeId, right.jsxNodeId);

  if (jsxDifference !== 0) {
    return jsxDifference;
  }

  const specifierDifference = compareOrdinal(
    left.kind === COMPONENT_USE_KINDS.imported ? left.moduleSpecifier : '',
    right.kind === COMPONENT_USE_KINDS.imported ? right.moduleSpecifier : '',
  );

  return specifierDifference === 0
    ? compareOrdinal(
        left.kind === COMPONENT_USE_KINDS.imported ? left.importedName : '',
        right.kind === COMPONENT_USE_KINDS.imported ? right.importedName : '',
      )
    : specifierDifference;
};

export const resolveComponentLinks = (
  inputFiles: readonly ComponentLinkInputFile[],
): readonly ComponentLink[] => {
  const filesByPath = new Map<string, ComponentLinkInputFile[]>();

  for (const file of inputFiles) {
    if (!isNormalizedProjectFilePath(file.filePath)) {
      continue;
    }

    const matchingFiles = filesByPath.get(file.filePath) ?? [];
    matchingFiles.push(file);
    filesByPath.set(file.filePath, matchingFiles);
  }

  const sourceFiles = [...filesByPath.entries()]
    .filter(([, files]) => files.length === 1)
    .map(([, files]) => files[0])
    .filter((file): file is ComponentLinkInputFile => file !== undefined)
    .toSorted((left, right) => compareOrdinal(left.filePath, right.filePath));
  const links: ComponentLink[] = [];

  for (const sourceFile of sourceFiles) {
    const importedUses = sourceFile.componentUses
      .filter(
        (use) =>
          use.kind === COMPONENT_USE_KINDS.imported &&
          use.importedName.length > 0 &&
          use.moduleSpecifier.length > 0 &&
          use.jsxNodeId.length > 0,
      )
      .toSorted(compareUses);

    for (const use of importedUses) {
      if (use.kind !== COMPONENT_USE_KINDS.imported) {
        continue;
      }

      const candidateFiles = createModuleCandidates(
        sourceFile.filePath,
        use.moduleSpecifier,
      ).flatMap((candidatePath) => filesByPath.get(candidatePath) ?? []);

      if (candidateFiles.length !== 1) {
        continue;
      }

      const targetFile = candidateFiles[0];

      if (targetFile === undefined) {
        continue;
      }

      const matchingExports = targetFile.componentExports.filter(
        (componentExport) =>
          componentExport.exportedName === use.importedName &&
          componentExport.componentId.length > 0,
      );

      if (matchingExports.length !== 1) {
        continue;
      }

      const targetExport = matchingExports[0];

      if (targetExport !== undefined) {
        links.push({
          jsxNodeId: use.jsxNodeId,
          targetComponentId: targetExport.componentId,
        });
      }
    }
  }

  return links;
};

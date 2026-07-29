import {
  isAbsolute as isAbsolutePath,
  relative as getRelativePath,
  sep as pathSeparator,
} from 'node:path';

export interface PathSemantics {
  readonly isAbsolute: (path: string) => boolean;
  readonly relative: (from: string, to: string) => string;
  readonly sep: string;
}

const nativePathSemantics: PathSemantics = {
  isAbsolute: isAbsolutePath,
  relative: getRelativePath,
  sep: pathSeparator,
};

export const compareOrdinal = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }

  return left > right ? 1 : 0;
};

export const isPathWithinRoot = (
  canonicalRoot: string,
  canonicalCandidate: string,
  semantics: PathSemantics = nativePathSemantics,
): boolean => {
  const relativePath = semantics.relative(canonicalRoot, canonicalCandidate);

  return (
    relativePath === '' ||
    (!semantics.isAbsolute(relativePath) &&
      relativePath !== '..' &&
      !relativePath.startsWith(`..${semantics.sep}`))
  );
};

export const toProjectRelativePath = (
  canonicalRoot: string,
  absolutePath: string,
  semantics: PathSemantics = nativePathSemantics,
): string => {
  const relativePath = semantics.relative(canonicalRoot, absolutePath);

  return relativePath === '' ? '.' : relativePath.split(semantics.sep).join('/');
};

import { extname, isAbsolute, resolve } from 'node:path';

import { compareOrdinal, isPathWithinRoot, toProjectRelativePath } from '../project-paths.js';
import {
  FileInventoryError,
  type BuildFileInventory,
  type InventoryEntry,
} from './inventory-types.js';

const compareEntries = (left: InventoryEntry, right: InventoryEntry): number =>
  compareOrdinal(left.relativePath, right.relativePath);

export const buildFileInventory: BuildFileInventory = (projectRoot, files) => {
  const canonicalRoot = resolve(projectRoot);
  const entriesByCanonicalPath = new Map<string, InventoryEntry>();

  for (const file of files) {
    const canonicalPath = resolve(file.absolutePath);

    if (
      !isAbsolute(file.absolutePath) ||
      canonicalPath === canonicalRoot ||
      !isPathWithinRoot(canonicalRoot, canonicalPath)
    ) {
      throw new FileInventoryError();
    }

    if (!entriesByCanonicalPath.has(canonicalPath)) {
      const relativePath = toProjectRelativePath(canonicalRoot, canonicalPath);

      entriesByCanonicalPath.set(canonicalPath, {
        absolutePath: canonicalPath,
        extension: extname(relativePath).toLowerCase(),
        kind: 'file',
        relativePath,
      });
    }
  }

  return {
    entries: [...entriesByCanonicalPath.values()].sort(compareEntries),
    projectRoot: canonicalRoot,
  };
};

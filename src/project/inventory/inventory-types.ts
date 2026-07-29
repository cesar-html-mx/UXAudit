import type { DiscoveredFile } from '../discovery/discovery-types.js';

export interface InventoryEntry {
  readonly absolutePath: string;
  readonly extension: string;
  readonly kind: 'file';
  readonly relativePath: string;
}

export interface FileInventory {
  readonly entries: readonly InventoryEntry[];
  readonly projectRoot: string;
}

export type BuildFileInventory = (
  projectRoot: string,
  files: readonly DiscoveredFile[],
) => FileInventory;

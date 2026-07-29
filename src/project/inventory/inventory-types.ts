import type { DiscoveredFile } from '../discovery/discovery-types.js';

export const FILE_INVENTORY_ERROR_CODES = {
  invalidEntry: 'FILE_INVENTORY_INVALID_ENTRY',
} as const;

export type FileInventoryErrorCode =
  (typeof FILE_INVENTORY_ERROR_CODES)[keyof typeof FILE_INVENTORY_ERROR_CODES];

export class FileInventoryError extends Error {
  public readonly code: FileInventoryErrorCode;

  public constructor() {
    super('Discovered file is not a canonical project descendant.');
    this.name = 'FileInventoryError';
    this.code = FILE_INVENTORY_ERROR_CODES.invalidEntry;
  }
}

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

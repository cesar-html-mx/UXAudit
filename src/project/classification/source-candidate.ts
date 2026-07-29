import type { InventoryEntry } from '../inventory/inventory-types.js';

export const SUPPORTED_SOURCE_EXTENSIONS = Object.freeze(['.js', '.jsx', '.ts', '.tsx'] as const);

export type SupportedSourceExtension = (typeof SUPPORTED_SOURCE_EXTENSIONS)[number];

export const SOURCE_KINDS = {
  javascript: 'javascript',
  javascriptJsx: 'javascript-jsx',
  typescript: 'typescript',
  typescriptJsx: 'typescript-jsx',
} as const;

export type SourceKind = (typeof SOURCE_KINDS)[keyof typeof SOURCE_KINDS];

export const SOURCE_KIND_BY_EXTENSION: Readonly<Record<SupportedSourceExtension, SourceKind>> =
  Object.freeze({
    '.js': SOURCE_KINDS.javascript,
    '.jsx': SOURCE_KINDS.javascriptJsx,
    '.ts': SOURCE_KINDS.typescript,
    '.tsx': SOURCE_KINDS.typescriptJsx,
  });

export interface SourceCandidate extends InventoryEntry {
  readonly extension: SupportedSourceExtension;
  readonly sourceKind: SourceKind;
}

export type ClassifySourceCandidates = (
  entries: readonly InventoryEntry[],
) => readonly SourceCandidate[];

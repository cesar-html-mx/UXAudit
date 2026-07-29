import type { DiscoveryConfiguration } from './discovery-config.js';

export const DISCOVERY_EXCLUSION_REASONS = {
  alreadyVisited: 'already-visited',
  directoryName: 'directory-name',
  fileName: 'file-name',
  outsideRoot: 'outside-root',
  symlinkPolicy: 'symlink-policy',
  unsupportedEntry: 'unsupported-entry',
} as const;

export type DiscoveryExclusionReason =
  (typeof DISCOVERY_EXCLUSION_REASONS)[keyof typeof DISCOVERY_EXCLUSION_REASONS];

export const DISCOVERY_ENTRY_TYPES = {
  directory: 'directory',
  file: 'file',
  other: 'other',
  symbolicLink: 'symbolic-link',
} as const;

export type DiscoveryEntryType = (typeof DISCOVERY_ENTRY_TYPES)[keyof typeof DISCOVERY_ENTRY_TYPES];

export const DISCOVERY_ISSUE_CODES = {
  entryDisappeared: 'DISCOVERY_ENTRY_DISAPPEARED',
  ioFailed: 'DISCOVERY_IO_FAILED',
  notAccessible: 'DISCOVERY_NOT_ACCESSIBLE',
  symlinkLoop: 'DISCOVERY_SYMLINK_LOOP',
} as const;

export type DiscoveryIssueCode = (typeof DISCOVERY_ISSUE_CODES)[keyof typeof DISCOVERY_ISSUE_CODES];

export const DISCOVERY_OPERATIONS = {
  inspect: 'inspect',
  readDirectory: 'read-directory',
  resolvePath: 'resolve-path',
} as const;

export type DiscoveryOperation = (typeof DISCOVERY_OPERATIONS)[keyof typeof DISCOVERY_OPERATIONS];

export interface DiscoveredFile {
  readonly absolutePath: string;
  readonly observedPath: string;
  readonly viaSymlink: boolean;
}

export interface DiscoveryExclusion {
  readonly entryType: DiscoveryEntryType;
  readonly reason: DiscoveryExclusionReason;
  readonly relativePath: string;
}

export interface DiscoveryIssue {
  readonly code: DiscoveryIssueCode;
  readonly operation: DiscoveryOperation;
  readonly recoverable: true;
  readonly relativePath: string;
}

export interface DiscoveryResult {
  readonly exclusions: readonly DiscoveryExclusion[];
  readonly files: readonly DiscoveredFile[];
  readonly issues: readonly DiscoveryIssue[];
  readonly projectRoot: string;
}

export type DiscoverProjectFiles = (
  projectRoot: string,
  configuration?: DiscoveryConfiguration,
) => Promise<DiscoveryResult>;

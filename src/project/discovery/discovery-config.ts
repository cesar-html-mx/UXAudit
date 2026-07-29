export const SYMLINK_POLICIES = {
  followWithinRoot: 'follow-within-root',
  skip: 'skip',
} as const;

export type SymlinkPolicy = (typeof SYMLINK_POLICIES)[keyof typeof SYMLINK_POLICIES];

export interface DiscoveryConfiguration {
  readonly excludedDirectoryNames: readonly string[];
  readonly excludedFileNames: readonly string[];
  readonly symlinkPolicy: SymlinkPolicy;
}

export const DEFAULT_EXCLUDED_DIRECTORY_NAMES = Object.freeze([
  '.cache',
  '.git',
  '.github',
  '.hg',
  '.next',
  '.nuxt',
  '.output',
  '.parcel-cache',
  '.storybook',
  '.svn',
  '.turbo',
  '.vite',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'storybook-static',
] as const);

export const DEFAULT_EXCLUDED_FILE_NAMES = Object.freeze([
  'babel.config.js',
  'eslint.config.js',
  'eslint.config.mjs',
  'jest.config.js',
  'jest.config.ts',
  'next.config.js',
  'next.config.mjs',
  'playwright.config.ts',
  'postcss.config.js',
  'prettier.config.js',
  'rollup.config.js',
  'rollup.config.ts',
  'tailwind.config.js',
  'tailwind.config.ts',
  'tsup.config.ts',
  'uxaudit.config.json',
  'vite.config.js',
  'vite.config.ts',
  'vitest.config.ts',
  'webpack.config.js',
  'webpack.config.ts',
] as const);

export const DEFAULT_DISCOVERY_CONFIGURATION: DiscoveryConfiguration = Object.freeze({
  excludedDirectoryNames: DEFAULT_EXCLUDED_DIRECTORY_NAMES,
  excludedFileNames: DEFAULT_EXCLUDED_FILE_NAMES,
  symlinkPolicy: SYMLINK_POLICIES.skip,
});

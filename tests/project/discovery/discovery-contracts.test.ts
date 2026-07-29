import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DISCOVERY_CONFIGURATION,
  DEFAULT_EXCLUDED_DIRECTORY_NAMES,
  DEFAULT_EXCLUDED_FILE_NAMES,
  SYMLINK_POLICIES,
} from '../../../src/project/discovery/discovery-config.js';
import {
  SOURCE_KIND_BY_EXTENSION,
  SOURCE_KINDS,
  SUPPORTED_SOURCE_EXTENSIONS,
} from '../../../src/project/classification/source-candidate.js';

describe('discovery contracts and defaults', () => {
  it('uses explicit immutable exclusions and skips symbolic links by default', () => {
    expect(DEFAULT_DISCOVERY_CONFIGURATION).toEqual({
      excludedDirectoryNames: DEFAULT_EXCLUDED_DIRECTORY_NAMES,
      excludedFileNames: DEFAULT_EXCLUDED_FILE_NAMES,
      symlinkPolicy: SYMLINK_POLICIES.skip,
    });
    expect(DEFAULT_EXCLUDED_DIRECTORY_NAMES).toContain('node_modules');
    expect(DEFAULT_EXCLUDED_DIRECTORY_NAMES).toContain('dist');
    expect(DEFAULT_EXCLUDED_FILE_NAMES).toContain('vite.config.ts');
    expect(Object.isFrozen(DEFAULT_DISCOVERY_CONFIGURATION)).toBe(true);
    expect(Object.isFrozen(DEFAULT_EXCLUDED_DIRECTORY_NAMES)).toBe(true);
    expect(Object.isFrozen(DEFAULT_EXCLUDED_FILE_NAMES)).toBe(true);
  });

  it('defines only the four source extensions supported by the product boundary', () => {
    expect(SUPPORTED_SOURCE_EXTENSIONS).toEqual(['.js', '.jsx', '.ts', '.tsx']);
    expect(SOURCE_KIND_BY_EXTENSION).toEqual({
      '.js': SOURCE_KINDS.javascript,
      '.jsx': SOURCE_KINDS.javascriptJsx,
      '.ts': SOURCE_KINDS.typescript,
      '.tsx': SOURCE_KINDS.typescriptJsx,
    });
    expect(Object.isFrozen(SUPPORTED_SOURCE_EXTENSIONS)).toBe(true);
    expect(Object.isFrozen(SOURCE_KIND_BY_EXTENSION)).toBe(true);
  });
});

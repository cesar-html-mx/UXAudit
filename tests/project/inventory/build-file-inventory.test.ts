import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildFileInventory } from '../../../src/project/inventory/build-file-inventory.js';
import {
  FILE_INVENTORY_ERROR_CODES,
  FileInventoryError,
} from '../../../src/project/inventory/inventory-types.js';

describe('buildFileInventory', () => {
  it('normalizes, deduplicates, and ordinally sorts canonical file records', () => {
    const root = resolve('inventory-project');
    const alpha = join(root, 'src', 'Alpha.TSX');
    const beta = join(root, 'src', 'nested', 'beta.js');
    const original = [
      { absolutePath: beta, observedPath: beta, viaSymlink: false },
      {
        absolutePath: alpha,
        observedPath: join(root, 'alias', 'Alpha.TSX'),
        viaSymlink: true,
      },
      { absolutePath: alpha, observedPath: alpha, viaSymlink: false },
    ] as const;

    const inventory = buildFileInventory(root, original);

    expect(inventory).toEqual({
      entries: [
        {
          absolutePath: alpha,
          extension: '.tsx',
          kind: 'file',
          relativePath: 'src/Alpha.TSX',
        },
        {
          absolutePath: beta,
          extension: '.js',
          kind: 'file',
          relativePath: 'src/nested/beta.js',
        },
      ],
      projectRoot: root,
    });
    expect(original.map((file) => file.observedPath)).toEqual([
      beta,
      join(root, 'alias', 'Alpha.TSX'),
      alpha,
    ]);
  });

  it('retains unsupported files with a normalized or empty extension', () => {
    const root = resolve('inventory-project');
    const inventory = buildFileInventory(root, [
      {
        absolutePath: join(root, '.eslintrc'),
        observedPath: join(root, '.eslintrc'),
        viaSymlink: false,
      },
      {
        absolutePath: join(root, 'styles.CSS'),
        observedPath: join(root, 'styles.CSS'),
        viaSymlink: false,
      },
    ]);

    expect(
      inventory.entries.map(({ extension, relativePath }) => ({ extension, relativePath })),
    ).toEqual([
      { extension: '', relativePath: '.eslintrc' },
      { extension: '.css', relativePath: 'styles.CSS' },
    ]);
  });

  it('produces byte-identical serializations for repeated equivalent input', () => {
    const root = resolve('inventory-project');
    const files = [
      {
        absolutePath: join(root, 'z.ts'),
        observedPath: join(root, 'z.ts'),
        viaSymlink: false,
      },
      {
        absolutePath: join(root, 'a.ts'),
        observedPath: join(root, 'a.ts'),
        viaSymlink: false,
      },
    ] as const;

    expect(JSON.stringify(buildFileInventory(root, files))).toBe(
      JSON.stringify(buildFileInventory(root, [...files].reverse())),
    );
  });

  it.each([
    ['the root itself', (root: string) => root],
    ['a sibling-prefix path', (root: string) => `${root}-outside/file.ts`],
    ['an ancestor path', (root: string) => resolve(root, '..', 'file.ts')],
    ['a relative path', () => 'src/file.ts'],
  ])('rejects %s as an internal invariant violation', (_scenario, getInvalidPath) => {
    const root = resolve('inventory-project');

    try {
      buildFileInventory(root, [
        {
          absolutePath: getInvalidPath(root),
          observedPath: getInvalidPath(root),
          viaSymlink: false,
        },
      ]);
      throw new Error('Expected inventory construction to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(FileInventoryError);
      expect(error).toMatchObject({
        code: FILE_INVENTORY_ERROR_CODES.invalidEntry,
        message: 'Discovered file is not a canonical project descendant.',
      });
    }
  });
});

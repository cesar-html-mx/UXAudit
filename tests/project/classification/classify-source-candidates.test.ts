import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { classifySourceCandidates } from '../../../src/project/classification/classify-source-candidates.js';
import {
  SOURCE_KINDS,
  type SourceCandidate,
} from '../../../src/project/classification/source-candidate.js';
import type { InventoryEntry } from '../../../src/project/inventory/inventory-types.js';

const root = resolve('classification-project');

const createEntry = (relativePath: string, extension = ''): InventoryEntry => ({
  absolutePath: join(root, ...relativePath.split('/')),
  extension,
  kind: 'file',
  relativePath,
});

describe('classifySourceCandidates', () => {
  it('classifies the supported mixed-language matrix without React semantic claims', () => {
    const candidates = classifySourceCandidates([
      createEntry('src/component.TSX', '.tsx'),
      createEntry('src/helper.TS', '.ts'),
      createEntry('src/legacy.JS', '.js'),
      createEntry('src/view.JSX', '.jsx'),
    ]);

    expect(candidates).toEqual([
      {
        ...createEntry('src/component.TSX', '.tsx'),
        sourceKind: SOURCE_KINDS.typescriptJsx,
      },
      {
        ...createEntry('src/helper.TS', '.ts'),
        sourceKind: SOURCE_KINDS.typescript,
      },
      {
        ...createEntry('src/legacy.JS', '.js'),
        sourceKind: SOURCE_KINDS.javascript,
      },
      {
        ...createEntry('src/view.JSX', '.jsx'),
        sourceKind: SOURCE_KINDS.javascriptJsx,
      },
    ]);
    expect(
      candidates.every(
        (candidate) => !('isReactComponent' in candidate) && !('componentType' in candidate),
      ),
    ).toBe(true);
  });

  it('rejects unsupported, declaration, and configuration files conservatively', () => {
    const candidates = classifySourceCandidates([
      createEntry('README'),
      createEntry('src/button.config.ts', '.ts'),
      createEntry('src/configuration.ts', '.ts'),
      createEntry('src/environment.d.ts', '.ts'),
      createEntry('src/styles.css', '.css'),
      createEntry('src/view.tsx', '.tsx'),
      createEntry('vite.config.ts', '.ts'),
      createEntry('package.json', '.json'),
    ]);

    expect(candidates.map((candidate) => candidate.relativePath)).toEqual([
      'src/configuration.ts',
      'src/view.tsx',
    ]);
  });

  it('derives extension from the normalized path instead of trusting incidental metadata', () => {
    const candidates = classifySourceCandidates([
      createEntry('src/component.TSX', '.json'),
      createEntry('src/readme.md', '.tsx'),
    ]);

    expect(candidates).toEqual([
      {
        ...createEntry('src/component.TSX', '.json'),
        extension: '.tsx',
        sourceKind: SOURCE_KINDS.typescriptJsx,
      },
    ]);
  });

  it('returns deterministic relative-path order without mutating input', () => {
    const entries = [createEntry('src/z.tsx', '.tsx'), createEntry('src/a.js', '.js')];
    const originalOrder = entries.map((entry) => entry.relativePath);

    const first: readonly SourceCandidate[] = classifySourceCandidates(entries);
    const second = classifySourceCandidates([...entries].reverse());

    expect(first.map((candidate) => candidate.relativePath)).toEqual(['src/a.js', 'src/z.tsx']);
    expect(second).toEqual(first);
    expect(entries.map((entry) => entry.relativePath)).toEqual(originalOrder);
  });
});

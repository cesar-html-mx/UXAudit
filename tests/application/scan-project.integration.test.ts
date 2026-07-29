import { access, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { afterEach, describe, expect, it } from 'vitest';

import { scanProject } from '../../src/application/scan-project.js';

const createdDirectories: string[] = [];

const createControlledProject = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'uxaudit-scan-integration-'));
  createdDirectories.push(directory);
  const root = await realpath(directory);
  await Promise.all([
    mkdir(join(root, 'dist'), { recursive: true }),
    mkdir(join(root, 'node_modules', 'dependency'), { recursive: true }),
    mkdir(join(root, 'src', 'nested'), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(root, 'README.md'), '# Controlled project\n', 'utf8'),
    writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({
        scripts: {
          sentinel: "node -e \"require('node:fs').writeFileSync('TARGET_CODE_EXECUTED', '')\"",
        },
      })}\n`,
      'utf8',
    ),
    writeFile(join(root, 'dist', 'bundle.js'), 'generated();\n', 'utf8'),
    writeFile(join(root, 'node_modules', 'dependency', 'index.js'), 'dependency();\n', 'utf8'),
    writeFile(join(root, 'src', 'a.ts'), 'export const value = 1;\n', 'utf8'),
    writeFile(join(root, 'src', 'button.config.ts'), 'export const config = {};\n', 'utf8'),
    writeFile(
      join(root, 'src', 'legacy.js'),
      "require('node:fs').writeFileSync(require('node:path').join(__dirname, '..', 'TARGET_CODE_EXECUTED'), '');\n",
      'utf8',
    ),
    writeFile(join(root, 'src', 'nested', 'b.tsx'), 'export const B = () => null;\n', 'utf8'),
    writeFile(join(root, 'src', 'styles.css'), '.root {}\n', 'utf8'),
    writeFile(join(root, 'src', 'types.d.ts'), 'export type Value = string;\n', 'utf8'),
    writeFile(join(root, 'src', 'view.jsx'), 'export const View = () => null;\n', 'utf8'),
    writeFile(join(root, 'vite.config.ts'), 'export default {};\n', 'utf8'),
  ]);
  await symlink(
    join(root, 'src'),
    join(root, 'alias'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );

  return root;
};

afterEach(async () => {
  await Promise.all(
    createdDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('scanProject integration', () => {
  it('produces a deterministic discovery summary for a controlled mixed project', async () => {
    const root = await createControlledProject();

    const first = await scanProject({ projectPath: root });
    const second = await scanProject({ projectPath: root });

    expect(first.summary).toEqual({
      discoveredFiles: 9,
      excludedEntries: 4,
      inventoryEntries: 9,
      recoverableErrors: 0,
      sourceCandidates: 4,
    });
    expect(first.sourceCandidates.map((candidate) => candidate.relativePath)).toEqual([
      'src/a.ts',
      'src/legacy.js',
      'src/nested/b.tsx',
      'src/view.jsx',
    ]);
    expect(first.discovery.exclusions.map((exclusion) => exclusion.relativePath)).toEqual([
      'alias',
      'dist',
      'node_modules',
      'vite.config.ts',
    ]);
    expect(first.inventory.entries).toHaveLength(9);
    expect(new Set(first.inventory.entries.map((entry) => entry.absolutePath)).size).toBe(9);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    await expect(access(join(root, 'TARGET_CODE_EXECUTED'))).rejects.toBeDefined();
  });
});

import { access, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { analyzeProject } from '../../src/application/analyze-project.js';
import {
  SOURCE_PARSER_ERROR_CODES,
  SOURCE_PARSER_ERROR_STAGES,
} from '../../src/parsing/parser-contracts.js';

const createdDirectories: string[] = [];

const createControlledProject = async (): Promise<string> => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'uxaudit-analysis-integration-'));
  createdDirectories.push(temporaryDirectory);
  const projectRoot = await realpath(temporaryDirectory);
  const sourceDirectory = join(projectRoot, 'src');

  await mkdir(sourceDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      join(sourceDirectory, 'App.tsx'),
      [
        'export const App = () => (',
        '  <main>',
        '    <h1>Hello</h1>',
        '    <img alt="" />',
        '  </main>',
        ');',
        '',
      ].join('\n'),
      'utf8',
    ),
    writeFile(
      join(sourceDirectory, 'Broken.tsx'),
      'export const Broken = () => <section><span>Missing</section>;\n',
      'utf8',
    ),
    writeFile(join(sourceDirectory, 'helper.ts'), 'export const answer: number = 42;\n', 'utf8'),
    writeFile(
      join(sourceDirectory, 'no-execution.js'),
      [
        "import { writeFileSync } from 'node:fs';",
        "writeFileSync(new URL('../TARGET_CODE_EXECUTED', import.meta.url), 'executed');",
        "throw new Error('Analyzed source must stay inert.');",
        'export const unreachable = true;',
        '',
      ].join('\n'),
      'utf8',
    ),
  ]);

  return projectRoot;
};

afterEach(async () => {
  await Promise.all(
    createdDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('analyzeProject integration', () => {
  it('isolates malformed syntax, builds sibling models, and never executes target code', async () => {
    const projectRoot = await createControlledProject();
    const first = await analyzeProject({ projectPath: projectRoot });
    const second = await analyzeProject({ projectPath: projectRoot });

    expect(first.sourceCandidates.map((candidate) => candidate.relativePath)).toEqual([
      'src/App.tsx',
      'src/Broken.tsx',
      'src/helper.ts',
      'src/no-execution.js',
    ]);
    expect(first.parsingSummary).toEqual({
      components: 1,
      failedFiles: 1,
      jsxNodes: 3,
      parsedFiles: 3,
    });
    expect(first.parserErrors).toEqual([
      expect.objectContaining({
        code: SOURCE_PARSER_ERROR_CODES.parseFailed,
        filePath: 'src/Broken.tsx',
        recoverable: true,
        stage: SOURCE_PARSER_ERROR_STAGES.parse,
      }),
    ]);
    expect(first.model.files.map((file) => file.filePath)).toEqual([
      'src/App.tsx',
      'src/helper.ts',
      'src/no-execution.js',
    ]);
    expect(first.model.components).toEqual([
      expect.objectContaining({
        name: 'App',
      }),
    ]);
    expect(first.model.jsxNodes.map((node) => node.location.filePath)).toEqual([
      'src/App.tsx',
      'src/App.tsx',
      'src/App.tsx',
    ]);
    expect(first.model.jsxNodes.map((node) => node.location.start.line)).toEqual([2, 3, 4]);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    await expect(access(join(projectRoot, 'TARGET_CODE_EXECUTED'))).rejects.toBeDefined();
  });
});

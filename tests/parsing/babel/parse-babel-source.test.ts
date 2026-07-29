import { access, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import traverse from '@babel/traverse';
import type { File, SourceLocation as BabelSourceLocation } from '@babel/types';
import { afterEach, describe, expect, it } from 'vitest';

import {
  parseBabelSource,
  type BabelParseSuccess,
} from '../../../src/parsing/babel/parse-babel-source.js';
import {
  SOURCE_PARSER_ERROR_CODES,
  SOURCE_PARSER_ERROR_STAGES,
} from '../../../src/parsing/parser-contracts.js';
import {
  SOURCE_KINDS,
  type SourceKind,
} from '../../../src/project/classification/source-candidate.js';

interface FixtureManifestEntry {
  readonly file: string;
  readonly logicalName: string;
  readonly sourceKind: SourceKind;
}

interface FixtureManifest {
  readonly fixtures: readonly FixtureManifestEntry[];
  readonly schemaVersion: 1;
}

const fixturesDirectory = new URL('../../fixtures/m03-parsing/', import.meta.url);
const fixturesPath = fileURLToPath(fixturesDirectory);
const sentinelPath = fileURLToPath(new URL('TARGET_CODE_EXECUTED', fixturesDirectory));

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSourceKind = (value: unknown): value is SourceKind =>
  Object.values(SOURCE_KINDS).some((sourceKind) => sourceKind === value);

const loadManifest = async (): Promise<FixtureManifest> => {
  const content = await readFile(new URL('manifest.json', fixturesDirectory), 'utf8');
  const parsed: unknown = JSON.parse(content);

  if (!isRecord(parsed) || parsed['schemaVersion'] !== 1 || !Array.isArray(parsed['fixtures'])) {
    throw new TypeError('M03 fixture manifest is invalid.');
  }

  const fixtures = parsed['fixtures'].map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry['file'] !== 'string' ||
      typeof entry['logicalName'] !== 'string' ||
      !isSourceKind(entry['sourceKind'])
    ) {
      throw new TypeError('M03 fixture entry is invalid.');
    }

    return {
      file: entry['file'],
      logicalName: entry['logicalName'],
      sourceKind: entry['sourceKind'],
    };
  });

  return {
    fixtures,
    schemaVersion: 1,
  };
};

const parseFixture = async (entry: FixtureManifestEntry) => {
  const sourceText = await readFile(new URL(entry.file, fixturesDirectory), 'utf8');

  return parseBabelSource({
    filePath: `src/${entry.logicalName}`,
    sourceKind: entry.sourceKind,
    sourceText,
  });
};

const requireSuccess = (result: ReturnType<typeof parseBabelSource>): BabelParseSuccess => {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new TypeError('Expected source parsing to succeed.');
  }

  return result;
};

const getProgramLocation = (ast: File) => {
  const location = ast.program.loc;

  if (location === null || location === undefined) {
    throw new TypeError('Expected Babel program location.');
  }

  return location;
};

const getFirstJsxLocation = (ast: File) => {
  const locations: BabelSourceLocation[] = [];

  traverse(ast, {
    JSXElement(path) {
      if (path.node.loc !== null && path.node.loc !== undefined) {
        locations.push(path.node.loc);
        path.stop();
      }
    },
  });

  const location = locations[0];

  if (location === undefined) {
    throw new TypeError('Expected one JSX element location.');
  }

  return location;
};

afterEach(async () => {
  await rm(sentinelPath, { force: true });
});

describe('parseBabelSource', () => {
  it('parses the JS, JSX, TS, and TSX fixture matrix with source-kind-specific plugins', async () => {
    const manifest = await loadManifest();
    const primaryFixtures = manifest.fixtures.slice(0, 4);
    const results = await Promise.all(primaryFixtures.map(parseFixture));

    expect(primaryFixtures.map((fixture) => fixture.sourceKind)).toEqual([
      SOURCE_KINDS.javascript,
      SOURCE_KINDS.javascriptJsx,
      SOURCE_KINDS.typescript,
      SOURCE_KINDS.typescriptJsx,
    ]);
    expect(results.every((result) => result.success)).toBe(true);

    const sourceTypes = results.map((result) =>
      result.success ? result.ast.program.sourceType : 'failure',
    );
    expect(sourceTypes).toEqual(['script', 'module', 'module', 'module']);

    for (const [index, result] of results.entries()) {
      const success = requireSuccess(result);
      const fixture = primaryFixtures[index];
      expect(getProgramLocation(success.ast).filename).toBe(
        fixture === undefined ? undefined : `src/${fixture.logicalName}`,
      );
    }
  });

  it('rejects malformed syntax with one stable relative-path error and exact position', async () => {
    const manifest = await loadManifest();
    const malformed = manifest.fixtures.find((fixture) => fixture.file === 'malformed.tsx.fixture');

    if (malformed === undefined) {
      throw new TypeError('Malformed fixture is missing.');
    }

    const result = await parseFixture(malformed);

    expect(result).toEqual({
      error: {
        code: SOURCE_PARSER_ERROR_CODES.parseFailed,
        filePath: 'src/malformed.tsx',
        message: 'Source file contains invalid or unsupported syntax.',
        position: {
          column: 12,
          line: 4,
          offset: 84,
        },
        recoverable: true,
        stage: SOURCE_PARSER_ERROR_STAGES.parse,
      },
      success: false,
    });
    expect(JSON.stringify(result)).not.toContain(fixturesPath);
    expect(JSON.stringify(result)).not.toContain('Missing closing tag');
  });

  it.each([
    [
      'TypeScript under the JavaScript kind',
      'const value: string = "typed";',
      SOURCE_KINDS.javascript,
    ],
    ['JSX under the TypeScript kind', 'const View = () => <div />;', SOURCE_KINDS.typescript],
  ] as const)('rejects %s', (_description, sourceText, sourceKind) => {
    const result = parseBabelSource({
      filePath: 'src/mismatched-source.ts',
      sourceKind,
      sourceText,
    });

    expect(result).toMatchObject({
      error: {
        code: SOURCE_PARSER_ERROR_CODES.parseFailed,
        filePath: 'src/mismatched-source.ts',
        stage: SOURCE_PARSER_ERROR_STAGES.parse,
      },
      success: false,
    });
  });

  it.each([
    ['LF', 'const value = 1;\n<div />;', 2, 0, 17],
    ['CRLF', 'const value = 1;\r\n<div />;', 2, 0, 18],
    ['an astral character', 'const emoji = "😀"; <div />;', 1, 20, 20],
  ] as const)(
    'preserves the exact UTF-16 JSX location after %s',
    (_description, sourceText, line, column, offset) => {
      const success = requireSuccess(
        parseBabelSource({
          filePath: 'src/location.jsx',
          sourceKind: SOURCE_KINDS.javascriptJsx,
          sourceText,
        }),
      );
      const location = getFirstJsxLocation(success.ast);

      expect(location.start).toMatchObject({
        column,
        index: offset,
        line,
      });
      expect(offset).toBe(sourceText.indexOf('<'));
    },
  );

  it('returns deterministic AST data without tokens or node-attached comments', () => {
    const sourceText = '/* leading */\nexport const View = () => <div />;\n';
    const first = requireSuccess(
      parseBabelSource({
        filePath: 'src/location.tsx',
        sourceKind: SOURCE_KINDS.typescriptJsx,
        sourceText,
      }),
    );
    const second = requireSuccess(
      parseBabelSource({
        filePath: 'src/location.tsx',
        sourceKind: SOURCE_KINDS.typescriptJsx,
        sourceText,
      }),
    );
    const firstStatement = first.ast.program.body[0];

    expect(first.ast.tokens).toBeUndefined();
    expect(firstStatement?.leadingComments).toBeUndefined();
    expect(JSON.stringify(second.ast)).toBe(JSON.stringify(first.ast));
  });

  it('parses target code as inert text without creating its sentinel', async () => {
    const manifest = await loadManifest();
    const noExecution = manifest.fixtures.find(
      (fixture) => fixture.file === 'no-execution.js.fixture',
    );

    if (noExecution === undefined) {
      throw new TypeError('No-execution fixture is missing.');
    }

    await rm(sentinelPath, { force: true });
    const result = await parseFixture(noExecution);

    expect(result.success).toBe(true);
    await expect(access(sentinelPath)).rejects.toBeDefined();
  });
});

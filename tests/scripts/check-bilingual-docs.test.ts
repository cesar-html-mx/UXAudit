import { spawn } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { afterEach, describe, expect, it } from 'vitest';

interface ExecutionResult {
  readonly exitCode: number | null;
  readonly stderr: string;
  readonly stdout: string;
}

interface RelativePair {
  readonly englishPath: string;
  readonly spanishPath: string;
}

const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const sourceScriptPath = path.join(repositoryRoot, 'scripts', 'check-bilingual-docs.mjs');
const documentationFileNames = [
  '00_INDEX.md',
  '01_PROJECT_CONTEXT.md',
  '02_PRODUCT_SPEC.md',
  '03_REQUIREMENTS.md',
  '04_ARCHITECTURE.md',
  '05_ENGINEERING_STANDARDS.md',
  '06_TEST_STRATEGY.md',
  '07_SECURITY.md',
  '08_RULE_CATALOG.md',
  '09_ACCEPTANCE_CRITERIA.md',
  '10_DOCUMENTATION_POLICY.md',
  '11_INFRASTRUCTURE.md',
  '12_TRACEABILITY_MATRIX.md',
  '13_GLOSSARY.md',
  '14_ACADEMIC_ALIGNMENT.md',
  '15_SOURCE_MAP.md',
] as const;
const requiredPairs: readonly RelativePair[] = [
  {
    englishPath: 'README.en.md',
    spanishPath: 'README.es.md',
  },
  ...documentationFileNames.map((fileName) => ({
    englishPath: path.join('docs', fileName),
    spanishPath: path.join('docs', 'es', fileName),
  })),
  {
    englishPath: path.join('docs', 'architecture', 'diagrams', 'README.md'),
    spanishPath: path.join('docs', 'es', 'architecture', 'diagrams', 'README.md'),
  },
];
const fencedBlock = ['```bash', 'npm run test', '```'].join('\n');
const temporaryRoots: string[] = [];

const toPortablePath = (value: string): string => value.split(path.sep).join('/');

const executeChecker = (rootDirectory: string): Promise<ExecutionResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(rootDirectory, 'scripts', 'check-bilingual-docs.mjs')],
      {
        cwd: rootDirectory,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const stdout: string[] = [];
    const stderr: string[] = [];

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk: string) => {
      stderr.push(chunk);
    });
    child.once('error', reject);
    child.once('close', (exitCode) => {
      resolve({
        exitCode,
        stderr: stderr.join(''),
        stdout: stdout.join(''),
      });
    });
  });

const writePair = async (rootDirectory: string, pair: RelativePair): Promise<void> => {
  const englishPath = path.join(rootDirectory, pair.englishPath);
  const spanishPath = path.join(rootDirectory, pair.spanishPath);
  const englishTarget = toPortablePath(path.relative(path.dirname(englishPath), spanishPath));
  const spanishTarget = toPortablePath(path.relative(path.dirname(spanishPath), englishPath));

  await Promise.all([
    mkdir(path.dirname(englishPath), { recursive: true }),
    mkdir(path.dirname(spanishPath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(
      englishPath,
      `# English title

[Español](${englishTarget}) | **English**

## Details

| Key | Value |
| --- | ----- |
| one | two   |

Use \`npm run test\` twice: \`npm run test\`.

${fencedBlock}
`,
      'utf8',
    ),
    writeFile(
      spanishPath,
      `# Título en español

**Español** | [English](${spanishTarget})

## Detalles

| Clave | Valor |
| ----- | ----- |
| uno   | dos   |

Usa \`npm run test\` dos veces: \`npm run test\`.

${fencedBlock}
`,
      'utf8',
    ),
  ]);
};

const createFixture = async (): Promise<string> => {
  const rootDirectory = await mkdtemp(path.join(tmpdir(), 'uxaudit-bilingual-docs-'));

  temporaryRoots.push(rootDirectory);
  await mkdir(path.join(rootDirectory, 'scripts'), { recursive: true });
  await copyFile(sourceScriptPath, path.join(rootDirectory, 'scripts', 'check-bilingual-docs.mjs'));
  await Promise.all(requiredPairs.map(async (pair) => writePair(rootDirectory, pair)));
  await mkdir(path.join(rootDirectory, '.github'), { recursive: true });
  await Promise.all([
    writeFile(
      path.join(rootDirectory, 'README.md'),
      `# UXAudit

[Español](#español) | [English](#english)

## Español

[Documentación](docs/es/00_INDEX.md)

## English

[Documentation](docs/00_INDEX.md)
`,
      'utf8',
    ),
    writeFile(
      path.join(rootDirectory, '.github', 'SECURITY.md'),
      `# Security Policy / Política de seguridad

## Español

Consulta la documentación de seguridad para conocer el modelo de amenazas.

## English

Read the [security documentation](../docs/07_SECURITY.md) for the threat model.
`,
      'utf8',
    ),
    writeFile(
      path.join(rootDirectory, '.github', 'pull_request_template.md'),
      `## Cambio / Change

## Motivo / Why

## Comportamiento observable / Observable behavior

[Requirements](../docs/03_REQUIREMENTS.md)

## Riesgos y limitaciones / Risks and limitations
`,
      'utf8',
    ),
  ]);

  return rootDirectory;
};

afterEach(async () => {
  const roots = temporaryRoots.splice(0);

  await Promise.all(roots.map(async (rootDirectory) => rm(rootDirectory, { recursive: true })));
});

describe('bilingual documentation checker', () => {
  it('accepts complete reciprocal pairs, matching structures, and valid relative links', async () => {
    const rootDirectory = await createFixture();
    const result = await executeChecker(rootDirectory);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe(
      'UXAudit bilingual documentation check: PASS (18 pairs, 39 link sources)\n',
    );
  });

  it('executes when invoked through a symlinked repository path', async () => {
    const rootDirectory = await createFixture();
    const linkContainer = await mkdtemp(path.join(tmpdir(), 'uxaudit-bilingual-link-'));
    const linkedRoot = path.join(linkContainer, 'repository');

    temporaryRoots.push(linkContainer);
    await symlink(rootDirectory, linkedRoot, 'junction');

    const result = await executeChecker(linkedRoot);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe(
      'UXAudit bilingual documentation check: PASS (18 pairs, 39 link sources)\n',
    );
  });

  it('reports missing pair members and broken relative links with their source paths', async () => {
    const rootDirectory = await createFixture();
    const missingSpanishPath = path.join(rootDirectory, 'docs', 'es', '15_SOURCE_MAP.md');
    const rootReadmePath = path.join(rootDirectory, 'README.md');
    const rootReadme = await readFile(rootReadmePath, 'utf8');

    await unlink(missingSpanishPath);
    await writeFile(rootReadmePath, `${rootReadme}\n[Missing](missing-document.md)\n`, 'utf8');

    const result = await executeChecker(rootDirectory);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(
      'Missing required Spanish bilingual document: docs/es/15_SOURCE_MAP.md',
    );
    expect(result.stderr).toContain('Broken relative link `missing-document.md` in README.md:');
  });

  it('rejects heading, table, selector, and fenced-block drift', async () => {
    const rootDirectory = await createFixture();
    const spanishPath = path.join(rootDirectory, 'docs', 'es', '01_PROJECT_CONTEXT.md');
    const spanishContent = await readFile(spanishPath, 'utf8');
    const changedContent = spanishContent
      .replace(
        '**Español** | [English](../01_PROJECT_CONTEXT.md)',
        '**Español** | [English](../02_PRODUCT_SPEC.md)',
      )
      .replace('## Detalles', '## Detalles\n\n### Sección adicional')
      .replace('Usa `npm run test`', 'Usa `npm run docs:check`')
      .replace(fencedBlock, ['```bash', 'npm run changed', '```'].join('\n'))
      .concat('\n| Otra | Tabla |\n| ----- | ----- |\n| uno   | dos   |\n');

    await writeFile(spanishPath, changedContent, 'utf8');

    const result = await executeChecker(rootDirectory);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('must contain exactly one reciprocal language selector');
    expect(result.stderr).toContain('Heading count mismatch');
    expect(result.stderr).toContain('Table count mismatch');
    expect(result.stderr).toContain('Inline code-span multiset mismatch');
    expect(result.stderr).toContain('Fenced block 1 is not byte-identical');
  });

  it('discovers new public docs and requires their Spanish counterpart', async () => {
    const rootDirectory = await createFixture();

    await writeFile(
      path.join(rootDirectory, 'docs', 'NEW_PUBLIC.md'),
      '# New document\n\n[Español](es/NEW_PUBLIC.md) | **English**\n',
      'utf8',
    );

    const result = await executeChecker(rootDirectory);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      'Missing required Spanish bilingual document: docs/es/NEW_PUBLIC.md',
    );
  });

  it('requires the explicit language-specific README pair', async () => {
    const rootDirectory = await createFixture();

    await unlink(path.join(rootDirectory, 'README.es.md'));

    const result = await executeChecker(rootDirectory);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Missing required Spanish bilingual document: README.es.md');
  });

  it('rejects monolingual content in every inline bilingual entry document', async () => {
    const rootDirectory = await createFixture();

    await Promise.all([
      writeFile(
        path.join(rootDirectory, 'README.md'),
        '# UXAudit\n\n## English\n\nEnglish documentation for the project.\n',
        'utf8',
      ),
      writeFile(
        path.join(rootDirectory, '.github', 'SECURITY.md'),
        '# Security\n\n## English\n\nEnglish security policy for the project.\n',
        'utf8',
      ),
      writeFile(
        path.join(rootDirectory, '.github', 'pull_request_template.md'),
        '## Change\n\n## Observable behavior\n\n## Risks and limitations\n',
        'utf8',
      ),
    ]);

    const result = await executeChecker(rootDirectory);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      'README.md must contain exactly one visible `Español` language section.',
    );
    expect(result.stderr).toContain(
      '.github/SECURITY.md must contain exactly one visible `Español` language section.',
    );
    expect(result.stderr).toContain(
      '.github/pull_request_template.md is missing visible bilingual marker: Cambio',
    );
  });

  it('does not accept selectors or Markdown anchors hidden in HTML comments', async () => {
    const rootDirectory = await createFixture();
    const englishPath = path.join(rootDirectory, 'docs', '01_PROJECT_CONTEXT.md');
    const englishContent = await readFile(englishPath, 'utf8');
    const rootReadmePath = path.join(rootDirectory, 'README.md');
    const rootReadme = await readFile(rootReadmePath, 'utf8');

    await Promise.all([
      writeFile(
        englishPath,
        englishContent.replace(
          '[Español](es/01_PROJECT_CONTEXT.md) | **English**',
          '<!-- [Español](es/01_PROJECT_CONTEXT.md) | **English** -->',
        ),
        'utf8',
      ),
      writeFile(
        rootReadmePath,
        `${rootReadme}\n[Hidden anchor](#hidden)\n<!-- <a id="hidden"></a> -->\n`,
        'utf8',
      ),
    ]);

    const result = await executeChecker(rootDirectory);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('must contain exactly one reciprocal language selector');
    expect(result.stderr).toContain('Broken Markdown anchor `#hidden` in README.md:');
  });

  it('does not accept selectors rendered as code or escaped literals', async () => {
    const rootDirectory = await createFixture();
    const englishPath = path.join(rootDirectory, 'docs', '01_PROJECT_CONTEXT.md');
    const spanishPath = path.join(rootDirectory, 'docs', 'es', '02_PRODUCT_SPEC.md');
    const indentedPath = path.join(rootDirectory, 'docs', '03_REQUIREMENTS.md');
    const rootReadmePath = path.join(rootDirectory, 'README.md');
    const [englishContent, spanishContent, indentedContent, rootReadme] = await Promise.all([
      readFile(englishPath, 'utf8'),
      readFile(spanishPath, 'utf8'),
      readFile(indentedPath, 'utf8'),
      readFile(rootReadmePath, 'utf8'),
    ]);

    await Promise.all([
      writeFile(
        englishPath,
        englishContent.replace(
          '[Español](es/01_PROJECT_CONTEXT.md) | **English**',
          '`[Español](es/01_PROJECT_CONTEXT.md) | **English**`',
        ),
        'utf8',
      ),
      writeFile(
        spanishPath,
        spanishContent.replace(
          '**Español** | [English](../02_PRODUCT_SPEC.md)',
          '**Español** | \\[English](../02_PRODUCT_SPEC.md)',
        ),
        'utf8',
      ),
      writeFile(
        indentedPath,
        indentedContent.replace(
          '[Español](es/03_REQUIREMENTS.md) | **English**',
          '    [Español](es/03_REQUIREMENTS.md) | **English**',
        ),
        'utf8',
      ),
      writeFile(
        rootReadmePath,
        rootReadme.replace(
          '[Español](#español) | [English](#english)',
          '`[Español](#español) | [English](#english)`',
        ),
        'utf8',
      ),
    ]);

    const result = await executeChecker(rootDirectory);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('README.md must contain exactly one visible bilingual line');
    expect(result.stderr).toContain(
      'docs/01_PROJECT_CONTEXT.md must contain exactly one reciprocal language selector',
    );
    expect(result.stderr).toContain(
      'docs/es/02_PRODUCT_SPEC.md must contain exactly one reciprocal language selector',
    );
    expect(result.stderr).toContain(
      'docs/03_REQUIREMENTS.md must contain exactly one reciprocal language selector',
    );
  });

  it('does not accept HTML anchors rendered as inline code or escaped literals', async () => {
    const rootDirectory = await createFixture();
    const rootReadmePath = path.join(rootDirectory, 'README.md');
    const rootReadme = await readFile(rootReadmePath, 'utf8');

    await writeFile(
      rootReadmePath,
      `${rootReadme}
[Inline anchor](#inline-anchor)
\`<a id="inline-anchor"></a>\`
[Escaped anchor](#escaped-anchor)
\\<a id="escaped-anchor"></a>
[Indented anchor](#indented-anchor)

    <a id="indented-anchor"></a>
`,
      'utf8',
    );

    const result = await executeChecker(rootDirectory);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Broken Markdown anchor `#inline-anchor` in README.md:');
    expect(result.stderr).toContain('Broken Markdown anchor `#escaped-anchor` in README.md:');
    expect(result.stderr).toContain('Broken Markdown anchor `#indented-anchor` in README.md:');
  });

  it('checks repository-root links and ignores escaped link syntax', async () => {
    const rootDirectory = await createFixture();
    const rootReadmePath = path.join(rootDirectory, 'README.md');
    const rootReadme = await readFile(rootReadmePath, 'utf8');

    await writeFile(
      rootReadmePath,
      `${rootReadme}\n\\[Literal](missing-escaped.md)\n[Missing](/missing-root.md)\n`,
      'utf8',
    );

    const result = await executeChecker(rootDirectory);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Broken relative link `/missing-root.md` in README.md:');
    expect(result.stderr).not.toContain('missing-escaped.md');
  });

  it('rejects links whose in-repository symlink resolves outside the repository', async () => {
    const rootDirectory = await createFixture();
    const outsideDirectory = await mkdtemp(path.join(tmpdir(), 'uxaudit-bilingual-outside-'));
    const outsidePath = path.join(outsideDirectory, 'outside.txt');
    const linkedDirectory = path.join(rootDirectory, 'linked');
    const rootReadmePath = path.join(rootDirectory, 'README.md');
    const rootReadme = await readFile(rootReadmePath, 'utf8');

    temporaryRoots.push(outsideDirectory);
    await writeFile(outsidePath, 'outside\n', 'utf8');
    await symlink(outsideDirectory, linkedDirectory, 'junction');
    await writeFile(rootReadmePath, `${rootReadme}\n[Outside](linked/outside.txt)\n`, 'utf8');

    const result = await executeChecker(rootDirectory);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      'Relative link resolves outside the repository through a symbolic link',
    );
  });

  it('compares tilde fences nested in blockquotes', async () => {
    const rootDirectory = await createFixture();
    const pair = requiredPairs[1];

    if (pair === undefined) {
      throw new Error('The bilingual fixture requires at least two document pairs.');
    }

    const englishPath = path.join(rootDirectory, pair.englishPath);
    const spanishPath = path.join(rootDirectory, pair.spanishPath);
    const [englishContent, spanishContent] = await Promise.all([
      readFile(englishPath, 'utf8'),
      readFile(spanishPath, 'utf8'),
    ]);
    const englishFence = ['> ~~~bash', '> npm run test', '> ~~~'].join('\n');
    const spanishFence = ['> ~~~bash', '> npm run changed', '> ~~~'].join('\n');

    await Promise.all([
      writeFile(englishPath, englishContent.replace(fencedBlock, englishFence), 'utf8'),
      writeFile(spanishPath, spanishContent.replace(fencedBlock, spanishFence), 'utf8'),
    ]);

    const result = await executeChecker(rootDirectory);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Fenced block 1 is not byte-identical');
  });

  it('recognizes inline-code delimiters preceded by an even number of backslashes', async () => {
    const rootDirectory = await createFixture();
    const pair = requiredPairs[1];

    if (pair === undefined) {
      throw new Error('The bilingual fixture requires at least two document pairs.');
    }

    const englishPath = path.join(rootDirectory, pair.englishPath);
    const spanishPath = path.join(rootDirectory, pair.spanishPath);
    const [englishContent, spanishContent] = await Promise.all([
      readFile(englishPath, 'utf8'),
      readFile(spanishPath, 'utf8'),
    ]);

    await Promise.all([
      writeFile(englishPath, englishContent + '\nEven slashes: \\\\`alpha`.\n', 'utf8'),
      writeFile(spanishPath, spanishContent + '\nBarras pares: \\\\`beta`.\n', 'utf8'),
    ]);

    const result = await executeChecker(rootDirectory);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Inline code-span multiset mismatch');
    expect(result.stderr).toContain('"alpha"');
    expect(result.stderr).toContain('"beta"');
  });

  it('compares heading hierarchy and table shapes, not only their counts', async () => {
    const rootDirectory = await createFixture();
    const spanishPath = path.join(rootDirectory, 'docs', 'es', '01_PROJECT_CONTEXT.md');
    const spanishContent = await readFile(spanishPath, 'utf8');
    const changedContent = spanishContent
      .replace('## Detalles', '### Detalles')
      .replace('| ----- | ----- |', '| ----- | ----- | ----- |');

    await writeFile(spanishPath, changedContent, 'utf8');

    const result = await executeChecker(rootDirectory);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Heading hierarchy mismatch');
    expect(result.stderr).toContain('Table shape mismatch');
  });
});

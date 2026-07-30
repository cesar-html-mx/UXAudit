import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const expected = {
  authorName: 'cesar-html-mx',
  binPath: 'dist/cli/index.js',
  exports: {
    './schemas/audit-result.schema.json': './schemas/audit-result.schema.json',
    './schemas/finding.schema.json': './schemas/finding.schema.json',
  },
  files: ['dist', 'schemas', 'LICENSE', 'README.md', 'README.en.md', 'README.es.md'],
  license: 'MIT',
  name: '@cesar-html-mx/uxaudit',
  repositoryUrl: 'git+https://github.com/cesar-html-mx/UXAudit.git',
};

const requiredPackFiles = [
  'LICENSE',
  'README.en.md',
  'README.es.md',
  'README.md',
  'dist/cli/index.js',
  'package.json',
  'schemas/audit-result.schema.json',
  'schemas/finding.schema.json',
];

const allowedSchemaFiles = new Set([
  'schemas/audit-result.schema.json',
  'schemas/finding.schema.json',
]);
const allowedRootFiles = new Set([
  'LICENSE',
  'README.en.md',
  'README.es.md',
  'README.md',
  'package.json',
]);

const fail = (message) => {
  throw new Error(`Package validation failed: ${message}`);
};

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

const run = async (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code !== 0) {
        reject(
          new Error(
            `${command} exited with ${String(code)}${signal === null ? '' : ` (${signal})`}.\n${stderr}`,
          ),
        );
        return;
      }

      resolve({ stderr, stdout });
    });
  });

const validateMetadata = (pkg) => {
  if (pkg.name !== expected.name) fail(`expected package name ${expected.name}.`);
  if (pkg.private === true) fail('the package must not be private.');
  if (pkg.license !== expected.license) fail(`expected license ${expected.license}.`);
  if (pkg.author?.name !== expected.authorName) fail('author metadata is incomplete.');
  if (pkg.repository?.url !== expected.repositoryUrl) fail('repository metadata is incomplete.');
  if (pkg.bugs?.url !== 'https://github.com/cesar-html-mx/UXAudit/issues') {
    fail('bug-reporting metadata is incomplete.');
  }
  if (pkg.homepage !== 'https://github.com/cesar-html-mx/UXAudit#readme') {
    fail('homepage metadata is incomplete.');
  }
  if (pkg.bin?.['ux-audit'] !== expected.binPath) fail('the ux-audit binary mapping is invalid.');
  if ('main' in pkg || 'types' in pkg) {
    fail('the CLI-only package must not declare a JavaScript entry point.');
  }
  if (JSON.stringify(pkg.exports) !== JSON.stringify(expected.exports)) {
    fail('the package must export only its public JSON schemas.');
  }
  if (JSON.stringify(pkg.files) !== JSON.stringify(expected.files)) {
    fail('the package files allowlist changed.');
  }
  if (pkg.publishConfig?.access !== 'public' || pkg.publishConfig?.provenance !== true) {
    fail('public provenance-enabled publish configuration is required.');
  }
  if (pkg.scripts?.prepack !== 'npm run build') fail('prepack must build the product.');
  if (pkg.scripts?.prepublishOnly !== 'npm run release:check') {
    fail('prepublishOnly must execute the release gate.');
  }
  if (!Array.isArray(pkg.keywords) || pkg.keywords.length === 0) {
    fail('package keywords are required.');
  }
};

const validatePack = async (packResult, packDirectory) => {
  if (!Array.isArray(packResult) || packResult.length !== 1) {
    fail('npm pack must return exactly one package.');
  }

  const packed = packResult[0];
  if (packed.name !== expected.name) fail('npm pack returned the wrong package name.');
  if (typeof packed.version !== 'string' || packed.version.length === 0) {
    fail('npm pack did not return a package version.');
  }
  if (typeof packed.filename !== 'string' || packed.filename.length === 0) {
    fail('npm pack did not return a tarball filename.');
  }
  if (!Array.isArray(packed.files)) fail('npm pack did not return its file inventory.');

  const packedPaths = packed.files.map((entry) => entry.path);
  for (const requiredPath of requiredPackFiles) {
    if (!packedPaths.includes(requiredPath)) fail(`tarball is missing ${requiredPath}.`);
  }

  const unexpected = packedPaths.filter((filePath) => {
    const [root] = filePath.split('/');
    return root !== 'dist' && !allowedSchemaFiles.has(filePath) && !allowedRootFiles.has(filePath);
  });
  if (unexpected.length > 0) {
    fail(`tarball contains files outside the allowlist: ${unexpected.join(', ')}.`);
  }

  const forbidden = packedPaths.filter((filePath) =>
    ['.agents/', '.github/', 'docs/', 'evidence/', 'fixtures/', 'scripts/', 'src/', 'tests/'].some(
      (prefix) => filePath.startsWith(prefix),
    ),
  );
  if (forbidden.length > 0) {
    fail(`tarball contains internal files: ${forbidden.join(', ')}.`);
  }

  const tarballPath = path.join(packDirectory, packed.filename);
  const tarballStats = await stat(tarballPath);
  if (!tarballStats.isFile() || tarballStats.size === 0) {
    fail('npm pack did not create a non-empty tarball.');
  }

  return { packed, tarballPath };
};

const installAndRun = async ({ npmExecPath, packageVersion, rootDirectory, tarballPath }) => {
  const consumerDirectory = path.join(rootDirectory, 'consumer');
  await writeFile(
    path.join(rootDirectory, 'consumer-package.json'),
    `${JSON.stringify(
      {
        name: 'uxaudit-package-install-check',
        private: true,
        version: '1.0.0',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await mkdir(consumerDirectory);
  await rename(
    path.join(rootDirectory, 'consumer-package.json'),
    path.join(consumerDirectory, 'package.json'),
  );

  await run(
    process.execPath,
    [
      npmExecPath,
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      tarballPath,
    ],
    { cwd: consumerDirectory },
  );

  const installedPackagePath = path.join(
    consumerDirectory,
    'node_modules',
    expected.name,
    'package.json',
  );
  const installedPackage = await readJson(installedPackagePath);
  if (installedPackage.name !== expected.name || installedPackage.version !== packageVersion) {
    fail('the installed tarball identity does not match package.json.');
  }
  if (JSON.stringify(installedPackage.exports) !== JSON.stringify(expected.exports)) {
    fail('the installed package exposes an unexpected import surface.');
  }

  const schemaCheck = await run(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      [
        "import { readFile } from 'node:fs/promises';",
        "const url = import.meta.resolve('@cesar-html-mx/uxaudit/schemas/audit-result.schema.json');",
        "const schema = JSON.parse(await readFile(new URL(url), 'utf8'));",
        "if (schema.title !== 'UXAudit AuditResult 1.0.0') process.exitCode = 1;",
      ].join('\n'),
    ],
    { cwd: consumerDirectory },
  );
  if (schemaCheck.stdout !== '' || schemaCheck.stderr !== '') {
    fail('the installed AuditResult schema check produced unexpected output.');
  }

  const closedImportCheck = await run(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      [
        "try { await import('@cesar-html-mx/uxaudit/dist/cli/index.js'); process.exitCode = 1; }",
        'catch (error) {',
        "  if (error?.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error;",
        '}',
      ].join('\n'),
    ],
    { cwd: consumerDirectory },
  );
  if (closedImportCheck.stdout !== '' || closedImportCheck.stderr !== '') {
    fail('the closed JavaScript import-surface check produced unexpected output.');
  }

  const execution = await run(
    process.execPath,
    [npmExecPath, 'exec', '--offline', '--', 'ux-audit', '--version'],
    { cwd: consumerDirectory },
  );
  if (execution.stdout.trim() !== packageVersion) {
    fail(
      `installed ux-audit returned unexpected version ${JSON.stringify(execution.stdout.trim())}.`,
    );
  }

  const help = await run(
    process.execPath,
    [npmExecPath, 'exec', '--offline', '--', 'ux-audit', '--help'],
    { cwd: consumerDirectory },
  );
  if (!help.stdout.includes('Usage: ux-audit [options] [command]') || help.stderr !== '') {
    fail('installed ux-audit help output is invalid.');
  }

  const projectDirectory = path.join(consumerDirectory, 'project');
  await mkdir(path.join(projectDirectory, 'src'), { recursive: true });
  await writeFile(
    path.join(projectDirectory, 'src', 'App.tsx'),
    [
      'export const App = () => (',
      '  <main>',
      '    <h1>Package installation check</h1>',
      '    <img src="/check.png" />',
      '  </main>',
      ');',
      '',
    ].join('\n'),
    'utf8',
  );
  const scan = await run(
    process.execPath,
    [npmExecPath, 'exec', '--offline', '--', 'ux-audit', 'scan', 'project', '--no-color'],
    { cwd: consumerDirectory },
  );
  for (const expectedOutput of [
    'Project path validated:',
    'Discovery summary:',
    'Parsing summary:',
    `UXAudit ${packageVersion}`,
    'accessibility/img-alt',
  ]) {
    if (!scan.stdout.includes(expectedOutput)) {
      fail(`installed ux-audit scan output is missing ${expectedOutput}.`);
    }
  }
  if (scan.stderr !== '') {
    fail('installed ux-audit scan produced unexpected stderr.');
  }
};

const main = async () => {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath === undefined || npmExecPath.length === 0) {
    fail('run this check through `npm run test:package` so npm_execpath is available.');
  }

  const repositoryRoot = process.cwd();
  const packageJsonPath = path.join(repositoryRoot, 'package.json');
  const pkg = await readJson(packageJsonPath);
  validateMetadata(pkg);

  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'uxaudit-package-check-'));
  const packDirectory = path.join(temporaryRoot, 'pack');

  try {
    await mkdir(packDirectory);
    const packExecution = await run(
      process.execPath,
      [npmExecPath, 'pack', '--json', '--ignore-scripts', '--pack-destination', packDirectory],
      { cwd: repositoryRoot },
    );
    const { packed, tarballPath } = await validatePack(
      JSON.parse(packExecution.stdout),
      packDirectory,
    );
    await installAndRun({
      npmExecPath,
      packageVersion: pkg.version,
      rootDirectory: temporaryRoot,
      tarballPath,
    });

    process.stdout.write(
      `UXAudit package validation: PASS (${String(packed.entryCount)} files, ${String(
        packed.size,
      )} bytes; installed CLI ${pkg.version})\n`,
    );
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
};

await main();

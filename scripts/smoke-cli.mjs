import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const rootDirectory = process.cwd();
const cliPath = path.join(rootDirectory, 'dist', 'cli', 'index.js');
const packagePath = path.join(rootDirectory, 'package.json');

const runCli = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: rootDirectory,
      env: {
        ...process.env,
        NO_COLOR: '1',
      },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    let stdout = '';

    child.stderr.setEncoding('utf8');
    child.stdout.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({
        exitCode,
        stderr,
        stdout,
      });
    });
  });

const assertScenario = (condition, name, result) => {
  if (!condition) {
    throw new Error(
      [
        `CLI smoke scenario failed: ${name}`,
        `Exit code: ${String(result.exitCode)}`,
        `stdout: ${result.stdout}`,
        `stderr: ${result.stderr}`,
      ].join('\n'),
    );
  }
};

const packageMetadata = JSON.parse(await readFile(packagePath, 'utf8'));
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'uxaudit-smoke-'));

try {
  const canonicalProjectDirectory = await mkdtemp(path.join(temporaryDirectory, 'project-'));
  const regularFile = path.join(temporaryDirectory, 'package.json');
  const missingPath = path.join(temporaryDirectory, 'missing');
  await writeFile(regularFile, '{}\n', 'utf8');

  const help = await runCli(['--help']);
  assertScenario(
    help.exitCode === 0 &&
      help.stderr === '' &&
      help.stdout.includes('Usage: ux-audit') &&
      help.stdout.includes('scan <project-path>'),
    'help',
    help,
  );

  const version = await runCli(['--version']);
  assertScenario(
    version.exitCode === 0 &&
      version.stderr === '' &&
      version.stdout.trim() === packageMetadata.version,
    'version',
    version,
  );

  const validDirectory = await runCli(['scan', canonicalProjectDirectory]);
  assertScenario(
    validDirectory.exitCode === 0 &&
      validDirectory.stderr === '' &&
      validDirectory.stdout.startsWith('Project path validated: ') &&
      validDirectory.stdout.includes(
        'Discovery summary: discovered=0 inventory=0 candidates=0 exclusions=0 issues=0',
      ),
    'valid directory',
    validDirectory,
  );

  const missing = await runCli(['scan', missingPath]);
  assertScenario(
    missing.exitCode === 2 &&
      missing.stdout === '' &&
      missing.stderr === 'Project path does not exist.\n',
    'missing path',
    missing,
  );

  const file = await runCli(['scan', regularFile]);
  assertScenario(
    file.exitCode === 2 &&
      file.stdout === '' &&
      file.stderr === 'Project path must reference a directory.\n',
    'regular file',
    file,
  );

  const missingArgument = await runCli(['scan']);
  assertScenario(
    missingArgument.exitCode === 2 &&
      missingArgument.stdout === '' &&
      missingArgument.stderr.includes("missing required argument 'project-path'"),
    'missing argument',
    missingArgument,
  );

  console.log('UXAudit CLI smoke tests: PASS (6 scenarios)');
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}

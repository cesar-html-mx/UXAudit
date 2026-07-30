import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  const completeProjectDirectory = await mkdtemp(
    path.join(temporaryDirectory, 'complete-project-'),
  );
  const sourceDirectory = path.join(completeProjectDirectory, 'src');
  const regularFile = path.join(temporaryDirectory, 'package.json');
  const missingPath = path.join(temporaryDirectory, 'missing');
  const invalidConfiguration = path.join(temporaryDirectory, 'invalid-config.json');
  const emptyRuleConfiguration = path.join(temporaryDirectory, 'empty-rules.json');

  await mkdir(sourceDirectory, { recursive: true });
  await Promise.all([
    writeFile(regularFile, '{}\n', 'utf8'),
    writeFile(invalidConfiguration, '{}\n', 'utf8'),
    writeFile(
      emptyRuleConfiguration,
      `${JSON.stringify({
        color: true,
        formats: ['json'],
        ruleIds: [],
        schemaVersion: 1,
      })}\n`,
      'utf8',
    ),
    writeFile(
      path.join(sourceDirectory, 'App.tsx'),
      [
        'export const App = () => (',
        '  <main>',
        '    <img src="hero.png" />',
        '    <input />',
        '    <button />',
        '    <a href="/details">Read more</a>',
        '    <h1>Primary heading</h1>',
        '    <h1>Duplicate heading</h1>',
        '    <span style={{ fontSize: 10 }}>Small details</span>',
        '  </main>',
        ');',
        '',
      ].join('\n'),
      'utf8',
    ),
    writeFile(
      path.join(sourceDirectory, 'Broken.tsx'),
      'export const Broken = () => <section><span>Missing</section>;\n',
      'utf8',
    ),
  ]);

  const help = await runCli(['--help']);
  assertScenario(
    help.exitCode === 0 &&
      help.stderr === '' &&
      help.stdout.includes('Usage: ux-audit') &&
      help.stdout.includes('scan [options] <project-path>'),
    'help',
    help,
  );

  const hostileCommand = await runCli(['unknown\u001b[31m\u0007\nforged-line']);
  assertScenario(
    hostileCommand.exitCode === 2 &&
      hostileCommand.stdout === '' &&
      hostileCommand.stderr.includes(
        "unknown command 'unknown\\u001b[31m\\u0007\\u000aforged-line'",
      ) &&
      !hostileCommand.stderr.includes('\u001b') &&
      !hostileCommand.stderr.includes('\u0007') &&
      !hostileCommand.stderr.includes('\nforged-line'),
    'hostile command output',
    hostileCommand,
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
      ) &&
      validDirectory.stdout.includes('Parsing summary: parsed=0 failed=0 components=0 jsx=0') &&
      validDirectory.stdout.includes(
        'Rules: available=8 enabled=8 executed=8 succeeded=8 failed=0',
      ),
    'valid directory',
    validDirectory,
  );

  const completeAudit = await runCli([
    'scan',
    completeProjectDirectory,
    '--format',
    'all',
    '--output',
    'reports',
    '--no-color',
    '--verbose',
  ]);
  const jsonReportPath = path.join(completeProjectDirectory, 'reports', 'audit-report.json');
  const htmlReportPath = path.join(completeProjectDirectory, 'reports', 'audit-report.html');
  const [jsonReport, htmlReport] = await Promise.all([
    readFile(jsonReportPath, 'utf8'),
    readFile(htmlReportPath, 'utf8'),
  ]);
  const parsedReport = JSON.parse(jsonReport);

  assertScenario(
    completeAudit.exitCode === 0 &&
      completeAudit.stderr === '' &&
      completeAudit.stdout.includes('Parsing summary: parsed=1 failed=1 components=1 jsx=8') &&
      completeAudit.stdout.includes('Findings (8 displayed / 8 total)') &&
      completeAudit.stdout.includes('Processing errors (1)') &&
      completeAudit.stdout.includes('Report generated: json=reports/audit-report.json') &&
      completeAudit.stdout.includes('Report generated: html=reports/audit-report.html') &&
      !completeAudit.stdout.includes('\u001b') &&
      parsedReport.summary.findings.total === 8 &&
      parsedReport.summary.errors.total === 1 &&
      htmlReport.includes('Findings <code>8</code>') &&
      htmlReport.includes('Recoverable processing errors <code>1</code>'),
    'complete all-format audit',
    completeAudit,
  );

  const existingReports = await runCli([
    'scan',
    completeProjectDirectory,
    '--format',
    'all',
    '--output',
    'reports',
    '--no-color',
  ]);
  assertScenario(
    existingReports.exitCode === 3 &&
      existingReports.stdout === '' &&
      existingReports.stderr === 'The report target already exists and was not overwritten.\n' &&
      (await readFile(jsonReportPath, 'utf8')) === jsonReport &&
      (await readFile(htmlReportPath, 'utf8')) === htmlReport,
    'existing report targets',
    existingReports,
  );

  const emptyRulesWithCliPrecedence = await runCli([
    'scan',
    completeProjectDirectory,
    '--config',
    emptyRuleConfiguration,
    '--format',
    'terminal',
    '--no-color',
  ]);
  assertScenario(
    emptyRulesWithCliPrecedence.exitCode === 0 &&
      emptyRulesWithCliPrecedence.stderr === '' &&
      emptyRulesWithCliPrecedence.stdout.includes(
        'Rules: available=8 enabled=0 executed=0 succeeded=0 failed=0',
      ) &&
      emptyRulesWithCliPrecedence.stdout.includes('Findings (0 displayed / 0 total)') &&
      !emptyRulesWithCliPrecedence.stdout.includes('Report generated:'),
    'empty rule filter and CLI format precedence',
    emptyRulesWithCliPrecedence,
  );

  const invalidConfig = await runCli([
    'scan',
    completeProjectDirectory,
    '--config',
    invalidConfiguration,
  ]);
  assertScenario(
    invalidConfig.exitCode === 2 &&
      invalidConfig.stdout === '' &&
      invalidConfig.stderr === 'Configuration contains unknown or invalid values.\n',
    'invalid configuration',
    invalidConfig,
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

  console.log('UXAudit CLI smoke tests: PASS (11 scenarios)');
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}

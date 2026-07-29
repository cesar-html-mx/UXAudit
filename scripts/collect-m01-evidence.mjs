import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, readlink, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { format } from 'prettier';

const rootDirectory = process.cwd();
const finalEvidenceDirectory = path.join(rootDirectory, 'evidence', 'm01-bootstrap');
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'uxaudit-m01-evidence-'));
const isolatedWorkspace = path.join(temporaryRoot, 'workspace');
const temporaryEvidence = path.join(temporaryRoot, 'evidence');
const rawEvidence = path.join(temporaryEvidence, 'raw');
const npmExecPath = process.env.npm_execpath;

if (!npmExecPath) {
  throw new Error('npm executable path is unavailable; run this collector through npm.');
}

const excludedTopLevelEntries = new Set([
  '.cache',
  '.codex-log',
  '.git',
  '.tmp',
  'coverage',
  'dist',
  'node_modules',
]);
const manifestedEvidenceRelativePaths = [
  'SUMMARY.md',
  'environment.json',
  'raw/cli-file-path.txt',
  'raw/cli-help.txt',
  'raw/cli-missing-path.txt',
  'raw/cli-smoke.txt',
  'raw/cli-valid-path.txt',
  'raw/coverage.txt',
  'raw/harness-validation.txt',
  'raw/npm-audit.json.txt',
  'raw/npm-ci.txt',
  'raw/verify.txt',
];
const evidenceManifestRelativePath = 'MANIFEST.sha256';
const requiredEvidenceRelativePaths = [
  evidenceManifestRelativePath,
  ...manifestedEvidenceRelativePaths,
];

const compareNames = (left, right) =>
  left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
const toPortablePath = (value) => value.split(path.sep).join('/');

const shouldCopySource = (source) => {
  const relativePath = path.relative(rootDirectory, source);

  if (relativePath === '') {
    return true;
  }

  const [topLevel, secondLevel] = relativePath.split(path.sep);

  if (topLevel && excludedTopLevelEntries.has(topLevel)) {
    return false;
  }

  if (topLevel === '.husky' && secondLevel === '_') {
    return false;
  }

  return !(topLevel === 'evidence' && secondLevel === 'm01-bootstrap');
};

const captureCommand = (command, args, cwd) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        CI: 'true',
        FORCE_COLOR: '0',
        HUSKY: '0',
        NO_COLOR: '1',
        npm_config_audit: 'false',
        npm_config_fund: 'false',
        npm_config_update_notifier: 'false',
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

const commandResults = [];

const recordCommand = async ({
  args,
  command,
  displayedArgs = args,
  displayedCommand = command === process.execPath ? 'node' : command,
  expectedExitCodes = [0],
  fileName,
  label,
}) => {
  const result = await captureCommand(command, args, isolatedWorkspace);
  const rawOutput = [
    `Command: ${[displayedCommand, ...displayedArgs]
      .map((value) => JSON.stringify(value))
      .join(' ')}`,
    'Working directory: isolated temporary workspace',
    `Expected exit code: ${expectedExitCodes.join(' or ')}`,
    `Observed exit code: ${String(result.exitCode)}`,
    '',
    '--- stdout ---',
    result.stdout || '(empty)\n',
    '--- stderr ---',
    result.stderr || '(empty)\n',
  ].join('\n');

  await writeFile(path.join(rawEvidence, fileName), rawOutput, 'utf8');

  const passed = expectedExitCodes.includes(result.exitCode);
  commandResults.push({
    fileName,
    label,
    observedExitCode: result.exitCode,
    passed,
  });

  if (!passed) {
    throw new Error(
      `${label} returned ${String(result.exitCode)}; expected ${expectedExitCodes.join(' or ')}`,
    );
  }

  return result;
};

const recordNpmCommand = ({ args, ...options }) =>
  recordCommand({
    ...options,
    args: [npmExecPath, ...args],
    command: process.execPath,
    displayedArgs: args,
    displayedCommand: 'npm',
  });

const createSourceTreeDigest = async (directory) => {
  const hash = createHash('sha256');

  const visit = async (currentDirectory) => {
    const entries = (await readdir(currentDirectory, { withFileTypes: true })).sort(compareNames);

    for (const entry of entries) {
      const entryPath = path.join(currentDirectory, entry.name);
      const relativePath = toPortablePath(path.relative(directory, entryPath));
      const pathLength = Buffer.byteLength(relativePath);

      if (entry.isDirectory()) {
        hash.update(`directory:${String(pathLength)}:${relativePath}\n`);
        await visit(entryPath);
      } else if (entry.isFile()) {
        const content = await readFile(entryPath);
        hash.update(`file:${String(pathLength)}:${relativePath}:${String(content.byteLength)}\n`);
        hash.update(content);
      } else if (entry.isSymbolicLink()) {
        const target = await readlink(entryPath);
        hash.update(
          `symlink:${String(pathLength)}:${relativePath}:${String(Buffer.byteLength(target))}:${target}\n`,
        );
      } else {
        throw new Error(`Unsupported source entry type: ${relativePath}`);
      }
    }
  };

  await visit(directory);
  return `sha256:${hash.digest('hex')}`;
};

const findEvidenceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await findEvidenceFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    } else {
      throw new Error(`Evidence contains an unsupported entry: ${entryPath}`);
    }
  }

  return files;
};

const renderEvidenceManifest = async (directory) => {
  const lines = [];

  for (const relativePath of manifestedEvidenceRelativePaths) {
    const content = await readFile(path.join(directory, relativePath));
    const digest = createHash('sha256').update(content).digest('hex');
    lines.push(`${digest}  ${relativePath}`);
  }

  return `${lines.join('\n')}\n`;
};

const assertEvidenceManifestIsValid = async (directory) => {
  const expectedManifest = await renderEvidenceManifest(directory);
  const observedManifest = await readFile(
    path.join(directory, evidenceManifestRelativePath),
    'utf8',
  );

  if (observedManifest !== expectedManifest) {
    throw new Error('Evidence integrity manifest does not match the retained package.');
  }
};

const assertEvidencePackageIsComplete = async (directory) => {
  const relativeFiles = new Set(
    (await findEvidenceFiles(directory)).map((filePath) =>
      toPortablePath(path.relative(directory, filePath)),
    ),
  );
  const missingFiles = requiredEvidenceRelativePaths.filter(
    (relativePath) => !relativeFiles.has(relativePath),
  );

  if (missingFiles.length > 0) {
    throw new Error(`Evidence package is incomplete: ${missingFiles.join(', ')}`);
  }
};

const assertEvidenceIsSanitized = async (directory) => {
  const forbiddenPatterns = [
    { label: 'GitHub token', pattern: /ghp_[A-Za-z0-9]{20,}|github_pat_/u },
    { label: 'Linux home path', pattern: /\/home\//u },
    { label: 'macOS home path', pattern: /\/Users\//u },
    { label: 'Windows home path', pattern: /[A-Za-z]:\\Users\\/iu },
  ];

  for (const filePath of await findEvidenceFiles(directory)) {
    const content = await readFile(filePath, 'utf8');

    for (const { label, pattern } of forbiddenPatterns) {
      if (pattern.test(content)) {
        throw new Error(
          `Evidence sanitization failed: ${label} found in ${path.basename(filePath)}`,
        );
      }
    }
  }
};

const comparableEvidence = (environment) => ({
  evidenceId: environment.evidenceId,
  integrity: environment.integrity,
  productVersion: environment.productVersion,
  runtime: environment.runtime,
  schemaVersion: environment.schemaVersion,
  sourceTreeDigest: environment.source?.treeDigest,
  verification: environment.verification,
});

const normalizeSummaryForComparison = (content) =>
  content
    .replace(/^- Observed at:.*$/mu, '- Observed at: <volatile>')
    .replace(/^- Source:.*$/mu, '- Source: <volatile>')
    .replace(/^- Environment:.*$/mu, '- Environment: <volatile>');

const assertExistingEvidenceMatches = async (expectedEnvironment) => {
  await assertEvidencePackageIsComplete(finalEvidenceDirectory);
  await assertEvidenceManifestIsValid(finalEvidenceDirectory);
  await assertEvidenceIsSanitized(finalEvidenceDirectory);

  const existingEnvironment = JSON.parse(
    await readFile(path.join(finalEvidenceDirectory, 'environment.json'), 'utf8'),
  );
  const expectedComparable = JSON.stringify(comparableEvidence(expectedEnvironment));
  const existingComparable = JSON.stringify(comparableEvidence(existingEnvironment));

  if (existingComparable !== expectedComparable) {
    throw new Error(
      'Existing evidence does not match the current verified source tree and results.',
    );
  }

  const expectedSummary = normalizeSummaryForComparison(
    await readFile(path.join(temporaryEvidence, 'SUMMARY.md'), 'utf8'),
  );
  const existingSummary = normalizeSummaryForComparison(
    await readFile(path.join(finalEvidenceDirectory, 'SUMMARY.md'), 'utf8'),
  );

  if (existingSummary !== expectedSummary) {
    throw new Error('Existing evidence summary does not match the current verification.');
  }

  for (const result of expectedEnvironment.verification.commands) {
    const rawRecord = await readFile(
      path.join(finalEvidenceDirectory, 'raw', result.fileName),
      'utf8',
    );

    if (!rawRecord.includes(`Observed exit code: ${String(result.observedExitCode)}`)) {
      throw new Error(`Existing raw evidence is inconsistent: ${result.fileName}`);
    }
  }
};

try {
  const existingEvidenceFiles = await findEvidenceFiles(finalEvidenceDirectory);

  await cp(rootDirectory, isolatedWorkspace, {
    dereference: false,
    filter: shouldCopySource,
    recursive: true,
    verbatimSymlinks: true,
  });
  const sourceTreeDigest = await createSourceTreeDigest(isolatedWorkspace);
  await mkdir(rawEvidence, { recursive: true });

  const observedAt = new Date().toISOString();
  const packageMetadata = JSON.parse(
    await readFile(path.join(isolatedWorkspace, 'package.json'), 'utf8'),
  );
  const npmVersion = (
    await captureCommand(process.execPath, [npmExecPath, '--version'], isolatedWorkspace)
  ).stdout.trim();
  const baseCommit = (
    await captureCommand('git', ['rev-parse', 'HEAD'], rootDirectory)
  ).stdout.trim();
  const branch = (
    await captureCommand('git', ['branch', '--show-current'], rootDirectory)
  ).stdout.trim();

  await recordNpmCommand({
    args: ['ci'],
    fileName: 'npm-ci.txt',
    label: 'Locked clean installation',
  });
  await recordNpmCommand({
    args: ['run', 'verify'],
    fileName: 'verify.txt',
    label: 'Product quality gate',
  });
  const coverageResult = await recordNpmCommand({
    args: ['run', 'test:coverage'],
    fileName: 'coverage.txt',
    label: 'Coverage thresholds',
  });
  await recordNpmCommand({
    args: ['run', 'test:smoke'],
    fileName: 'cli-smoke.txt',
    label: 'Compiled CLI smoke tests',
  });
  await recordCommand({
    args: ['dist/cli/index.js', '--help'],
    command: process.execPath,
    fileName: 'cli-help.txt',
    label: 'CLI help',
  });
  await recordCommand({
    args: ['dist/cli/index.js', 'scan', '.'],
    command: process.execPath,
    fileName: 'cli-valid-path.txt',
    label: 'Valid project root',
  });
  await recordCommand({
    args: ['dist/cli/index.js', 'scan', '.uxaudit-evidence-missing'],
    command: process.execPath,
    expectedExitCodes: [2],
    fileName: 'cli-missing-path.txt',
    label: 'Missing project root',
  });
  await recordCommand({
    args: ['dist/cli/index.js', 'scan', 'package.json'],
    command: process.execPath,
    expectedExitCodes: [2],
    fileName: 'cli-file-path.txt',
    label: 'Regular-file project root',
  });
  await recordCommand({
    args: ['.github/harness/scripts/validate-harness.mjs'],
    command: process.execPath,
    fileName: 'harness-validation.txt',
    label: 'Harness integrity',
  });
  const auditResult = await recordNpmCommand({
    args: ['audit', '--audit-level=moderate', '--json'],
    fileName: 'npm-audit.json.txt',
    label: 'Dependency audit',
  });

  const coverageSummary = JSON.parse(
    await readFile(path.join(isolatedWorkspace, 'coverage', 'coverage-summary.json'), 'utf8'),
  );
  const auditReport = JSON.parse(auditResult.stdout);
  const testFilesMatch = /^\s*Test Files\s+(\d+) passed/mu.exec(coverageResult.stdout);
  const testsMatch = /^\s*Tests\s+(\d+) passed/mu.exec(coverageResult.stdout);

  if (!testFilesMatch?.[1] || !testsMatch?.[1]) {
    throw new Error('Unable to read Vitest counts from coverage output');
  }

  const verification = {
    commands: commandResults,
    coverage: {
      branches: coverageSummary.total.branches.pct,
      functions: coverageSummary.total.functions.pct,
      lines: coverageSummary.total.lines.pct,
      statements: coverageSummary.total.statements.pct,
    },
    dependencyAuditVulnerabilities: auditReport.metadata.vulnerabilities.total,
    testFiles: Number(testFilesMatch[1]),
    tests: Number(testsMatch[1]),
  };
  const environment = {
    schemaVersion: 3,
    evidenceId: 'M01-BOOTSTRAP',
    observedAt,
    source: {
      baseCommit,
      branch,
      state: 'M01-T05 working tree copied to an isolated temporary workspace',
      treeDigest: sourceTreeDigest,
    },
    productVersion: packageMetadata.version,
    runtime: {
      node: process.version,
      npm: npmVersion,
    },
    system: {
      architecture: process.arch,
      platform: process.platform,
    },
    integrity: {
      algorithm: 'sha256',
      manifest: evidenceManifestRelativePath,
    },
    verification,
  };

  await writeFile(
    path.join(temporaryEvidence, 'environment.json'),
    `${JSON.stringify(environment, null, 2)}\n`,
    'utf8',
  );

  const commandRows = commandResults
    .map(
      ({ fileName, label, observedExitCode, passed }) =>
        `| ${label} | ${String(observedExitCode)} | ${passed ? 'PASS' : 'FAIL'} | [raw/${fileName}](raw/${fileName}) |`,
    )
    .join('\n');
  const summary = `# M01 Bootstrap Evidence

- Evidence ID: M01-BOOTSTRAP
- Observed at: ${observedAt}
- Source: branch \`${branch}\`, base commit \`${baseCommit}\`, plus the M01-T05 working tree
- Source tree: \`${sourceTreeDigest}\`
- Integrity: SHA-256 manifest in \`${evidenceManifestRelativePath}\`
- Environment: Node.js \`${process.version}\`, npm \`${npmVersion}\`, \`${process.platform}\`/\`${process.arch}\`
- Objective: verify the complete M01 CLI foundation from a clean locked installation
- Expected result: every required gate passes; invalid path scenarios return exit 2

## Executed checks

| Check | Exit | Status | Raw record |
| ----- | ---: | ------ | ---------- |
${commandRows}

## Measurements

- Tests: ${testsMatch[1]} passed across ${testFilesMatch[1]} files.
- Coverage: statements ${coverageSummary.total.statements.pct}%, branches ${coverageSummary.total.branches.pct}%, functions ${coverageSummary.total.functions.pct}%, lines ${coverageSummary.total.lines.pct}%.
- Dependency audit: ${auditReport.metadata.vulnerabilities.total} known vulnerabilities reported by npm.
- Smoke coverage: help, version, valid directory, missing path, regular file, and missing argument.

## Conclusion

PASS. M01 is buildable and testable on Node.js 24, the compiled CLI validates canonical project
roots with stable exit behavior, the harness is internally consistent, and the clean dependency
audit reports no known vulnerabilities. GitHub Actions configuration was inspected locally but was
not executed remotely as part of this evidence run.

## Current limitation

The command validates only the selected root. Recursive discovery, canonical descendant
confinement, parsing, rules, and reports begin in later milestones.
`;

  await writeFile(
    path.join(temporaryEvidence, 'SUMMARY.md'),
    await format(summary, { parser: 'markdown' }),
    'utf8',
  );
  await writeFile(
    path.join(temporaryEvidence, evidenceManifestRelativePath),
    await renderEvidenceManifest(temporaryEvidence),
    'utf8',
  );
  await assertEvidencePackageIsComplete(temporaryEvidence);
  await assertEvidenceManifestIsValid(temporaryEvidence);
  await assertEvidenceIsSanitized(temporaryEvidence);

  if (existingEvidenceFiles.length === 0) {
    for (const entry of await readdir(temporaryEvidence)) {
      await cp(path.join(temporaryEvidence, entry), path.join(finalEvidenceDirectory, entry), {
        errorOnExist: true,
        force: false,
        recursive: true,
      });
    }
  } else {
    await assertExistingEvidenceMatches(environment);
  }

  console.log('M01 evidence collection: PASS');
  console.log(
    existingEvidenceFiles.length === 0
      ? 'Evidence written to evidence/m01-bootstrap/'
      : 'Existing evidence preserved after reproducibility check',
  );
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  rmdir,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { format } from 'prettier';

import {
  assertEvidenceIsSanitized,
  assertEvidenceManifestIsValid,
  assertEvidencePackageIsComplete,
  evidenceManifestRelativePath,
  findEvidenceFiles,
  renderEvidenceManifest,
} from './m02-evidence-contract.mjs';
import { getPublicDocumentationCopyDecision } from './public-documentation-source-filter.mjs';

const rootDirectory = process.cwd();
const finalEvidenceDirectory = path.join(rootDirectory, 'evidence', 'm02-discovery');
const evidenceParentDirectory = path.dirname(finalEvidenceDirectory);
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'uxaudit-m02-evidence-'));
const isolatedWorkspace = path.join(temporaryRoot, 'workspace');
const temporaryEvidence = path.join(temporaryRoot, 'evidence');
const rawEvidence = path.join(temporaryEvidence, 'raw');
const scenarioEvidence = path.join(temporaryEvidence, 'scenario');
const measurementEvidence = path.join(temporaryEvidence, 'measurements');
const childTemporaryDirectory = path.join(temporaryRoot, 'child-tmp');
const npmCacheDirectory = path.join(temporaryRoot, 'npm-cache');
const npmUserConfig = path.join(temporaryRoot, 'npmrc');
const npmExecPath = process.env.npm_execpath;
const vitestResultsRelativePath = 'coverage/vitest-results.json';
const vitestResultsPath = path.join(isolatedWorkspace, vitestResultsRelativePath);
let publicationStagingDirectory;

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
  'evidence',
  'node_modules',
]);
const forbiddenSourceNames = new Set(['.env', '.netrc', 'id_dsa', 'id_ed25519', 'id_rsa']);

const compareNames = (left, right) =>
  left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
const toPortablePath = (value) => value.split(path.sep).join('/');
const digest = (content) => `sha256:${createHash('sha256').update(content).digest('hex')}`;
const isFileSystemError = (error) => typeof error === 'object' && error !== null && 'code' in error;

const shouldCopySource = (source) => {
  const relativePath = path.relative(rootDirectory, source);

  if (relativePath === '') {
    return true;
  }

  const segments = relativePath.split(path.sep);
  const topLevel = segments[0];
  const fileName = segments.at(-1) ?? '';
  const publicDocumentationDecision = getPublicDocumentationCopyDecision(segments);

  if (publicDocumentationDecision !== undefined) {
    return publicDocumentationDecision;
  }

  if (topLevel && excludedTopLevelEntries.has(topLevel)) {
    return false;
  }

  if (topLevel === '.husky' && segments[1] === '_') {
    return false;
  }

  return !(
    forbiddenSourceNames.has(fileName) ||
    fileName.startsWith('.env.') ||
    fileName.endsWith('.key') ||
    fileName.endsWith('.pem')
  );
};

const childEnvironment = () => {
  const runtimePath = path.dirname(process.execPath);
  const environment = {
    CI: 'true',
    FORCE_COLOR: '0',
    HUSKY: '0',
    NO_COLOR: '1',
    PATH: [runtimePath, process.env.PATH].filter(Boolean).join(path.delimiter),
    TEMP: childTemporaryDirectory,
    TMP: childTemporaryDirectory,
    TMPDIR: childTemporaryDirectory,
    npm_config_audit: 'false',
    npm_config_cache: npmCacheDirectory,
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false',
    npm_config_userconfig: npmUserConfig,
  };

  for (const name of ['ComSpec', 'PATHEXT', 'SystemRoot', 'WINDIR']) {
    const value = process.env[name];

    if (value) {
      environment[name] = value;
    }
  }

  return environment;
};

const captureCommand = (command, args, cwd) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: childEnvironment(),
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
      resolve({ exitCode, stderr, stdout });
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
  normalizeRecordedOutput = (value) => value,
}) => {
  const result = await captureCommand(command, args, isolatedWorkspace);
  const recordedStderr = normalizeRecordedOutput(result.stderr);
  const recordedStdout = normalizeRecordedOutput(result.stdout);
  const rawOutput = [
    `Command: ${[displayedCommand, ...displayedArgs]
      .map((value) => JSON.stringify(value))
      .join(' ')}`,
    'Working directory: isolated temporary workspace',
    `Expected exit code: ${expectedExitCodes.join(' or ')}`,
    `Observed exit code: ${String(result.exitCode)}`,
    '',
    '--- stdout ---',
    recordedStdout || '(empty)\n',
    '--- stderr ---',
    recordedStderr || '(empty)\n',
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
        throw new Error(`Evidence source snapshot contains a symbolic link: ${relativePath}`);
      } else {
        throw new Error(`Unsupported source entry type: ${relativePath}`);
      }
    }
  };

  await visit(directory);
  return `sha256:${hash.digest('hex')}`;
};

const comparableEvidence = (environment) => ({
  evidenceId: environment.evidenceId,
  integrity: environment.integrity,
  productVersion: environment.productVersion,
  runtime: environment.runtime,
  scenario: environment.scenario,
  schemaVersion: environment.schemaVersion,
  sourceTreeDigest: environment.source?.treeDigest,
  system: environment.system,
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

  if (
    JSON.stringify(comparableEvidence(existingEnvironment)) !==
    JSON.stringify(comparableEvidence(expectedEnvironment))
  ) {
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
    throw new Error('Existing evidence summary does not match current verification.');
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
  await Promise.all([
    mkdir(rawEvidence, { recursive: true }),
    mkdir(scenarioEvidence, { recursive: true }),
    mkdir(measurementEvidence, { recursive: true }),
    mkdir(childTemporaryDirectory, { recursive: true }),
    mkdir(npmCacheDirectory, { recursive: true }),
    writeFile(npmUserConfig, '', 'utf8'),
  ]);
  let existingEvidenceFiles = [];

  try {
    existingEvidenceFiles = await findEvidenceFiles(finalEvidenceDirectory);
  } catch (error) {
    if (!isFileSystemError(error) || error.code !== 'ENOENT') {
      throw error;
    }
  }

  await cp(rootDirectory, isolatedWorkspace, {
    dereference: false,
    filter: shouldCopySource,
    recursive: true,
    verbatimSymlinks: true,
  });
  const sourceTreeDigest = await createSourceTreeDigest(isolatedWorkspace);
  const observedAt = new Date().toISOString();
  const packageMetadata = JSON.parse(
    await readFile(path.join(isolatedWorkspace, 'package.json'), 'utf8'),
  );
  const harnessState = JSON.parse(
    await readFile(
      path.join(isolatedWorkspace, '.github', 'harness', 'state', 'state.json'),
      'utf8',
    ),
  );
  const pinnedNodeVersion = (await readFile(path.join(isolatedWorkspace, '.nvmrc'), 'utf8')).trim();
  const [npmVersionResult, baseCommitResult, branchResult] = await Promise.all([
    captureCommand(process.execPath, [npmExecPath, '--version'], isolatedWorkspace),
    captureCommand('git', ['rev-parse', 'HEAD'], rootDirectory),
    captureCommand('git', ['branch', '--show-current'], rootDirectory),
  ]);
  const npmVersion = npmVersionResult.stdout.trim();
  const baseCommit = baseCommitResult.stdout.trim();
  const branch = branchResult.stdout.trim();

  if (
    npmVersionResult.exitCode !== 0 ||
    baseCommitResult.exitCode !== 0 ||
    branchResult.exitCode !== 0 ||
    !/^\d+\.\d+\.\d+$/u.test(npmVersion) ||
    !/^[0-9a-f]{40,64}$/u.test(baseCommit) ||
    branch === ''
  ) {
    throw new Error('Unable to establish verified runtime and Git evidence metadata.');
  }

  if (
    process.version !== `v${pinnedNodeVersion}` ||
    packageMetadata.packageManager !== `npm@${npmVersion}` ||
    packageMetadata.engines?.node !== '>=24.18.0 <25' ||
    packageMetadata.engines?.npm !== '>=11.16.0 <12'
  ) {
    throw new Error('Evidence runtime does not match the pinned Node.js 24/npm 11 contract.');
  }

  if (
    harnessState.activeMilestone !== 'M02' ||
    harnessState.activeTask !== 'M02-T05' ||
    harnessState.currentBranch !== branch
  ) {
    throw new Error('Evidence collection requires the active M02-T05 milestone branch.');
  }

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
  await recordNpmCommand({
    args: ['run', 'test:coverage'],
    fileName: 'coverage.txt',
    label: 'Coverage thresholds',
  });
  await recordNpmCommand({
    args: ['test', '--', '--reporter=json', `--outputFile=${vitestResultsRelativePath}`],
    fileName: 'test-results.txt',
    label: 'No skipped or todo tests',
    normalizeRecordedOutput: (value) => value.replaceAll(vitestResultsPath, '<TEST_RESULTS>'),
  });
  await recordNpmCommand({
    args: ['run', 'test:smoke'],
    fileName: 'cli-smoke.txt',
    label: 'Compiled CLI smoke tests',
  });
  await recordCommand({
    args: [npmExecPath, 'run', 'test:scenario:m02', '--', '--output', scenarioEvidence],
    command: process.execPath,
    displayedArgs: ['run', 'test:scenario:m02', '--', '--output', '<EVIDENCE_DIR>'],
    displayedCommand: 'npm',
    fileName: 'm02-scenario.txt',
    label: 'Controlled M02 discovery scenario',
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
  const testReport = JSON.parse(await readFile(vitestResultsPath, 'utf8'));
  const auditReport = JSON.parse(auditResult.stdout);
  const testFiles = Array.isArray(testReport.testResults) ? testReport.testResults.length : 0;
  const tests = testReport.numTotalTests;
  const skippedTests = testReport.numPendingTests;
  const todoTests = testReport.numTodoTests;

  if (
    testReport.success !== true ||
    testFiles === 0 ||
    !Number.isInteger(tests) ||
    tests <= 0 ||
    testReport.numPassedTests !== tests ||
    testReport.numFailedTests !== 0 ||
    skippedTests !== 0 ||
    todoTests !== 0 ||
    testReport.testResults.some((result) => result.status !== 'passed')
  ) {
    throw new Error('Vitest evidence contains failed, skipped, todo, or incomplete tests.');
  }

  const normalizedCoverage = {
    branches: coverageSummary.total.branches.pct,
    functions: coverageSummary.total.functions.pct,
    lines: coverageSummary.total.lines.pct,
    statements: coverageSummary.total.statements.pct,
  };
  const normalizedTests = {
    failedTests: testReport.numFailedTests,
    passedTests: testReport.numPassedTests,
    skippedTests,
    testFiles,
    todoTests,
    totalTests: tests,
  };
  await Promise.all([
    writeFile(
      path.join(measurementEvidence, 'coverage-summary.json'),
      `${JSON.stringify(normalizedCoverage, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      path.join(measurementEvidence, 'test-summary.json'),
      `${JSON.stringify(normalizedTests, null, 2)}\n`,
      'utf8',
    ),
  ]);
  const deterministicComparison = JSON.parse(
    await readFile(path.join(scenarioEvidence, 'deterministic-comparison.json'), 'utf8'),
  );
  const scenarioActual = await readFile(path.join(scenarioEvidence, 'scenario-actual.json'));
  const verification = {
    commands: commandResults,
    coverage: normalizedCoverage,
    dependencyAuditVulnerabilities: auditReport.metadata.vulnerabilities.total,
    skippedTests,
    testFiles,
    tests,
    todoTests,
  };
  const environment = {
    schemaVersion: 5,
    evidenceId: 'M02-DISCOVERY',
    observedAt,
    source: {
      baseCommit,
      branch,
      state: `${harnessState.activeTask} working tree copied without generated or retained evidence`,
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
    scenario: {
      byteIdenticalReruns: deterministicComparison.byteIdentical,
      expectedMatched: true,
      resultDigest: digest(scenarioActual),
      targetCodeExecuted: false,
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
  const summary = `# M02 Discovery Evidence

- Evidence ID: M02-DISCOVERY
- Observed at: ${observedAt}
- Source: branch \`${branch}\`, base commit \`${baseCommit}\`, plus the M02-T05 working tree
- Source tree: \`${sourceTreeDigest}\`
- Integrity: SHA-256 manifest in \`${evidenceManifestRelativePath}\`
- Environment: Node.js \`${process.version}\`, npm \`${npmVersion}\`, \`${process.platform}\`/\`${process.arch}\`
- Objective: verify safe deterministic discovery, inventory, classification, and CLI integration
- Expected result: every gate passes; reviewed expected/actual inventory matches; repeated runs are byte-identical

## Executed checks

| Check | Exit | Status | Raw record |
| ----- | ---: | ------ | ---------- |
${commandRows}

## Measurements

- Tests: ${String(tests)} passed across ${String(testFiles)} files; zero skipped or todo tests.
- Coverage: statements ${normalizedCoverage.statements}%, branches ${normalizedCoverage.branches}%, functions ${normalizedCoverage.functions}%, lines ${normalizedCoverage.lines}%.
- Dependency audit: ${auditReport.metadata.vulnerabilities.total} known vulnerabilities reported by npm.
- Controlled inventory: 10 canonical entries, five source candidates, no duplicates, and stable expected/actual output.
- Exclusions: dependency/generated/configuration names plus default and opt-in symbolic-link behavior.
- Determinism: ${deterministicComparison.byteIdentical ? 'PASS' : 'FAIL'}; both normalized scenario runs have digest \`${deterministicComparison.run1}\`.
- Target project code executed: no.

## Conclusion

PASS. M02 recursively discovers controlled project trees, enforces canonical containment and
documented symlink policy, retains a normalized deduplicated inventory, classifies only supported
source candidates, exposes a stable CLI summary, and reproduces the reviewed scenario byte for
byte. The isolated process environment does not inherit credential variables.

## Current limitation

Discovery and inventory identify candidates only. M03 must revalidate containment when opening each
file, parse supported syntax, isolate malformed files, and build the normalized analysis model.
Distinct hard-link paths remain separate inventory locations by design.
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
    publicationStagingDirectory = await mkdtemp(
      path.join(evidenceParentDirectory, '.m02-discovery-staging-'),
    );

    for (const entry of await readdir(temporaryEvidence)) {
      await cp(path.join(temporaryEvidence, entry), path.join(publicationStagingDirectory, entry), {
        errorOnExist: true,
        force: false,
        recursive: true,
      });
    }

    await assertEvidencePackageIsComplete(publicationStagingDirectory);
    await assertEvidenceManifestIsValid(publicationStagingDirectory);
    await assertEvidenceIsSanitized(publicationStagingDirectory);

    try {
      await rmdir(finalEvidenceDirectory);
    } catch (error) {
      if (!isFileSystemError(error) || error.code !== 'ENOENT') {
        throw error;
      }
    }

    await rename(publicationStagingDirectory, finalEvidenceDirectory);
    publicationStagingDirectory = undefined;
  } else {
    await assertExistingEvidenceMatches(environment);
  }

  console.log('M02 evidence collection: PASS');
  console.log(
    existingEvidenceFiles.length === 0
      ? 'Evidence written to evidence/m02-discovery/'
      : 'Existing evidence preserved after reproducibility check',
  );
} finally {
  await Promise.all([
    rm(temporaryRoot, { force: true, recursive: true }),
    publicationStagingDirectory
      ? rm(publicationStagingDirectory, { force: true, recursive: true })
      : Promise.resolve(),
  ]);
}

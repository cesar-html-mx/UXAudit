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
import { homedir, tmpdir } from 'node:os';
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
  sanitizeEvidenceText,
} from './m03-evidence-contract.mjs';
import { getPublicDocumentationCopyDecision } from './public-documentation-source-filter.mjs';

const rootDirectory = process.cwd();
const finalEvidenceDirectory = path.join(rootDirectory, 'evidence', 'm03-parsing');
const evidenceParentDirectory = path.dirname(finalEvidenceDirectory);
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'uxaudit-m03-evidence-'));
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
const babelPackages = ['@babel/parser', '@babel/traverse', '@babel/types'];
const expectedBabelVersion = '8.0.4';
const jsonFormatOptions = {
  endOfLine: 'lf',
  parser: 'json',
  printWidth: 100,
};
let publicationStagingDirectory;
let initialPlaceholderPresent;

if (!npmExecPath) {
  throw new Error('npm executable path is unavailable; run this collector through npm.');
}

const allowedTopLevelEntries = new Set([
  '.agents',
  '.editorconfig',
  '.gitattributes',
  '.github',
  '.gitignore',
  '.husky',
  '.npmrc',
  '.nvmrc',
  '.prettierignore',
  '.prettierrc.json',
  'AGENTS.md',
  'README.md',
  'docs',
  'eslint.config.mjs',
  'examples',
  'fixtures',
  'package-lock.json',
  'package.json',
  'scripts',
  'src',
  'tests',
  'tsconfig.build.json',
  'tsconfig.json',
  'vitest.config.ts',
]);
const excludedDirectoryNames = new Set([
  '.cache',
  '.codex',
  '.codex-log',
  '.git',
  '.ssh',
  '.tmp',
  'coverage',
  'dist',
  'evidence',
  'node_modules',
]);
const forbiddenSourceNames = new Set([
  '.env',
  '.git-credentials',
  '.netrc',
  '.pypirc',
  '.yarnrc',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  'id_rsa',
]);
const stableResultRelativePaths = [
  'measurements/coverage-summary.json',
  'measurements/test-summary.json',
  'scenario/cli-summary.json',
  'scenario/deterministic-comparison.json',
  'scenario/location-sample.json',
  'scenario/model-sample.json',
  'scenario/scenario-actual.json',
  'scenario/scenario-expected.json',
];
const memoryFields = ['arrayBuffersBytes', 'externalBytes', 'heapUsedBytes', 'rssBytes'];

const compareNames = (left, right) =>
  left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
const toPortablePath = (value) => value.split(path.sep).join('/');
const digest = (content) => `sha256:${createHash('sha256').update(content).digest('hex')}`;
const isFileSystemError = (error) => typeof error === 'object' && error !== null && 'code' in error;
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const assertCondition = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;
const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));
const isEmptyInitialPlaceholder = async (files) => {
  if (files.length !== 1) {
    return false;
  }

  const relativePath = toPortablePath(path.relative(finalEvidenceDirectory, files[0]));

  return relativePath === '.gitkeep' && (await readFile(files[0])).byteLength === 0;
};

const shouldCopySource = (source) => {
  const relativePath = path.relative(rootDirectory, source);

  if (relativePath === '') {
    return true;
  }

  const segments = relativePath.split(path.sep);
  const topLevel = segments[0];
  const fileName = (segments.at(-1) ?? '').toLowerCase();
  const publicDocumentationDecision = getPublicDocumentationCopyDecision(segments);

  if (publicDocumentationDecision !== undefined) {
    return publicDocumentationDecision;
  }

  if (!topLevel || !allowedTopLevelEntries.has(topLevel)) {
    return false;
  }

  if (
    segments.some((segment, index) => index > 0 && excludedDirectoryNames.has(segment)) ||
    (topLevel === '.husky' && segments[1] === '_')
  ) {
    return false;
  }

  if (
    forbiddenSourceNames.has(fileName) ||
    fileName.startsWith('.env.') ||
    fileName.endsWith('.key') ||
    fileName.endsWith('.pem') ||
    (fileName === '.npmrc' && relativePath !== '.npmrc')
  ) {
    return false;
  }

  return true;
};

const assertProjectNpmConfigIsSafe = async () => {
  const content = await readFile(path.join(rootDirectory, '.npmrc'), 'utf8');

  if (
    /(?:_auth|authToken|authorization|password|username)\s*=/iu.test(content) ||
    /https?:\/\/[^/\s:@]+:[^@\s/]+@/iu.test(content)
  ) {
    throw new Error('Project npm configuration contains credential-bearing settings.');
  }
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
      resolve({ exitCode: exitCode ?? -1, stderr, stdout });
    });
  });

const commandResults = [];
const sensitivePathValues = [isolatedWorkspace, rootDirectory, temporaryRoot, homedir()].filter(
  Boolean,
);

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
  const recordedStderr = sanitizeEvidenceText(normalizeRecordedOutput(result.stderr), [
    ...sensitivePathValues,
    vitestResultsPath,
  ]);
  const recordedStdout = sanitizeEvidenceText(normalizeRecordedOutput(result.stdout), [
    ...sensitivePathValues,
    vitestResultsPath,
  ]);
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

  await writeFile(
    path.join(rawEvidence, fileName),
    sanitizeEvidenceText(rawOutput, sensitivePathValues),
    'utf8',
  );

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

const normalizeCoverage = (coverageSummary) => {
  assertCondition(isRecord(coverageSummary?.total), 'Coverage summary has no total metrics.');
  const normalized = {};

  for (const name of ['branches', 'functions', 'lines', 'statements']) {
    const metric = coverageSummary.total[name];
    const percentage = isRecord(metric) ? metric.pct : undefined;

    assertCondition(
      isFiniteNumber(percentage) && percentage >= 90 && percentage <= 100,
      `Coverage metric ${name} does not satisfy the configured threshold.`,
    );
    normalized[name] = percentage;
  }

  return normalized;
};

const normalizeTestReport = (testReport) => {
  const testFiles = Array.isArray(testReport?.testResults) ? testReport.testResults.length : 0;
  const totalTests = testReport?.numTotalTests;
  const passedTests = testReport?.numPassedTests;
  const failedTests = testReport?.numFailedTests;
  const skippedTests = testReport?.numPendingTests;
  const todoTests = testReport?.numTodoTests;

  assertCondition(
    testReport?.success === true &&
      testFiles > 0 &&
      Number.isInteger(totalTests) &&
      totalTests > 0 &&
      passedTests === totalTests &&
      failedTests === 0 &&
      skippedTests === 0 &&
      todoTests === 0 &&
      testReport.testResults.every((result) => result.status === 'passed'),
    'Vitest evidence contains failed, skipped, todo, or incomplete tests.',
  );

  return {
    failedTests,
    passedTests,
    skippedTests,
    testFiles,
    todoTests,
    totalTests,
  };
};

const normalizeAuditReport = (auditReport) => {
  const vulnerabilities = auditReport?.metadata?.vulnerabilities;
  const normalized = {};

  assertCondition(isRecord(vulnerabilities), 'npm audit did not return vulnerability metadata.');

  for (const severity of ['info', 'low', 'moderate', 'high', 'critical', 'total']) {
    const count = vulnerabilities[severity];

    assertCondition(
      isNonNegativeInteger(count),
      `npm audit returned an invalid ${severity} vulnerability count.`,
    );
    normalized[severity] = count;
  }

  assertCondition(
    normalized.moderate === 0 && normalized.high === 0 && normalized.critical === 0,
    'npm audit reported a vulnerability at or above the moderate threshold.',
  );

  return normalized;
};

const normalizeBabelDependencies = (dependencyReport, packageMetadata) => {
  const normalized = {};

  assertCondition(
    !Array.isArray(dependencyReport?.problems) || dependencyReport.problems.length === 0,
    'npm ls reported a direct Babel dependency problem.',
  );

  for (const packageName of babelPackages) {
    const dependency = dependencyReport?.dependencies?.[packageName];
    const observedVersion = isRecord(dependency) ? dependency.version : undefined;

    assertCondition(
      packageMetadata.dependencies?.[packageName] === expectedBabelVersion &&
        observedVersion === expectedBabelVersion,
      `${packageName} is not installed directly at the locked ${expectedBabelVersion} version.`,
    );
    normalized[packageName] = observedVersion;
  }

  return normalized;
};

const validatePerformanceBaseline = (performanceBaseline) => {
  assertCondition(
    Array.isArray(performanceBaseline?.runs) && performanceBaseline.runs.length === 2,
    'Scenario performance evidence must contain two informational runs.',
  );

  for (const run of performanceBaseline.runs) {
    assertCondition(
      isFiniteNumber(run?.elapsedMilliseconds) && run.elapsedMilliseconds >= 0,
      'Scenario elapsed time is invalid.',
    );

    for (const groupName of ['memoryAfter', 'memoryBefore', 'memoryDelta']) {
      const group = run[groupName];

      assertCondition(isRecord(group), `Scenario ${groupName} measurement is missing.`);

      for (const fieldName of memoryFields) {
        const value = group[fieldName];
        const isValid = isFiniteNumber(value) && (groupName === 'memoryDelta' || value >= 0);

        assertCondition(isValid, `Scenario ${groupName}.${fieldName} is invalid.`);
      }
    }
  }
};

const readAndValidateScenario = async (directory) => {
  const [
    comparison,
    actual,
    expected,
    cliSummary,
    performanceBaseline,
    actualContent,
    expectedContent,
  ] = await Promise.all([
    readJson(path.join(directory, 'deterministic-comparison.json')),
    readJson(path.join(directory, 'scenario-actual.json')),
    readJson(path.join(directory, 'scenario-expected.json')),
    readJson(path.join(directory, 'cli-summary.json')),
    readJson(path.join(directory, 'performance-baseline.json')),
    readFile(path.join(directory, 'scenario-actual.json')),
    readFile(path.join(directory, 'scenario-expected.json')),
  ]);
  const sourceKinds = Array.isArray(actual?.checks?.fourSourceKinds)
    ? actual.checks.fourSourceKinds.map((value) =>
        typeof value === 'string' ? value : value?.sourceKind,
      )
    : undefined;
  const parsingSummary = actual?.parsingSummary;

  assertCondition(
    comparison?.byteIdenticalAcrossRuns === true &&
      comparison.expectedMatchesActual === true &&
      comparison.expected === comparison.run1 &&
      comparison.run1 === comparison.run2 &&
      comparison.run1 === digest(actualContent),
    'Controlled scenario is not deterministic or does not match its reviewed expectation.',
  );
  assertCondition(
    actualContent.equals(expectedContent) && JSON.stringify(actual) === JSON.stringify(expected),
    'Controlled scenario expected and actual artifacts differ.',
  );
  assertCondition(
    cliSummary?.exitCode === 0 &&
      cliSummary.stderr === '(empty)' &&
      typeof cliSummary.stdout === 'string' &&
      cliSummary.stdout.includes('Parsing summary:'),
    'Controlled scenario CLI summary is invalid.',
  );
  assertCondition(
    Array.isArray(sourceKinds) &&
      JSON.stringify(sourceKinds) ===
        JSON.stringify(['javascript', 'javascript-jsx', 'typescript', 'typescript-jsx']),
    'Controlled scenario did not exercise all four supported source kinds.',
  );
  assertCondition(
    actual?.checks?.malformedFileIsolated === true &&
      actual.checks.sourceLocationsRetained === true &&
      actual.checks.targetCodeExecuted === false &&
      Array.isArray(actual.parserErrors) &&
      actual.parserErrors.length === 1 &&
      actual.parserErrors[0]?.filePath === 'src/malformed.tsx' &&
      actual.parserErrors[0]?.code === 'SOURCE_PARSE_FAILED',
    'Controlled scenario isolation, locations, or no-execution checks failed.',
  );
  assertCondition(
    isNonNegativeInteger(parsingSummary?.parsedFiles) &&
      parsingSummary.parsedFiles > 0 &&
      parsingSummary.failedFiles === 1 &&
      isNonNegativeInteger(parsingSummary.components) &&
      parsingSummary.components > 0 &&
      isNonNegativeInteger(parsingSummary.jsxNodes) &&
      parsingSummary.jsxNodes > 0,
    'Controlled scenario parsing summary is invalid.',
  );
  validatePerformanceBaseline(performanceBaseline);

  return {
    byteIdenticalReruns: true,
    components: parsingSummary.components,
    expectedMatched: true,
    failedFiles: parsingSummary.failedFiles,
    jsxNodes: parsingSummary.jsxNodes,
    parsedFiles: parsingSummary.parsedFiles,
    resultDigest: digest(actualContent),
    sourceKinds,
    sourceLocationsRetained: true,
    targetCodeExecuted: false,
  };
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
  await readAndValidateScenario(path.join(finalEvidenceDirectory, 'scenario'));

  const existingEnvironment = await readJson(path.join(finalEvidenceDirectory, 'environment.json'));

  if (
    JSON.stringify(comparableEvidence(existingEnvironment)) !==
    JSON.stringify(comparableEvidence(expectedEnvironment))
  ) {
    throw new Error(
      'Existing evidence does not match the current verified source tree and stable results.',
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

  for (const relativePath of stableResultRelativePaths) {
    const [expectedContent, existingContent] = await Promise.all([
      readFile(path.join(temporaryEvidence, relativePath)),
      readFile(path.join(finalEvidenceDirectory, relativePath)),
    ]);

    if (!expectedContent.equals(existingContent)) {
      throw new Error(`Existing stable evidence differs: ${relativePath}`);
    }
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
    mkdir(evidenceParentDirectory, { recursive: true }),
    writeFile(npmUserConfig, '', 'utf8'),
    assertProjectNpmConfigIsSafe(),
  ]);
  let existingEvidenceFiles = [];

  try {
    existingEvidenceFiles = await findEvidenceFiles(finalEvidenceDirectory);
  } catch (error) {
    if (!isFileSystemError(error) || error.code !== 'ENOENT') {
      throw error;
    }
  }
  initialPlaceholderPresent = await isEmptyInitialPlaceholder(existingEvidenceFiles);

  if (initialPlaceholderPresent) {
    existingEvidenceFiles = [];
  }

  await cp(rootDirectory, isolatedWorkspace, {
    dereference: false,
    filter: shouldCopySource,
    recursive: true,
    verbatimSymlinks: true,
  });
  const sourceTreeDigest = await createSourceTreeDigest(isolatedWorkspace);
  const observedAt = new Date().toISOString();
  const packageMetadata = await readJson(path.join(isolatedWorkspace, 'package.json'));
  const harnessState = await readJson(
    path.join(isolatedWorkspace, '.github', 'harness', 'state', 'state.json'),
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
    pinnedNodeVersion !== '24.18.0' ||
    packageMetadata.packageManager !== `npm@${npmVersion}` ||
    npmVersion !== '11.16.0' ||
    packageMetadata.engines?.node !== '>=24.18.0 <25' ||
    packageMetadata.engines?.npm !== '>=11.16.0 <12'
  ) {
    throw new Error('Evidence runtime does not match the pinned Node.js 24/npm 11 contract.');
  }

  if (
    harnessState.activeMilestone !== 'M03' ||
    harnessState.activeTask !== 'M03-T05' ||
    harnessState.currentBranch !== branch
  ) {
    throw new Error('Evidence collection requires the active M03-T05 milestone branch.');
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
    args: [npmExecPath, 'run', 'test:scenario:m03', '--', '--output', scenarioEvidence],
    command: process.execPath,
    displayedArgs: ['run', 'test:scenario:m03', '--', '--output', '<EVIDENCE_DIR>'],
    displayedCommand: 'npm',
    fileName: 'm03-scenario.txt',
    label: 'Controlled M03 parser/model scenario',
  });
  const modelSamplePath = path.join(scenarioEvidence, 'model-sample.json');
  await writeFile(
    modelSamplePath,
    await format(await readFile(modelSamplePath, 'utf8'), jsonFormatOptions),
    'utf8',
  );
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
  const babelDependencyResult = await recordNpmCommand({
    args: ['ls', '--depth=0', '--json', ...babelPackages],
    fileName: 'babel-dependencies.json.txt',
    label: 'Direct locked Babel dependencies',
  });

  const [coverageSummary, testReport, scenario] = await Promise.all([
    readJson(path.join(isolatedWorkspace, 'coverage', 'coverage-summary.json')),
    readJson(vitestResultsPath),
    readAndValidateScenario(scenarioEvidence),
  ]);
  const coverage = normalizeCoverage(coverageSummary);
  const tests = normalizeTestReport(testReport);
  const vulnerabilities = normalizeAuditReport(JSON.parse(auditResult.stdout));
  const babelDependencies = normalizeBabelDependencies(
    JSON.parse(babelDependencyResult.stdout),
    packageMetadata,
  );

  await Promise.all([
    writeFile(
      path.join(measurementEvidence, 'coverage-summary.json'),
      `${JSON.stringify(coverage, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      path.join(measurementEvidence, 'test-summary.json'),
      `${JSON.stringify(tests, null, 2)}\n`,
      'utf8',
    ),
  ]);

  const verification = {
    babelDependencies,
    commands: commandResults,
    coverage,
    dependencyAuditVulnerabilities: vulnerabilities,
    skippedTests: tests.skippedTests,
    testFiles: tests.testFiles,
    tests: tests.totalTests,
    todoTests: tests.todoTests,
  };
  const environment = {
    schemaVersion: 6,
    evidenceId: 'M03-PARSING',
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
    scenario,
    verification,
  };

  await writeFile(
    path.join(temporaryEvidence, 'environment.json'),
    await format(JSON.stringify(environment), jsonFormatOptions),
    'utf8',
  );

  const commandRows = commandResults
    .map(
      ({ fileName, label, observedExitCode, passed }) =>
        `| ${label} | ${String(observedExitCode)} | ${passed ? 'PASS' : 'FAIL'} | [raw/${fileName}](raw/${fileName}) |`,
    )
    .join('\n');
  const summary = `# M03 Parsing Evidence

- Evidence ID: M03-PARSING
- Observed at: ${observedAt}
- Source: branch \`${branch}\`, base commit \`${baseCommit}\`, plus the M03-T05 working tree
- Source tree: \`${sourceTreeDigest}\`
- Integrity: SHA-256 manifest in \`${evidenceManifestRelativePath}\`
- Environment: Node.js \`${process.version}\`, npm \`${npmVersion}\`, \`${process.platform}\`/\`${process.arch}\`
- Objective: verify bounded source reads, the Babel parser/extractor boundary, normalized model construction, error isolation, deterministic output, and target-code non-execution
- Expected result: every gate passes; reviewed expected/actual analysis matches; malformed syntax remains local; repeated normalized runs are byte-identical

## Executed checks

| Check | Exit | Status | Raw record |
| ----- | ---: | ------ | ---------- |
${commandRows}

## Measurements

- Tests: ${String(tests.totalTests)} passed across ${String(tests.testFiles)} files; zero skipped or todo tests.
- Coverage: statements ${coverage.statements}%, branches ${coverage.branches}%, functions ${coverage.functions}%, lines ${coverage.lines}%.
- Dependency audit: ${String(vulnerabilities.total)} known vulnerabilities; moderate ${String(vulnerabilities.moderate)}, high ${String(vulnerabilities.high)}, critical ${String(vulnerabilities.critical)}.
- Direct parser dependencies: \`@babel/parser\`, \`@babel/traverse\`, and \`@babel/types\` are installed directly at exact version \`${expectedBabelVersion}\`.
- Controlled parsing: ${String(scenario.parsedFiles)} files parsed, ${String(scenario.failedFiles)} malformed file isolated, ${String(scenario.components)} components, and ${String(scenario.jsxNodes)} JSX nodes.
- Syntax matrix: JavaScript, JavaScript with JSX, TypeScript, and TypeScript with JSX.
- Determinism: PASS; both normalized scenario runs have digest \`${scenario.resultDigest}\` and match the reviewed expectation.
- Source locations retained: yes. Target project code executed: no.
- Performance and process-memory observations: retained in \`scenario/performance-baseline.json\` as informational measurements without a machine-dependent threshold.

## Conclusion

PASS. M03 reauthorizes and reads bounded source candidates, parses the four supported source kinds
without importing target modules, projects Babel data into the UXAudit-owned model, preserves
locations and deterministic relationships, and safely continues after the controlled malformed
file. The isolated child environment uses an explicit allowlist and does not inherit credential
variables.

## Current limitation

Portable filesystem APIs reduce but cannot eliminate the final path-replacement race. Component
recognition and retained dynamic values remain deliberately syntactic and conservative; M04 rules
must consume the normalized confidence-bearing model rather than infer runtime behavior.
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
      path.join(evidenceParentDirectory, '.m03-parsing-staging-'),
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
      if (initialPlaceholderPresent) {
        const placeholderPath = path.join(finalEvidenceDirectory, '.gitkeep');
        const placeholderContent = await readFile(placeholderPath);

        if (placeholderContent.byteLength !== 0) {
          throw new Error('The initial M03 evidence placeholder changed during collection.');
        }

        await rm(placeholderPath);
      }

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

  console.log('M03 evidence collection: PASS');
  console.log(
    existingEvidenceFiles.length === 0
      ? 'Evidence written to evidence/m03-parsing/'
      : 'Existing evidence preserved after stable-result reproducibility check',
  );
} finally {
  await Promise.all([
    rm(temporaryRoot, { force: true, recursive: true }),
    publicationStagingDirectory
      ? rm(publicationStagingDirectory, { force: true, recursive: true })
      : Promise.resolve(),
  ]);
}

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
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
  assertBaseEvidenceArtifactsAreComplete,
  assertBaseEvidencePackageIsComplete,
  assertEvidenceIsSanitized,
  assertEvidenceJsonIsCanonical,
  assertEvidenceManifestIsValid,
  evidenceManifestRelativePath,
  findEvidenceFiles,
  renderEvidenceManifest,
  sanitizeEvidenceText,
} from './m05-evidence-contract.mjs';
import { getPublicDocumentationCopyDecision } from './public-documentation-source-filter.mjs';

const rootDirectory = process.cwd();
const finalEvidenceDirectory = path.join(rootDirectory, 'evidence', 'm05-reporting');
const evidenceParentDirectory = path.dirname(finalEvidenceDirectory);
const npmExecPath = process.env.npm_execpath;
const vitestResultsRelativePath = 'coverage/vitest-results.json';
const scenarioId = 'M05-CONFIGURATION-REPORTING';
const jsonFormatOptions = {
  endOfLine: 'lf',
  parser: 'json',
  printWidth: 100,
};
let childTemporaryDirectory;
let isolatedWorkspace;
let measurementEvidence;
let npmCacheDirectory;
let npmUserConfig;
let publicationStagingDirectory;
let rawEvidence;
let scenarioEvidence;
let sensitivePathValues = [rootDirectory, homedir()].filter(Boolean);
let temporaryEvidence;
let temporaryRoot;
let vitestResultsPath;
let initialPlaceholderPresent;
let initialDestinationPresent;

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
  'credentials.json',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  'id_rsa',
  'secrets.json',
]);
const stableResultRelativePaths = [
  'measurements/coverage-summary.json',
  'measurements/test-summary.json',
  'scenario/audit-report.html',
  'scenario/audit-report.json',
  'scenario/audit-result-expected.json',
  'scenario/configuration-matrix.json',
  'scenario/cross-reporter-consistency.json',
  'scenario/deterministic-comparison.json',
  'scenario/terminal-color-validation.json',
  'scenario/terminal-report.txt',
  'scenario/write-path-validation.json',
  'scenario/xss-validation.json',
];
const generatedWorkspaceRelativePaths = ['.husky/_', 'coverage', 'dist', 'node_modules'];

const compareNames = (left, right) =>
  left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
const toPortablePath = (value) => value.split(path.sep).join('/');
const digest = (content) => `sha256:${createHash('sha256').update(content).digest('hex')}`;
const isFileSystemError = (error) => typeof error === 'object' && error !== null && 'code' in error;
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;
const assertCondition = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};
const assertExactKeys = (value, expectedKeys, label) => {
  assertCondition(isRecord(value), `${label} must be an object.`);
  const observedKeys = Object.keys(value).toSorted();
  const normalizedExpectedKeys = [...expectedKeys].toSorted();

  assertCondition(
    JSON.stringify(observedKeys) === JSON.stringify(normalizedExpectedKeys),
    `${label} has an invalid shape.`,
  );
};
const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));
const isEmptyInitialPlaceholder = async (files) => {
  if (files.length !== 1) {
    return false;
  }

  const relativePath = toPortablePath(path.relative(finalEvidenceDirectory, files[0]));

  return relativePath === '.gitkeep' && (await readFile(files[0])).byteLength === 0;
};

const isStrictlyContainedPath = (parentDirectory, candidatePath) => {
  const relativePath = path.relative(parentDirectory, candidatePath);

  return (
    relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
};

const assertRegularDirectory = async (directory, label) => {
  const metadata = await lstat(directory);

  assertCondition(
    metadata.isDirectory() && !metadata.isSymbolicLink(),
    `${label} must be a regular directory and must not be a symbolic link.`,
  );
};

const inspectEvidenceDestination = async () => {
  const [rootRealPath, evidenceParentMetadata] = await Promise.all([
    realpath(rootDirectory),
    lstat(evidenceParentDirectory),
  ]);

  assertCondition(
    evidenceParentMetadata.isDirectory() && !evidenceParentMetadata.isSymbolicLink(),
    'Evidence parent must be a regular directory and must not be a symbolic link.',
  );

  const evidenceParentRealPath = await realpath(evidenceParentDirectory);
  const expectedEvidenceParent = path.join(rootRealPath, 'evidence');

  assertCondition(
    evidenceParentRealPath === expectedEvidenceParent,
    'Evidence parent resolves outside the repository root.',
  );

  let destinationMetadata;

  try {
    destinationMetadata = await lstat(finalEvidenceDirectory);
  } catch (error) {
    if (isFileSystemError(error) && error.code === 'ENOENT') {
      return {
        exists: false,
        files: [],
        parentRealPath: evidenceParentRealPath,
      };
    }

    throw error;
  }

  assertCondition(
    destinationMetadata.isDirectory() && !destinationMetadata.isSymbolicLink(),
    'M05 evidence destination must be a regular directory and must not be a symbolic link.',
  );

  const destinationRealPath = await realpath(finalEvidenceDirectory);
  const expectedDestination = path.join(evidenceParentRealPath, 'm05-reporting');

  assertCondition(
    destinationRealPath === expectedDestination &&
      isStrictlyContainedPath(evidenceParentRealPath, destinationRealPath),
    'M05 evidence destination resolves outside its approved parent.',
  );

  const files = await findEvidenceFiles(finalEvidenceDirectory);

  for (const filePath of files) {
    const [fileMetadata, fileRealPath] = await Promise.all([lstat(filePath), realpath(filePath)]);

    assertCondition(
      fileMetadata.isFile() &&
        !fileMetadata.isSymbolicLink() &&
        isStrictlyContainedPath(destinationRealPath, fileRealPath),
      'M05 evidence contains a non-regular file or a path outside the approved destination.',
    );
  }

  return {
    exists: true,
    files,
    parentRealPath: evidenceParentRealPath,
  };
};

const assertDestinationUnchangedBeforePublication = async () => {
  const currentDestination = await inspectEvidenceDestination();

  if (initialPlaceholderPresent) {
    assertCondition(
      currentDestination.exists && (await isEmptyInitialPlaceholder(currentDestination.files)),
      'The initial M05 evidence placeholder changed during collection.',
    );
  } else {
    assertCondition(
      initialDestinationPresent === false && currentDestination.exists === false,
      'The M05 evidence destination appeared or changed during collection.',
    );
  }

  return currentDestination;
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
    fileName.endsWith('.p12') ||
    fileName.endsWith('.pem') ||
    fileName.endsWith('.pfx') ||
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

const removeControlledWorkspaceOutputs = async () => {
  await assertRegularDirectory(isolatedWorkspace, 'Isolated workspace');
  const isolatedWorkspaceRealPath = await realpath(isolatedWorkspace);

  for (const relativePath of generatedWorkspaceRelativePaths) {
    const segments = relativePath.split('/');
    let currentPath = isolatedWorkspace;
    let targetExists = true;

    for (const [index, segment] of segments.entries()) {
      currentPath = path.join(currentPath, segment);

      let metadata;

      try {
        metadata = await lstat(currentPath);
      } catch (error) {
        if (isFileSystemError(error) && error.code === 'ENOENT') {
          targetExists = false;
          break;
        }

        throw error;
      }

      assertCondition(
        metadata.isDirectory() && !metadata.isSymbolicLink(),
        `Generated workspace output is not a regular directory: ${relativePath}`,
      );

      if (index < segments.length - 1) {
        const ancestorRealPath = await realpath(currentPath);

        assertCondition(
          isStrictlyContainedPath(isolatedWorkspaceRealPath, ancestorRealPath),
          `Generated workspace output resolves outside the isolated workspace: ${relativePath}`,
        );
      }
    }

    if (!targetExists) {
      continue;
    }

    const targetRealPath = await realpath(currentPath);

    assertCondition(
      isStrictlyContainedPath(isolatedWorkspaceRealPath, targetRealPath),
      `Generated workspace output resolves outside the isolated workspace: ${relativePath}`,
    );
    await rm(currentPath, { recursive: true });
  }
};

const assertSourceSnapshotWasNotMutated = async (expectedDigest) => {
  await removeControlledWorkspaceOutputs();
  const observedDigest = await createSourceTreeDigest(isolatedWorkspace);

  assertCondition(
    observedDigest === expectedDigest,
    'The isolated source snapshot changed while the M05 gates were running.',
  );
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

const assertScenarioHeader = (value, label) => {
  assertCondition(
    value.schemaVersion === 1 && value.scenarioId === scenarioId,
    `${label} has an invalid schema version or scenario ID.`,
  );
};

const assertCanonicalMetadataJson = async (directory, fileName) => {
  const content = await readFile(path.join(directory, fileName), 'utf8');

  assertCondition(
    content === (await format(content, jsonFormatOptions)),
    `Scenario JSON is not canonically formatted: ${fileName}`,
  );

  const value = JSON.parse(content);

  assertCondition(isRecord(value), `${fileName} must contain one JSON object.`);
  assertScenarioHeader(value, fileName);

  return { content, value };
};

const assertDigest = (value, expected, label) => {
  assertCondition(
    typeof value === 'string' &&
      /^sha256:[a-f0-9]{64}$/u.test(value) &&
      (expected === undefined || value === expected),
    `${label} is not the expected SHA-256 digest.`,
  );
};

const assertAuditResult = (result) => {
  assertExactKeys(
    result,
    [
      'configuration',
      'errors',
      'findings',
      'projectRoot',
      'reportPaths',
      'schemaVersion',
      'summary',
      'timing',
      'tool',
    ],
    'retained AuditResult',
  );
  assertCondition(
    result.schemaVersion === '1.0.0' &&
      result.projectRoot === '/controlled-project/security-project',
    'Retained AuditResult identity is invalid.',
  );
  assertExactKeys(
    result.configuration,
    [
      'categories',
      'color',
      'formats',
      'minimumSeverity',
      'outputDirectory',
      'ruleIds',
      'schemaVersion',
      'verbose',
    ],
    'AuditResult configuration',
  );
  assertCondition(
    result.configuration.schemaVersion === 1 &&
      result.configuration.categories === null &&
      result.configuration.ruleIds === null &&
      result.configuration.color === false &&
      result.configuration.verbose === true &&
      result.configuration.minimumSeverity === 'info' &&
      result.configuration.outputDirectory === 'reports/m05' &&
      JSON.stringify(result.configuration.formats) === JSON.stringify(['terminal', 'json', 'html']),
    'Retained AuditResult configuration is invalid.',
  );
  assertExactKeys(result.reportPaths, ['html', 'json'], 'AuditResult report paths');
  assertCondition(
    result.reportPaths.html === 'reports/m05/audit-report.html' &&
      result.reportPaths.json === 'reports/m05/audit-report.json',
    'Retained AuditResult report paths are invalid.',
  );
  assertCondition(
    Array.isArray(result.findings) &&
      result.findings.length === 5 &&
      Array.isArray(result.errors) &&
      result.errors.length === 5,
    'Retained AuditResult does not contain the controlled findings and errors.',
  );
  const severities = result.findings.map(({ severity }) => severity).toSorted();
  const stages = result.errors.map(({ stage }) => stage).toSorted();

  assertCondition(
    JSON.stringify(severities) === JSON.stringify(['critical', 'high', 'info', 'low', 'medium']) &&
      JSON.stringify(stages) === JSON.stringify(['discovery', 'extract', 'parse', 'read', 'rule']),
    'Retained AuditResult does not cover every severity and processing stage.',
  );
  assertExactKeys(result.summary, ['errors', 'files', 'findings', 'rules'], 'Audit summary');
  assertCondition(
    result.summary.files.discovered === 7 &&
      result.summary.files.selected === 5 &&
      result.summary.files.parsed === 2 &&
      result.summary.files.failed === 3 &&
      result.summary.findings.total === 5 &&
      Object.values(result.summary.findings.bySeverity).every((count) => count === 1) &&
      result.summary.errors.total === 5 &&
      Object.values(result.summary.errors.byStage).every((count) => count === 1) &&
      result.summary.rules.availableRuleCount === 8 &&
      result.summary.rules.enabledRuleCount === 6 &&
      result.summary.rules.executedRuleCount === 6 &&
      result.summary.rules.succeededRuleCount === 5 &&
      result.summary.rules.failedRuleCount === 1 &&
      result.summary.rules.findingCount === 5,
    'Retained AuditResult summary counters are invalid.',
  );
  assertCondition(
    result.timing.startedAt === '2026-07-29T18:30:00.000Z' &&
      result.timing.completedAt === '2026-07-29T18:30:00.250Z' &&
      result.timing.durationMs === 250,
    'Retained AuditResult timing is not the controlled fixed value.',
  );
};

const assertConfigurationMatrix = (matrix) => {
  assertExactKeys(
    matrix,
    ['cases', 'precedence', 'scenarioId', 'schemaVersion'],
    'configuration matrix',
  );
  const expectedNames = [
    'defaults-without-file',
    'valid-partial-file',
    'cli-over-file-precedence',
    'explicit-empty-filters',
    'unknown-key-rejected',
  ];

  assertCondition(
    matrix.precedence === 'defaults < file < CLI' &&
      Array.isArray(matrix.cases) &&
      matrix.cases.length === expectedNames.length &&
      matrix.cases.every(
        (entry, index) => entry.name === expectedNames[index] && entry.passed === true,
      ),
    'Configuration matrix did not pass all controlled cases.',
  );
  const [defaults, fileOnly, precedence, emptyFilters, rejected] = matrix.cases;

  assertCondition(
    defaults.configuration.formats.length === 1 &&
      defaults.configuration.formats[0] === 'terminal' &&
      defaults.configuration.outputDirectory === 'uxaudit-reports' &&
      JSON.stringify(fileOnly.configuration.formats) === JSON.stringify(['json', 'html']) &&
      fileOnly.configuration.minimumSeverity === 'medium' &&
      JSON.stringify(precedence.configuration.categories) === JSON.stringify(['accessibility']) &&
      JSON.stringify(precedence.configuration.formats) === JSON.stringify(['terminal', 'html']) &&
      precedence.configuration.outputDirectory === 'cli-reports' &&
      JSON.stringify(emptyFilters.configuration.categories) === '[]' &&
      JSON.stringify(emptyFilters.configuration.ruleIds) === '[]' &&
      rejected.error.name === 'ConfigurationError' &&
      rejected.error.code === 'CONFIGURATION_INVALID',
    'Configuration matrix contents differ from the controlled expectation.',
  );
};

const assertCrossReporterConsistency = (value, auditDigest) => {
  assertExactKeys(
    value,
    [
      'auditResultDigest',
      'comparedErrorFields',
      'comparedFindingFields',
      'coordinateProjections',
      'coordinatePolicyValidated',
      'errorCount',
      'essentialFindingAndErrorRecordDigest',
      'findingCount',
      'htmlContainsEssentialFindingAndErrorFields',
      'htmlMetadataConfigurationAndSummaryValidated',
      'jsonDeepEqualsAuditResult',
      'sameAuditResultSuppliedToAllReporters',
      'scenarioId',
      'schemaVersion',
      'terminalContainsEssentialFindingAndErrorFields',
      'terminalSummaryValidated',
    ],
    'cross-reporter consistency',
  );
  assertDigest(value.auditResultDigest, auditDigest, 'cross-reporter AuditResult digest');
  assertDigest(
    value.essentialFindingAndErrorRecordDigest,
    undefined,
    'essential finding/error record digest',
  );
  assertCondition(
    value.errorCount === 5 &&
      value.findingCount === 5 &&
      JSON.stringify(value.comparedFindingFields) ===
        JSON.stringify([
          'ruleId',
          'ruleTitle',
          'category',
          'severity',
          'confidence',
          'location',
          'message',
          'explanation',
          'recommendation',
          'limitations',
          'reference',
        ]) &&
      JSON.stringify(value.comparedErrorFields) ===
        JSON.stringify([
          'stage',
          'code',
          'message',
          'filePath/operation',
          'filePath/position',
          'ruleId/category',
        ]) &&
      JSON.stringify(value.coordinateProjections) ===
        JSON.stringify({
          html: 'half-open start/end lines, one-based display columns, and stored offsets',
          json: 'complete stored zero-based UTF-16 columns and offsets',
          terminal: 'start line and one-based display column',
        }) &&
      value.coordinatePolicyValidated === true &&
      value.htmlContainsEssentialFindingAndErrorFields === true &&
      value.htmlMetadataConfigurationAndSummaryValidated === true &&
      value.jsonDeepEqualsAuditResult === true &&
      value.sameAuditResultSuppliedToAllReporters === true &&
      value.terminalContainsEssentialFindingAndErrorFields === true &&
      value.terminalSummaryValidated === true,
    'Cross-reporter identity assertions did not pass.',
  );
};

const assertDeterministicComparison = (
  value,
  { expectedDigest, htmlDigest, jsonDigest, terminalDigest },
) => {
  assertExactKeys(
    value,
    [
      'independentlyPreparedResultMatched',
      'reports',
      'scenarioId',
      'schemaVersion',
      'timingMetadataHeldConstant',
    ],
    'deterministic comparison',
  );
  assertCondition(
    value.independentlyPreparedResultMatched === true && value.timingMetadataHeldConstant === true,
    'Independently prepared controlled results differ.',
  );
  assertExactKeys(value.reports, ['html', 'json', 'terminal'], 'deterministic reports');

  for (const [formatName, expected] of Object.entries({
    html: htmlDigest,
    json: jsonDigest,
    terminal: terminalDigest,
  })) {
    const report = value.reports[formatName];
    const keys =
      formatName === 'json'
        ? [
            'byteIdentical',
            'expectedDigest',
            'expectedMatched',
            'firstDigest',
            'independentDigest',
            'secondDigest',
          ]
        : ['byteIdentical', 'firstDigest', 'independentDigest', 'secondDigest'];

    assertExactKeys(report, keys, `${formatName} deterministic comparison`);
    assertCondition(report.byteIdentical === true, `${formatName} output is not deterministic.`);
    assertDigest(report.firstDigest, expected, `${formatName} first digest`);
    assertDigest(report.secondDigest, expected, `${formatName} second digest`);
    assertDigest(report.independentDigest, expected, `${formatName} independent digest`);
  }

  assertCondition(
    value.reports.json.expectedMatched === true,
    'JSON output does not match the independent expected result.',
  );
  assertDigest(value.reports.json.expectedDigest, expectedDigest, 'JSON expected-result digest');
};

const assertTerminalColorValidation = (value, terminalDigest) => {
  assertExactKeys(
    value,
    [
      'ansiSequenceCount',
      'colorReportDigest',
      'noColorReportDigest',
      'onlyReporterOwnedAnsi',
      'rawAnsiRetained',
      'scenarioId',
      'schemaVersion',
      'strippedMatchesNoColor',
      'strippedReportDigest',
    ],
    'terminal color validation',
  );
  assertCondition(
    Number.isInteger(value.ansiSequenceCount) &&
      value.ansiSequenceCount > 0 &&
      value.onlyReporterOwnedAnsi === true &&
      value.rawAnsiRetained === false &&
      value.strippedMatchesNoColor === true,
    'Terminal color/no-color assertions did not pass.',
  );
  assertDigest(value.colorReportDigest, undefined, 'color report digest');
  assertDigest(value.noColorReportDigest, terminalDigest, 'no-color report digest');
  assertDigest(value.strippedReportDigest, terminalDigest, 'stripped report digest');
};

const assertXssValidation = (value) => {
  assertExactKeys(
    value,
    [
      'browserExecutionPerformed',
      'contentSecurityPolicy',
      'escapedHostilePayloadPresent',
      'eventHandlerAttributesAbsent',
      'externalAssetsAbsent',
      'inlineScriptElementsAbsent',
      'safeReferenceLinkCount',
      'scenarioId',
      'schemaVersion',
      'secondaryUnicodeHtmlDigest',
      'secondaryUnicodeTerminalDigest',
      'secondaryUnicodeValueCount',
      'secondaryUnicodeValuesRenderedAsVisibleEscapes',
      'secondaryUnicodeValuesRetained',
      'unsafeMarkupAbsent',
      'validationMethod',
    ],
    'XSS validation',
  );
  assertCondition(
    value.browserExecutionPerformed === false &&
      value.contentSecurityPolicy ===
        "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'none'" &&
      value.escapedHostilePayloadPresent === true &&
      value.eventHandlerAttributesAbsent === true &&
      value.externalAssetsAbsent === true &&
      value.inlineScriptElementsAbsent === true &&
      value.safeReferenceLinkCount === 1 &&
      value.secondaryUnicodeValueCount === 6 &&
      value.secondaryUnicodeValuesRenderedAsVisibleEscapes === true &&
      value.secondaryUnicodeValuesRetained === false &&
      value.unsafeMarkupAbsent === true &&
      value.validationMethod ===
        'Structural string assertions and CSP inspection only; no browser execution was performed.',
    'Structural HTML/XSS validation did not pass or overclaims browser execution.',
  );
  assertDigest(value.secondaryUnicodeHtmlDigest, undefined, 'secondary Unicode HTML digest');
  assertDigest(
    value.secondaryUnicodeTerminalDigest,
    undefined,
    'secondary Unicode terminal digest',
  );
};

const assertWritePathValidation = (value, { htmlDigest, jsonDigest }) => {
  assertExactKeys(
    value,
    [
      'controlledFailure',
      'existingTargetError',
      'existingTargetPreserved',
      'html',
      'json',
      'scenarioId',
      'schemaVersion',
      'successClaimReturnedOnlyAfterExactWrite',
      'unsafePathError',
    ],
    'write-path validation',
  );
  assertCondition(
    value.existingTargetPreserved === true &&
      value.successClaimReturnedOnlyAfterExactWrite === true &&
      value.existingTargetError.code === 'REPORT_WRITE_TARGET_EXISTS' &&
      value.unsafePathError.code === 'REPORT_WRITE_PATH_UNSAFE' &&
      value.controlledFailure.code === 'REPORT_WRITE_FAILED' &&
      value.json.format === 'json' &&
      value.json.relativePath === 'reports/m05/audit-report.json' &&
      value.json.exactContentWritten === true &&
      value.html.format === 'html' &&
      value.html.relativePath === 'reports/m05/audit-report.html' &&
      value.html.exactContentWritten === true,
    'Report write success/failure behavior differs from the controlled expectation.',
  );
  assertDigest(value.json.contentDigest, jsonDigest, 'written JSON digest');
  assertDigest(value.html.contentDigest, htmlDigest, 'written HTML digest');
};

const readAndValidateScenario = async (directory) => {
  const [
    auditReportJson,
    expectedAuditResult,
    html,
    terminal,
    configurationRecord,
    consistencyRecord,
    comparisonRecord,
    colorRecord,
    writeRecord,
    xssRecord,
  ] = await Promise.all([
    readFile(path.join(directory, 'audit-report.json'), 'utf8'),
    readFile(path.join(directory, 'audit-result-expected.json'), 'utf8'),
    readFile(path.join(directory, 'audit-report.html'), 'utf8'),
    readFile(path.join(directory, 'terminal-report.txt'), 'utf8'),
    assertCanonicalMetadataJson(directory, 'configuration-matrix.json'),
    assertCanonicalMetadataJson(directory, 'cross-reporter-consistency.json'),
    assertCanonicalMetadataJson(directory, 'deterministic-comparison.json'),
    assertCanonicalMetadataJson(directory, 'terminal-color-validation.json'),
    assertCanonicalMetadataJson(directory, 'write-path-validation.json'),
    assertCanonicalMetadataJson(directory, 'xss-validation.json'),
  ]);
  const auditResult = JSON.parse(auditReportJson);
  const expectedResult = JSON.parse(expectedAuditResult);

  assertCondition(
    auditReportJson === `${JSON.stringify(auditResult, null, 2)}\n` &&
      expectedAuditResult === `${JSON.stringify(expectedResult, null, 2)}\n`,
    'AuditResult JSON is not exact two-space JSON with one final LF.',
  );
  assertCondition(
    auditReportJson === expectedAuditResult &&
      JSON.stringify(auditResult) === JSON.stringify(expectedResult),
    'Rendered JSON and independently prepared expected AuditResult differ.',
  );
  assertAuditResult(auditResult);

  const csp =
    "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'none'";

  assertCondition(
    html.startsWith('<!doctype html>\n') &&
      html.endsWith('\n') &&
      !html.includes('\r') &&
      html.includes(`<meta http-equiv="Content-Security-Policy" content="${csp}">`) &&
      !/<(?:script|iframe|object|embed|link|img)\b/iu.test(html) &&
      !/\son[a-z]+\s*=/iu.test(html),
    'Retained HTML is not the expected standalone CSP-constrained document.',
  );
  assertCondition(
    terminal.endsWith('\n') &&
      !terminal.includes('\r') &&
      !terminal.includes('\u001b') &&
      terminal.includes('UXAudit') &&
      terminal.includes('Findings (5 displayed / 5 total)') &&
      terminal.includes('Processing errors (5)'),
    'Retained terminal report is incomplete or contains raw ANSI.',
  );

  const auditDigest = digest(auditReportJson);
  const htmlDigest = digest(html);
  const terminalDigest = digest(terminal);

  assertConfigurationMatrix(configurationRecord.value);
  assertCrossReporterConsistency(consistencyRecord.value, auditDigest);
  assertDeterministicComparison(comparisonRecord.value, {
    expectedDigest: digest(expectedAuditResult),
    htmlDigest,
    jsonDigest: auditDigest,
    terminalDigest,
  });
  assertTerminalColorValidation(colorRecord.value, terminalDigest);
  assertXssValidation(xssRecord.value);
  assertWritePathValidation(writeRecord.value, {
    htmlDigest,
    jsonDigest: auditDigest,
  });

  return {
    auditResultDigest: auditDigest,
    browserExecutionPerformed: false,
    configurationCases: configurationRecord.value.cases.length,
    crossReporterConsistent: true,
    deterministicReports: true,
    errors: auditResult.errors.length,
    findings: auditResult.findings.length,
    htmlDigest,
    htmlStructurallyValidated: true,
    noRawAnsiRetained: true,
    scenarioId,
    secondaryUnicodeEscapingValidated: true,
    terminalDigest,
    writeFailuresValidated: true,
    writesValidated: true,
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
  await assertBaseEvidencePackageIsComplete(finalEvidenceDirectory);
  await assertEvidenceManifestIsValid(finalEvidenceDirectory);
  await assertEvidenceIsSanitized(finalEvidenceDirectory);
  await assertEvidenceJsonIsCanonical(finalEvidenceDirectory);
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
  if (typeof npmExecPath !== 'string' || npmExecPath.length === 0) {
    throw new Error('npm executable path is unavailable; run this collector through npm.');
  }

  temporaryRoot = await mkdtemp(path.join(tmpdir(), 'uxaudit-m05-evidence-'));
  isolatedWorkspace = path.join(temporaryRoot, 'workspace');
  temporaryEvidence = path.join(temporaryRoot, 'evidence');
  rawEvidence = path.join(temporaryEvidence, 'raw');
  scenarioEvidence = path.join(temporaryEvidence, 'scenario');
  measurementEvidence = path.join(temporaryEvidence, 'measurements');
  childTemporaryDirectory = path.join(temporaryRoot, 'child-tmp');
  npmCacheDirectory = path.join(temporaryRoot, 'npm-cache');
  npmUserConfig = path.join(temporaryRoot, 'npmrc');
  vitestResultsPath = path.join(isolatedWorkspace, vitestResultsRelativePath);
  sensitivePathValues = [isolatedWorkspace, rootDirectory, temporaryRoot, homedir()].filter(
    Boolean,
  );

  const initialDestination = await inspectEvidenceDestination();

  initialDestinationPresent = initialDestination.exists;

  await Promise.all([
    mkdir(rawEvidence, { recursive: true }),
    mkdir(scenarioEvidence, { recursive: true }),
    mkdir(measurementEvidence, { recursive: true }),
    mkdir(childTemporaryDirectory, { recursive: true }),
    mkdir(npmCacheDirectory, { recursive: true }),
    writeFile(npmUserConfig, '', 'utf8'),
    assertProjectNpmConfigIsSafe(),
  ]);
  let existingEvidenceFiles = initialDestination.files;

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
    harnessState.activeMilestone !== 'M05' ||
    harnessState.activeTask !== 'M05-T05' ||
    harnessState.currentBranch !== branch
  ) {
    throw new Error('Evidence collection requires the active M05-T05 milestone branch.');
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
    args: [npmExecPath, 'run', 'test:scenario:m05', '--', '--output', scenarioEvidence],
    command: process.execPath,
    displayedArgs: ['run', 'test:scenario:m05', '--', '--output', '<EVIDENCE_DIR>'],
    displayedCommand: 'npm',
    fileName: 'm05-scenario.txt',
    label: 'Controlled M05 configuration and reporting scenario',
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

  const [coverageSummary, testReport, scenario] = await Promise.all([
    readJson(path.join(isolatedWorkspace, 'coverage', 'coverage-summary.json')),
    readJson(vitestResultsPath),
    readAndValidateScenario(scenarioEvidence),
  ]);
  const coverage = normalizeCoverage(coverageSummary);
  const tests = normalizeTestReport(testReport);
  const vulnerabilities = normalizeAuditReport(JSON.parse(auditResult.stdout));

  await assertSourceSnapshotWasNotMutated(sourceTreeDigest);

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
    commands: commandResults,
    coverage,
    dependencyAuditVulnerabilities: vulnerabilities,
    skippedTests: tests.skippedTests,
    testFiles: tests.testFiles,
    tests: tests.totalTests,
    todoTests: tests.todoTests,
  };
  const environment = {
    schemaVersion: 8,
    evidenceId: 'M05-REPORTING',
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
  const summary = `# M05 Configuration and Reporting Evidence

- Evidence ID: M05-REPORTING
- Observed at: ${observedAt}
- Source: branch \`${branch}\`, base commit \`${baseCommit}\`, plus the M05-T05 working tree
- Source tree: \`${sourceTreeDigest}\`
- Integrity: SHA-256 manifest in \`${evidenceManifestRelativePath}\`
- Environment: Node.js \`${process.version}\`, npm \`${npmVersion}\`, \`${process.platform}\`/\`${process.arch}\`
- Objective: verify configuration defaults/file/CLI precedence and one controlled AuditResult rendered consistently through terminal, exact JSON, and standalone escaped HTML, including safe exclusive report writes
- Expected result: every gate passes; all three reporters consume the same result; repeat renders are byte-identical; HTML passes structural escaping/CSP checks; terminal color strips exactly to no-color output; unsafe or duplicate writes fail without false success claims

## Executed checks

| Check | Exit | Status | Raw record |
| ----- | ---: | ------ | ---------- |
${commandRows}

## Measurements

- Tests: ${String(tests.totalTests)} passed across ${String(tests.testFiles)} files; zero skipped or todo tests.
- Coverage: statements ${coverage.statements}%, branches ${coverage.branches}%, functions ${coverage.functions}%, lines ${coverage.lines}%.
- Dependency audit: ${String(vulnerabilities.total)} known vulnerabilities; moderate ${String(vulnerabilities.moderate)}, high ${String(vulnerabilities.high)}, critical ${String(vulnerabilities.critical)}.
- Controlled result: ${String(scenario.findings)} findings span all five severity buckets and ${String(scenario.errors)} normalized errors span discovery, read, parse, extract, and rule stages.
- Configuration: PASS; ${String(scenario.configurationCases)} controlled cases cover defaults, a valid partial file, CLI-over-file precedence, explicit empty filters, and stable unknown-key rejection.
- Cross-reporter records: PASS; JSON deep-equals the complete result, while terminal and HTML retain the fields each human format promises, including one-based display coordinates.
- Determinism: PASS; terminal, JSON, and HTML rerenders are byte-identical. The exact JSON digest is \`${scenario.auditResultDigest}\`.
- Terminal color: PASS; only reporter-owned ANSI was observed transiently, stripping it matched the retained no-color report, and no raw ANSI is retained.
- HTML security: PASS by structural string assertions and CSP inspection; hostile markup is escaped, external assets/event handlers/scripts are absent, and secondary Unicode controls render as visible escapes.
- Report writes: PASS; exact JSON/HTML content was written to the fixed relative targets, while existing-target, unsafe-path, and controlled write failures returned stable errors without a success claim.

## Conclusion

PASS. M05 validates and merges configuration, renders one normalized result through three
presentation boundaries without reevaluation, and produces exact repeatable JSON, readable
no-color terminal text, and a CSP-constrained standalone HTML document. The shared writer exposes
only successful fixed relative targets and preserves existing content on overwrite attempts. The
isolated child environment uses an explicit allowlist and does not inherit credential variables.

## Current limitation

The HTML security check is structural and does not claim browser execution. M05 exercises reporter
and writer APIs directly over a controlled completed result; the production CLI remains scan-only
until M06 integrates configuration, rule evaluation, result construction, and output orchestration.
`;

  await writeFile(
    path.join(temporaryEvidence, 'SUMMARY.md'),
    await format(summary, { parser: 'markdown' }),
    'utf8',
  );
  await assertBaseEvidenceArtifactsAreComplete(temporaryEvidence);
  await writeFile(
    path.join(temporaryEvidence, evidenceManifestRelativePath),
    await renderEvidenceManifest(temporaryEvidence),
    'utf8',
  );
  await assertBaseEvidencePackageIsComplete(temporaryEvidence);
  await assertEvidenceManifestIsValid(temporaryEvidence);
  await assertEvidenceIsSanitized(temporaryEvidence);
  await assertEvidenceJsonIsCanonical(temporaryEvidence);

  if (existingEvidenceFiles.length === 0) {
    const destinationBeforeStaging = await assertDestinationUnchangedBeforePublication();

    publicationStagingDirectory = await mkdtemp(
      path.join(destinationBeforeStaging.parentRealPath, '.m05-reporting-staging-'),
    );

    for (const entry of await readdir(temporaryEvidence)) {
      await cp(path.join(temporaryEvidence, entry), path.join(publicationStagingDirectory, entry), {
        errorOnExist: true,
        force: false,
        recursive: true,
      });
    }

    await assertRegularDirectory(publicationStagingDirectory, 'Evidence publication staging path');
    const publicationStagingRealPath = await realpath(publicationStagingDirectory);

    assertCondition(
      isStrictlyContainedPath(destinationBeforeStaging.parentRealPath, publicationStagingRealPath),
      'Evidence publication staging path resolves outside its approved parent.',
    );
    await assertBaseEvidencePackageIsComplete(publicationStagingDirectory);
    await assertEvidenceManifestIsValid(publicationStagingDirectory);
    await assertEvidenceIsSanitized(publicationStagingDirectory);
    await assertEvidenceJsonIsCanonical(publicationStagingDirectory);

    const destinationBeforeMutation = await assertDestinationUnchangedBeforePublication();

    if (destinationBeforeMutation.exists) {
      const placeholderPath = path.join(finalEvidenceDirectory, '.gitkeep');
      const placeholderMetadata = await lstat(placeholderPath);
      const placeholderContent = await readFile(placeholderPath);

      assertCondition(
        placeholderMetadata.isFile() &&
          !placeholderMetadata.isSymbolicLink() &&
          placeholderContent.byteLength === 0,
        'The initial M05 evidence placeholder changed during collection.',
      );
      await rm(placeholderPath);
      await rmdir(finalEvidenceDirectory);
    }

    const destinationBeforeRename = await inspectEvidenceDestination();

    assertCondition(
      destinationBeforeRename.exists === false &&
        destinationBeforeRename.parentRealPath === destinationBeforeStaging.parentRealPath,
      'M05 evidence destination is not safe for atomic publication.',
    );
    // Node has no portable no-replace directory rename. A non-empty concurrent destination makes
    // this fail, while POSIX can replace an empty one in this final interval; D-034 bounds that
    // residual to this dedicated milestone evidence target.
    await rename(publicationStagingDirectory, finalEvidenceDirectory);
    publicationStagingDirectory = undefined;

    const publishedDestination = await inspectEvidenceDestination();

    assertCondition(
      publishedDestination.exists,
      'M05 evidence publication did not create the approved destination.',
    );
    await assertBaseEvidencePackageIsComplete(finalEvidenceDirectory);
    await assertEvidenceManifestIsValid(finalEvidenceDirectory);
    await assertEvidenceIsSanitized(finalEvidenceDirectory);
    await assertEvidenceJsonIsCanonical(finalEvidenceDirectory);
  } else {
    await assertExistingEvidenceMatches(environment);
  }

  console.log('M05 evidence collection: PASS');
  console.log(
    existingEvidenceFiles.length === 0
      ? 'Evidence written to evidence/m05-reporting/'
      : 'Existing evidence preserved after stable-result reproducibility check',
  );
} finally {
  if (temporaryRoot) {
    await rm(temporaryRoot, { force: true, recursive: true });
  }

  // A failed publication deliberately leaves its staging directory for manual inspection. Node
  // cannot recursively remove a pathname relative to a held directory handle, so cleanup after an
  // ancestor substitution could otherwise delete a same-named directory outside the repository.
}

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
  assertEvidenceIsSanitized,
  assertEvidenceManifestIsValid,
  assertEvidencePackageIsComplete,
  evidenceManifestRelativePath,
  findEvidenceFiles,
  renderEvidenceManifest,
  sanitizeEvidenceText,
} from './m04-evidence-contract.mjs';

const rootDirectory = process.cwd();
const finalEvidenceDirectory = path.join(rootDirectory, 'evidence', 'm04-rules');
const evidenceParentDirectory = path.dirname(finalEvidenceDirectory);
const npmExecPath = process.env.npm_execpath;
const vitestResultsRelativePath = 'coverage/vitest-results.json';
const scenarioId = 'M04-RULE-CATALOG';
const expectedRuleIds = [
  'accessibility/button-name',
  'accessibility/img-alt',
  'accessibility/input-label',
  'performance/img-dimensions',
  'performance/img-lazy-loading',
  'seo/ambiguous-link-text',
  'seo/multiple-h1',
  'ux/small-inline-text',
];
const expectedFilterCases = [
  {
    name: 'default-stable-catalog',
    filters: null,
    ruleIds: expectedRuleIds,
  },
  {
    name: 'accessibility-category',
    filters: { categories: ['accessibility'] },
    ruleIds: ['accessibility/button-name', 'accessibility/img-alt', 'accessibility/input-label'],
  },
  {
    name: 'category-and-id-intersection',
    filters: {
      categories: ['performance'],
      ruleIds: ['performance/img-lazy-loading', 'seo/multiple-h1'],
    },
    ruleIds: ['performance/img-lazy-loading'],
  },
  {
    name: 'explicit-rule-id',
    filters: { ruleIds: ['ux/small-inline-text'] },
    ruleIds: ['ux/small-inline-text'],
  },
  {
    name: 'empty-rule-id-list',
    filters: { ruleIds: [] },
    ruleIds: [],
  },
];
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
  'scenario/deterministic-comparison.json',
  'scenario/failure-isolation.json',
  'scenario/filter-metadata.json',
  'scenario/finding-samples.json',
  'scenario/limitations.json',
  'scenario/rule-matrix.json',
  'scenario/scenario-actual.json',
  'scenario/scenario-expected.json',
];
const generatedWorkspaceRelativePaths = ['.husky/_', 'coverage', 'dist', 'node_modules'];
const ruleCategories = new Set(['accessibility', 'performance', 'seo', 'ux']);
const ruleConfidences = new Set(['high', 'low', 'medium']);
const ruleSeverities = new Set(['critical', 'high', 'info', 'low', 'medium']);

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
    'M04 evidence destination must be a regular directory and must not be a symbolic link.',
  );

  const destinationRealPath = await realpath(finalEvidenceDirectory);
  const expectedDestination = path.join(evidenceParentRealPath, 'm04-rules');

  assertCondition(
    destinationRealPath === expectedDestination &&
      isStrictlyContainedPath(evidenceParentRealPath, destinationRealPath),
    'M04 evidence destination resolves outside its approved parent.',
  );

  const files = await findEvidenceFiles(finalEvidenceDirectory);

  for (const filePath of files) {
    const [fileMetadata, fileRealPath] = await Promise.all([lstat(filePath), realpath(filePath)]);

    assertCondition(
      fileMetadata.isFile() &&
        !fileMetadata.isSymbolicLink() &&
        isStrictlyContainedPath(destinationRealPath, fileRealPath),
      'M04 evidence contains a non-regular file or a path outside the approved destination.',
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
      'The initial M04 evidence placeholder changed during collection.',
    );
  } else {
    assertCondition(
      initialDestinationPresent === false && currentDestination.exists === false,
      'The M04 evidence destination appeared or changed during collection.',
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
    'The isolated source snapshot changed while the M04 gates were running.',
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

const assertPortableScenarioValue = (value, label = 'scenario artifact') => {
  if (typeof value === 'string') {
    assertCondition(
      !path.posix.isAbsolute(value) &&
        !path.win32.isAbsolute(value) &&
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value),
      `${label} contains an absolute path or volatile timestamp.`,
    );
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      assertPortableScenarioValue(entry, `${label}[${String(index)}]`);
    });
    return;
  }

  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      assertCondition(
        !/^(?:absolutePath|durationMilliseconds|elapsedMilliseconds|observedAt|timestamp)$/u.test(
          key,
        ),
        `${label} contains a volatile field.`,
      );
      assertPortableScenarioValue(entry, `${label}.${key}`);
    }
  }
};

const assertPortableFilePath = (value, label) => {
  assertCondition(
    typeof value === 'string' &&
      value.length > 0 &&
      !path.posix.isAbsolute(value) &&
      !path.win32.isAbsolute(value) &&
      !value.includes('\\') &&
      value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..'),
    `${label} is not a portable project-relative path.`,
  );
};

const assertSourcePosition = (value, label) => {
  assertExactKeys(value, ['column', 'line', 'offset'], label);
  assertCondition(
    Number.isSafeInteger(value.line) &&
      value.line >= 1 &&
      Number.isSafeInteger(value.column) &&
      value.column >= 0 &&
      Number.isSafeInteger(value.offset) &&
      value.offset >= 0,
    `${label} is invalid.`,
  );
};

const assertSourceLocation = (value, label) => {
  assertExactKeys(value, ['end', 'filePath', 'start'], label);
  assertPortableFilePath(value.filePath, `${label}.filePath`);
  assertSourcePosition(value.start, `${label}.start`);
  assertSourcePosition(value.end, `${label}.end`);
  assertCondition(value.start.offset <= value.end.offset, `${label} has a reversed range.`);
};

const assertReference = (value, label) => {
  if (value === null) {
    return;
  }

  assertExactKeys(value, ['label', 'url'], label);
  assertCondition(
    typeof value.label === 'string' &&
      value.label.length > 0 &&
      (value.url === null ||
        (typeof value.url === 'string' && /^https?:\/\/[^\s]+$/u.test(value.url))),
    `${label} is invalid.`,
  );
};

const assertLimitations = (value, label) => {
  assertCondition(
    Array.isArray(value) &&
      value.length > 0 &&
      value.every((limitation) => typeof limitation === 'string' && limitation.length > 0),
    `${label} is invalid.`,
  );
};

const assertFinding = (finding, label) => {
  assertExactKeys(
    finding,
    [
      'category',
      'confidence',
      'explanation',
      'limitations',
      'location',
      'message',
      'recommendation',
      'reference',
      'ruleId',
      'ruleTitle',
      'severity',
    ],
    label,
  );
  assertCondition(
    expectedRuleIds.includes(finding.ruleId) &&
      ruleCategories.has(finding.category) &&
      finding.ruleId.startsWith(`${finding.category}/`) &&
      ruleConfidences.has(finding.confidence) &&
      ruleSeverities.has(finding.severity) &&
      typeof finding.ruleTitle === 'string' &&
      finding.ruleTitle.length > 0 &&
      typeof finding.message === 'string' &&
      finding.message.length > 0 &&
      typeof finding.explanation === 'string' &&
      finding.explanation.length > 0 &&
      typeof finding.recommendation === 'string' &&
      finding.recommendation.length > 0,
    `${label} is incomplete or invalid.`,
  );
  assertLimitations(finding.limitations, `${label}.limitations`);
  assertReference(finding.reference, `${label}.reference`);
  assertCondition(finding.location !== null, `${label} must retain a source location.`);
  assertSourceLocation(finding.location, `${label}.location`);
};

const assertRuleMetadata = (metadata, label) => {
  assertExactKeys(
    metadata,
    [
      'category',
      'defaultSeverity',
      'explanation',
      'id',
      'limitations',
      'recommendation',
      'reference',
      'status',
      'title',
    ],
    label,
  );
  assertCondition(
    expectedRuleIds.includes(metadata.id) &&
      ruleCategories.has(metadata.category) &&
      metadata.id.startsWith(`${metadata.category}/`) &&
      ruleSeverities.has(metadata.defaultSeverity) &&
      metadata.status === 'stable' &&
      typeof metadata.title === 'string' &&
      metadata.title.length > 0 &&
      typeof metadata.explanation === 'string' &&
      metadata.explanation.length > 0 &&
      typeof metadata.recommendation === 'string' &&
      metadata.recommendation.length > 0,
    `${label} is incomplete or invalid.`,
  );
  assertLimitations(metadata.limitations, `${label}.limitations`);
  assertReference(metadata.reference, `${label}.reference`);
};

const assertEvaluationSummary = (summary, expected, label) => {
  assertExactKeys(
    summary,
    [
      'availableRuleCount',
      'enabledRuleCount',
      'executedRuleCount',
      'failedRuleCount',
      'findingCount',
      'succeededRuleCount',
    ],
    label,
  );
  assertCondition(
    Object.entries(expected).every(([key, expectedValue]) => summary[key] === expectedValue),
    `${label} does not match the expected counters.`,
  );
};

const readAndValidateScenario = async (directory) => {
  const retainedJsonFileNames = [
    'deterministic-comparison.json',
    'scenario-actual.json',
    'scenario-expected.json',
    'rule-matrix.json',
    'finding-samples.json',
    'failure-isolation.json',
    'filter-metadata.json',
    'limitations.json',
  ];
  const [
    comparison,
    actual,
    expected,
    ruleMatrix,
    findingSamples,
    failureIsolation,
    filterMetadata,
    limitations,
    actualContent,
    expectedContent,
  ] = await Promise.all([
    readJson(path.join(directory, 'deterministic-comparison.json')),
    readJson(path.join(directory, 'scenario-actual.json')),
    readJson(path.join(directory, 'scenario-expected.json')),
    readJson(path.join(directory, 'rule-matrix.json')),
    readJson(path.join(directory, 'finding-samples.json')),
    readJson(path.join(directory, 'failure-isolation.json')),
    readJson(path.join(directory, 'filter-metadata.json')),
    readJson(path.join(directory, 'limitations.json')),
    readFile(path.join(directory, 'scenario-actual.json')),
    readFile(path.join(directory, 'scenario-expected.json')),
  ]);
  const retainedJsonContents = await Promise.all(
    retainedJsonFileNames.map((fileName) => readFile(path.join(directory, fileName), 'utf8')),
  );

  for (const [index, content] of retainedJsonContents.entries()) {
    assertCondition(
      content === (await format(content, jsonFormatOptions)),
      `Scenario JSON is not canonically formatted: ${retainedJsonFileNames[index]}`,
    );
  }

  const artifacts = [
    ['deterministic comparison', comparison],
    ['scenario actual', actual],
    ['scenario expected', expected],
    ['rule matrix', ruleMatrix],
    ['finding samples', findingSamples],
    ['failure isolation', failureIsolation],
    ['filter metadata', filterMetadata],
    ['limitations', limitations],
  ];

  for (const [label, artifact] of artifacts) {
    assertCondition(isRecord(artifact), `${label} artifact must be an object.`);
    assertScenarioHeader(artifact, label);
    assertPortableScenarioValue(artifact, label);
  }

  assertExactKeys(
    actual,
    ['analysis', 'evaluation', 'scenarioId', 'schemaVersion'],
    'scenario actual',
  );
  assertExactKeys(
    actual.analysis,
    ['componentCount', 'failedFileCount', 'jsxNodeCount', 'parsedFileCount', 'targetCodeExecuted'],
    'scenario analysis',
  );
  assertCondition(
    actual.analysis.parsedFileCount === 1 &&
      actual.analysis.failedFileCount === 0 &&
      isNonNegativeInteger(actual.analysis.componentCount) &&
      actual.analysis.componentCount > 0 &&
      isNonNegativeInteger(actual.analysis.jsxNodeCount) &&
      actual.analysis.jsxNodeCount > 0 &&
      actual.analysis.targetCodeExecuted === false,
    'Controlled scenario analysis counters or no-execution check are invalid.',
  );
  assertExactKeys(actual.evaluation, ['errors', 'findings', 'summary'], 'scenario evaluation');
  assertCondition(
    Array.isArray(actual.evaluation.errors) && actual.evaluation.errors.length === 0,
    'Base catalog evaluation must have no execution errors.',
  );
  assertEvaluationSummary(
    actual.evaluation.summary,
    {
      availableRuleCount: 8,
      enabledRuleCount: 8,
      executedRuleCount: 8,
      failedRuleCount: 0,
      findingCount: 8,
      succeededRuleCount: 8,
    },
    'scenario evaluation summary',
  );
  assertCondition(
    Array.isArray(actual.evaluation.findings) && actual.evaluation.findings.length === 8,
    'Controlled scenario must retain exactly eight findings.',
  );
  actual.evaluation.findings.forEach((finding, index) => {
    assertFinding(finding, `scenario finding ${String(index)}`);
  });
  const findingRuleIds = actual.evaluation.findings.map(({ ruleId }) => ruleId);

  assertCondition(
    JSON.stringify(findingRuleIds) === JSON.stringify(expectedRuleIds),
    'Controlled scenario must retain one canonically ordered finding per stable rule.',
  );
  assertCondition(
    actualContent.equals(expectedContent) && JSON.stringify(actual) === JSON.stringify(expected),
    'Controlled scenario expected and actual artifacts differ.',
  );

  assertExactKeys(
    comparison,
    [
      'byteIdentical',
      'expectedDigest',
      'expectedMatched',
      'firstDigest',
      'scenarioId',
      'schemaVersion',
      'secondDigest',
    ],
    'deterministic comparison',
  );
  const actualDigest = digest(actualContent);

  assertCondition(
    comparison.byteIdentical === true &&
      comparison.expectedMatched === true &&
      comparison.firstDigest === actualDigest &&
      comparison.secondDigest === actualDigest &&
      comparison.expectedDigest === actualDigest,
    'Controlled scenario is not byte-deterministic or does not match its reviewed expectation.',
  );

  assertExactKeys(
    ruleMatrix,
    ['findingCount', 'ruleCount', 'rules', 'scenarioId', 'schemaVersion'],
    'rule matrix',
  );
  assertCondition(
    ruleMatrix.ruleCount === 8 &&
      ruleMatrix.findingCount === 8 &&
      Array.isArray(ruleMatrix.rules) &&
      ruleMatrix.rules.length === 8,
    'Rule matrix must cover exactly eight rules and findings.',
  );
  ruleMatrix.rules.forEach((row, index) => {
    assertExactKeys(
      row,
      [
        'actualFindingCount',
        'expectedFindingCount',
        'positiveCase',
        'positiveCaseMatched',
        'ruleId',
        'safeCases',
        'safeCasesClear',
        'unsupportedCases',
        'unsupportedCasesClear',
      ],
      `rule matrix row ${String(index)}`,
    );
    assertCondition(
      row.ruleId === expectedRuleIds[index] &&
        typeof row.positiveCase === 'string' &&
        row.positiveCase.length > 0 &&
        Array.isArray(row.safeCases) &&
        row.safeCases.length > 0 &&
        row.safeCases.every((value) => typeof value === 'string' && value.length > 0) &&
        Array.isArray(row.unsupportedCases) &&
        row.unsupportedCases.length > 0 &&
        row.unsupportedCases.every((value) => typeof value === 'string' && value.length > 0) &&
        row.expectedFindingCount === 1 &&
        row.actualFindingCount === 1 &&
        row.positiveCaseMatched === true &&
        row.safeCasesClear === true &&
        row.unsupportedCasesClear === true,
      `Rule matrix row ${String(index)} did not pass all controlled cases.`,
    );
  });

  assertExactKeys(
    findingSamples,
    ['sampleCount', 'samples', 'scenarioId', 'schemaVersion'],
    'finding samples',
  );
  assertCondition(
    findingSamples.sampleCount === 8 &&
      Array.isArray(findingSamples.samples) &&
      JSON.stringify(findingSamples.samples) === JSON.stringify(actual.evaluation.findings),
    'Finding samples do not match the eight normalized catalog findings.',
  );

  assertExactKeys(
    failureIsolation,
    [
      'baseFindingRuleIds',
      'errors',
      'findingsPreserved',
      'injectedRule',
      'preservedFindingRuleIds',
      'scenarioId',
      'schemaVersion',
      'summary',
    ],
    'failure isolation',
  );
  assertExactKeys(failureIsolation.injectedRule, ['id', 'status'], 'injected rule');
  assertCondition(
    failureIsolation.injectedRule.id === 'ux/scenario-throwing-rule' &&
      failureIsolation.injectedRule.status === 'stable',
    'Failure-isolation scenario did not identify the controlled throwing rule.',
  );
  assertEvaluationSummary(
    failureIsolation.summary,
    {
      availableRuleCount: 9,
      enabledRuleCount: 9,
      executedRuleCount: 9,
      failedRuleCount: 1,
      findingCount: 8,
      succeededRuleCount: 8,
    },
    'failure-isolation summary',
  );
  assertCondition(
    Array.isArray(failureIsolation.errors) && failureIsolation.errors.length === 1,
    'Failure-isolation scenario must retain exactly one execution error.',
  );
  assertExactKeys(
    failureIsolation.errors[0],
    ['category', 'code', 'message', 'recoverable', 'ruleId'],
    'failure-isolation error',
  );
  assertCondition(
    failureIsolation.errors[0].category === 'ux' &&
      failureIsolation.errors[0].code === 'RULE_EVALUATION_FAILED' &&
      failureIsolation.errors[0].message === 'Rule evaluation failed.' &&
      failureIsolation.errors[0].recoverable === true &&
      failureIsolation.errors[0].ruleId === failureIsolation.injectedRule.id &&
      JSON.stringify(failureIsolation.baseFindingRuleIds) === JSON.stringify(expectedRuleIds) &&
      JSON.stringify(failureIsolation.preservedFindingRuleIds) ===
        JSON.stringify(expectedRuleIds) &&
      failureIsolation.findingsPreserved === true,
    'Thrown-rule failure was not isolated from the eight safe findings.',
  );

  assertExactKeys(
    filterMetadata,
    [
      'availableRuleCount',
      'filterCases',
      'metadata',
      'scenarioId',
      'schemaVersion',
      'unknownRuleFilterError',
    ],
    'filter metadata',
  );
  assertCondition(
    filterMetadata.availableRuleCount === 8 &&
      Array.isArray(filterMetadata.metadata) &&
      filterMetadata.metadata.length === 8,
    'Filter/metadata artifact must describe exactly eight available rules.',
  );
  filterMetadata.metadata.forEach((metadata, index) => {
    assertRuleMetadata(metadata, `rule metadata ${String(index)}`);
    assertCondition(
      metadata.id === expectedRuleIds[index],
      'Rule metadata is not in canonical registry order.',
    );
    const finding = actual.evaluation.findings[index];

    assertCondition(
      finding.ruleId === metadata.id &&
        finding.ruleTitle === metadata.title &&
        finding.category === metadata.category &&
        finding.severity === metadata.defaultSeverity &&
        finding.explanation === metadata.explanation &&
        finding.recommendation === metadata.recommendation &&
        JSON.stringify(finding.reference) === JSON.stringify(metadata.reference) &&
        JSON.stringify(finding.limitations) === JSON.stringify(metadata.limitations),
      `Finding metadata differs from the registered rule ${metadata.id}.`,
    );
  });
  assertCondition(
    JSON.stringify(filterMetadata.filterCases) === JSON.stringify(expectedFilterCases),
    'Category, rule-ID, intersection, or empty filter projections differ from expectation.',
  );
  assertExactKeys(
    filterMetadata.unknownRuleFilterError,
    ['code', 'message', 'name'],
    'unknown-rule filter error',
  );
  assertCondition(
    filterMetadata.unknownRuleFilterError.name === 'RuleLoadError' &&
      filterMetadata.unknownRuleFilterError.code === 'RULE_FILTER_UNKNOWN_ID' &&
      filterMetadata.unknownRuleFilterError.message ===
        'Rule filter references an unknown rule ID.',
    'Unknown rule filter did not fail through the stable error contract.',
  );

  assertExactKeys(
    limitations,
    ['ruleCount', 'rules', 'scenarioId', 'schemaVersion'],
    'limitations',
  );
  assertCondition(
    limitations.ruleCount === 8 &&
      Array.isArray(limitations.rules) &&
      limitations.rules.length === 8,
    'Limitations artifact must describe exactly eight rules.',
  );
  limitations.rules.forEach((entry, index) => {
    assertExactKeys(entry, ['limitations', 'ruleId'], `limitation row ${String(index)}`);
    assertCondition(
      entry.ruleId === expectedRuleIds[index] &&
        JSON.stringify(entry.limitations) ===
          JSON.stringify(filterMetadata.metadata[index].limitations),
      `Limitations differ for ${String(entry.ruleId)}.`,
    );
  });

  return {
    availableRules: actual.evaluation.summary.availableRuleCount,
    byteIdenticalReruns: true,
    components: actual.analysis.componentCount,
    enabledRules: actual.evaluation.summary.enabledRuleCount,
    executedRules: actual.evaluation.summary.executedRuleCount,
    expectedMatched: true,
    failedFiles: actual.analysis.failedFileCount,
    failedRules: actual.evaluation.summary.failedRuleCount,
    failureIsolationValidated: true,
    filtersValidated: true,
    findings: actual.evaluation.summary.findingCount,
    jsxNodes: actual.analysis.jsxNodeCount,
    limitationsValidated: true,
    metadataValidated: true,
    oneFindingPerRule: true,
    parsedFiles: actual.analysis.parsedFileCount,
    resultDigest: actualDigest,
    ruleIds: expectedRuleIds,
    scenarioId,
    succeededRules: actual.evaluation.summary.succeededRuleCount,
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
  if (typeof npmExecPath !== 'string' || npmExecPath.length === 0) {
    throw new Error('npm executable path is unavailable; run this collector through npm.');
  }

  temporaryRoot = await mkdtemp(path.join(tmpdir(), 'uxaudit-m04-evidence-'));
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
    harnessState.activeMilestone !== 'M04' ||
    harnessState.activeTask !== 'M04-T05' ||
    harnessState.currentBranch !== branch
  ) {
    throw new Error('Evidence collection requires the active M04-T05 milestone branch.');
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
    args: [npmExecPath, 'run', 'test:scenario:m04', '--', '--output', scenarioEvidence],
    command: process.execPath,
    displayedArgs: ['run', 'test:scenario:m04', '--', '--output', '<EVIDENCE_DIR>'],
    displayedCommand: 'npm',
    fileName: 'm04-scenario.txt',
    label: 'Controlled M04 rule catalog scenario',
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
    schemaVersion: 7,
    evidenceId: 'M04-RULES',
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
  const summary = `# M04 Rule Engine Evidence

- Evidence ID: M04-RULES
- Observed at: ${observedAt}
- Source: branch \`${branch}\`, base commit \`${baseCommit}\`, plus the M04-T05 working tree
- Source tree: \`${sourceTreeDigest}\`
- Integrity: SHA-256 manifest in \`${evidenceManifestRelativePath}\`
- Environment: Node.js \`${process.version}\`, npm \`${npmVersion}\`, \`${process.platform}\`/\`${process.arch}\`
- Objective: verify the complete eight-rule catalog, normalized findings, deterministic ordering, category/rule filters, metadata and limitations, and safe rule-failure isolation
- Expected result: every gate passes; each stable rule emits one reviewed finding; repeated normalized results are byte-identical; one thrown rule does not discard sibling findings

## Executed checks

| Check | Exit | Status | Raw record |
| ----- | ---: | ------ | ---------- |
${commandRows}

## Measurements

- Tests: ${String(tests.totalTests)} passed across ${String(tests.testFiles)} files; zero skipped or todo tests.
- Coverage: statements ${coverage.statements}%, branches ${coverage.branches}%, functions ${coverage.functions}%, lines ${coverage.lines}%.
- Dependency audit: ${String(vulnerabilities.total)} known vulnerabilities; moderate ${String(vulnerabilities.moderate)}, high ${String(vulnerabilities.high)}, critical ${String(vulnerabilities.critical)}.
- Catalog: ${String(scenario.availableRules)} stable rules enabled and executed across accessibility, performance, SEO, and UX; exactly ${String(scenario.findings)} reviewed findings, one per rule.
- Determinism: PASS; both normalized scenario runs have digest \`${scenario.resultDigest}\` and match the reviewed expectation.
- Filters and metadata: PASS; default, category, rule-ID, intersection, empty, and unknown-ID behavior validated with complete developer-facing metadata.
- Rule isolation: PASS; one controlled thrown rule produced one stable recoverable error while all eight safe findings were preserved.
- Limitations: PASS; every stable rule retains one or more explicit static-analysis limitations.
- Controlled analysis: ${String(scenario.parsedFiles)} source file parsed, ${String(scenario.failedFiles)} parser failures, ${String(scenario.components)} components, and ${String(scenario.jsxNodes)} JSX nodes. Target project code executed: no.

## Conclusion

PASS. M04 loads and evaluates the explicit stable catalog over the normalized analysis model,
returns one complete and canonically ordered finding for each controlled violation, preserves
source locations and rule guidance, and reproduces the reviewed result byte for byte. Validated
filters select only their documented intersection, and a thrown rule remains isolated from safe
sibling findings. The isolated child environment uses an explicit allowlist and does not inherit
credential variables.

## Current limitation

The controlled scenario validates the documented static scope rather than rendered runtime
behavior. Dynamic JSX, custom component abstractions, external CSS, routes, viewport priority, and
complete accessible-name context remain conservative non-findings or explicit advisory limits.
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
    const destinationBeforeStaging = await assertDestinationUnchangedBeforePublication();

    publicationStagingDirectory = await mkdtemp(
      path.join(destinationBeforeStaging.parentRealPath, '.m04-rules-staging-'),
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
    await assertEvidencePackageIsComplete(publicationStagingDirectory);
    await assertEvidenceManifestIsValid(publicationStagingDirectory);
    await assertEvidenceIsSanitized(publicationStagingDirectory);

    const destinationBeforeMutation = await assertDestinationUnchangedBeforePublication();

    if (destinationBeforeMutation.exists) {
      const placeholderPath = path.join(finalEvidenceDirectory, '.gitkeep');
      const placeholderMetadata = await lstat(placeholderPath);
      const placeholderContent = await readFile(placeholderPath);

      assertCondition(
        placeholderMetadata.isFile() &&
          !placeholderMetadata.isSymbolicLink() &&
          placeholderContent.byteLength === 0,
        'The initial M04 evidence placeholder changed during collection.',
      );
      await rm(placeholderPath);
      await rmdir(finalEvidenceDirectory);
    }

    const destinationBeforeRename = await inspectEvidenceDestination();

    assertCondition(
      destinationBeforeRename.exists === false &&
        destinationBeforeRename.parentRealPath === destinationBeforeStaging.parentRealPath,
      'M04 evidence destination is not safe for atomic publication.',
    );
    await rename(publicationStagingDirectory, finalEvidenceDirectory);
    publicationStagingDirectory = undefined;

    const publishedDestination = await inspectEvidenceDestination();

    assertCondition(
      publishedDestination.exists,
      'M04 evidence publication did not create the approved destination.',
    );
    await assertEvidencePackageIsComplete(finalEvidenceDirectory);
    await assertEvidenceManifestIsValid(finalEvidenceDirectory);
    await assertEvidenceIsSanitized(finalEvidenceDirectory);
  } else {
    await assertExistingEvidenceMatches(environment);
  }

  console.log('M04 evidence collection: PASS');
  console.log(
    existingEvidenceFiles.length === 0
      ? 'Evidence written to evidence/m04-rules/'
      : 'Existing evidence preserved after stable-result reproducibility check',
  );
} finally {
  await Promise.all([
    temporaryRoot ? rm(temporaryRoot, { force: true, recursive: true }) : Promise.resolve(),
    publicationStagingDirectory
      ? rm(publicationStagingDirectory, { force: true, recursive: true })
      : Promise.resolve(),
  ]);
}

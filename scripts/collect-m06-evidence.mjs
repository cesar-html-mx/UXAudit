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
import { availableParallelism, homedir, release, tmpdir, totalmem } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { isDeepStrictEqual } from 'node:util';

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
} from './m06-evidence-contract.mjs';
import { getPublicDocumentationCopyDecision } from './public-documentation-source-filter.mjs';

const rootDirectory = process.cwd();
const finalEvidenceDirectory = path.join(rootDirectory, 'evidence', 'm06-validation');
const evidenceParentDirectory = path.dirname(finalEvidenceDirectory);
const npmExecPath = process.env.npm_execpath;
const vitestResultsRelativePath = 'coverage/vitest-results.json';
const jsonFormatOptions = {
  endOfLine: 'lf',
  parser: 'json',
  printWidth: 100,
};
const initialTemplateContent =
  'rule_id,true_positives,false_positives,true_negatives,false_negatives,precision,recall,unsupported,unsupported_detected,unmatched_findings,notes,corrective_action\n';
let childTemporaryDirectory;
let isolatedWorkspace;
let npmCacheDirectory;
let npmGlobalConfig;
let npmUserConfig;
let publicationStagingDirectory;
let rawEvidence;
let scenarioEvidence;
let accuracyEvidence;
let robustnessEvidence;
let usabilityEvidence;
let measurementEvidence;
let temporaryEvidence;
let temporaryRoot;
let vitestResultsPath;
let initialPlaceholderPresent;
let initialDestinationPresent;
let sensitivePathValues = [rootDirectory, homedir()].filter(Boolean);

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
const generatedWorkspaceRelativePaths = ['.husky/_', 'coverage', 'dist', 'node_modules'];
const stableResultRelativePaths = [
  'activity3/IMPLEMENTATION_SUMMARY.md',
  'activity3/TESTING_SUMMARY.md',
  'accuracy/accuracy-by-rule.csv',
  'accuracy/accuracy-cases.csv',
  'accuracy/accuracy-comparison.json',
  'accuracy/accuracy-ground-truth.json',
  'accuracy/accuracy-results.json',
  'accuracy/accuracy-unsupported.json',
  'defects/defects-and-corrections.json',
  'measurements/coverage-summary.json',
  'measurements/test-summary.json',
  'robustness/deterministic-security-comparison.json',
  'robustness/html-injection-validation.json',
  'robustness/robustness-cases.csv',
  'robustness/security-checklist.json',
  'scenario/controlled-projects-actual.json',
  'scenario/controlled-projects-expected.json',
  'scenario/controlled-projects-manifest.json',
  'scenario/deterministic-comparison.json',
  'scenario/invalid-audit-report.normalized.html',
  'scenario/invalid-audit-report.normalized.json',
  'scenario/invalid-terminal-report.normalized.txt',
  'unsupported/unexecuted-checks.json',
  'usability/usability-status.json',
];
const stableRuleIds = [
  'accessibility/button-name',
  'accessibility/img-alt',
  'accessibility/input-label',
  'performance/img-dimensions',
  'performance/img-lazy-loading',
  'seo/ambiguous-link-text',
  'seo/multiple-h1',
  'ux/small-inline-text',
];
const expectedTruePositivesByRule = {
  'accessibility/button-name': 1,
  'accessibility/img-alt': 1,
  'accessibility/input-label': 2,
  'performance/img-dimensions': 1,
  'performance/img-lazy-loading': 2,
  'seo/ambiguous-link-text': 2,
  'seo/multiple-h1': 1,
  'ux/small-inline-text': 1,
};
const scenarioExpectations = [
  {
    failedFiles: 0,
    findings: 0,
    id: 'valid-project',
    parsedFiles: 1,
    parserErrors: 0,
    selectedFiles: 1,
  },
  {
    failedFiles: 0,
    findings: 8,
    id: 'invalid-project',
    parsedFiles: 1,
    parserErrors: 0,
    selectedFiles: 1,
  },
  {
    failedFiles: 1,
    findings: 3,
    id: 'mixed-project',
    parsedFiles: 4,
    parserErrors: 1,
    selectedFiles: 5,
  },
  {
    failedFiles: 0,
    findings: 1,
    id: 'hostile-project',
    parsedFiles: 2,
    parserErrors: 0,
    selectedFiles: 2,
  },
  {
    failedFiles: 0,
    findings: 0,
    id: 'large-project',
    parsedFiles: 240,
    parserErrors: 0,
    selectedFiles: 240,
  },
];
const robustnessCaseIds = [
  'canonical-project-root',
  'missing-project-root',
  'missing-project-argument',
  'invalid-configuration',
  'output-path-escape',
  'symlink-output-escape',
  'exclusive-report-write',
  'malformed-source-isolation',
  'deep-project-traversal',
  'symlink-policy',
  'hostile-html-structure',
  'deterministic-hostile-rerun',
  'inaccessible-project-root',
  'unwritable-report-output',
  'performance-large-project',
];
const allowedRobustnessStatusesById = Object.fromEntries(
  robustnessCaseIds.map((id) => [id, ['passed']]),
);
allowedRobustnessStatusesById['symlink-output-escape'] = ['passed', 'unsupported'];
allowedRobustnessStatusesById['symlink-policy'] = ['passed', 'unsupported'];
allowedRobustnessStatusesById['inaccessible-project-root'] = ['passed', 'not-executed'];
allowedRobustnessStatusesById['unwritable-report-output'] = ['passed', 'not-executed'];
const securityCheckIds = [
  'project-root-canonicalization',
  'output-path-boundary',
  'symlink-output-authorization',
  'exclusive-report-write',
  'malformed-source-isolation',
  'deep-project-behavior',
  'symlink-loop-and-escape',
  'html-injection-and-csp',
  'deterministic-rerun',
  'target-code-non-execution',
  'project-root-permission-failure',
  'report-output-permission-failure',
  'dependency-lock-and-install-policy',
  'dependency-audit-moderate',
  'codeql-hosted-analysis',
  'secrets-telemetry-production-services',
];
const allowedSecurityStatusesById = Object.fromEntries(
  securityCheckIds.map((id) => [id, ['passed']]),
);
allowedSecurityStatusesById['symlink-output-authorization'] = ['passed', 'unsupported'];
allowedSecurityStatusesById['symlink-loop-and-escape'] = ['passed', 'unsupported'];
allowedSecurityStatusesById['project-root-permission-failure'] = ['passed', 'not-executed'];
allowedSecurityStatusesById['report-output-permission-failure'] = ['passed', 'not-executed'];
allowedSecurityStatusesById['codeql-hosted-analysis'] = ['unexecuted'];
allowedSecurityStatusesById['secrets-telemetry-production-services'] = ['reviewed'];
const heuristicTaskExpectations = [
  { helpUsed: true, id: 'discover-scan', severity: 'none' },
  { helpUsed: false, id: 'analyze-project', severity: 'none' },
  { helpUsed: false, id: 'identify-highest-priority', severity: 'low' },
  { helpUsed: false, id: 'locate-source', severity: 'none' },
  { helpUsed: false, id: 'understand-recommendation', severity: 'none' },
  { helpUsed: false, id: 'find-json-html-reports', severity: 'none' },
];

const compareNames = (left, right) =>
  left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
const toPortablePath = (value) => value.split(path.sep).join('/');
const isFileSystemError = (error) => typeof error === 'object' && error !== null && 'code' in error;
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isNonNegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const valuesMatch = (left, right) => isDeepStrictEqual(left, right);
const assertCondition = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};
const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));
const writeCanonicalJson = async (filePath, value) => {
  await writeFile(
    filePath,
    await format(JSON.stringify(value, null, 2), jsonFormatOptions),
    'utf8',
  );
};

const isInitialPlaceholderSet = async (files) => {
  if (files.length !== 2) {
    return false;
  }

  const relativePaths = files
    .map((filePath) => toPortablePath(path.relative(finalEvidenceDirectory, filePath)))
    .toSorted();

  if (
    JSON.stringify(relativePaths) !== JSON.stringify(['.gitkeep', 'CONFUSION_MATRIX_TEMPLATE.csv'])
  ) {
    return false;
  }

  const [gitkeep, template] = await Promise.all([
    readFile(path.join(finalEvidenceDirectory, '.gitkeep')),
    readFile(path.join(finalEvidenceDirectory, 'CONFUSION_MATRIX_TEMPLATE.csv'), 'utf8'),
  ]);

  return gitkeep.byteLength === 0 && template === initialTemplateContent;
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

  assertCondition(
    evidenceParentRealPath === path.join(rootRealPath, 'evidence'),
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
    'M06 evidence destination must be a regular directory and must not be a symbolic link.',
  );

  const destinationRealPath = await realpath(finalEvidenceDirectory);

  assertCondition(
    destinationRealPath === path.join(evidenceParentRealPath, 'm06-validation') &&
      isStrictlyContainedPath(evidenceParentRealPath, destinationRealPath),
    'M06 evidence destination resolves outside its approved parent.',
  );

  const files = await findEvidenceFiles(finalEvidenceDirectory);

  for (const filePath of files) {
    const [fileMetadata, fileRealPath] = await Promise.all([lstat(filePath), realpath(filePath)]);

    assertCondition(
      fileMetadata.isFile() &&
        !fileMetadata.isSymbolicLink() &&
        isStrictlyContainedPath(destinationRealPath, fileRealPath),
      'M06 evidence contains a non-regular file or a path outside the approved destination.',
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
      currentDestination.exists && (await isInitialPlaceholderSet(currentDestination.files)),
      'The initial M06 evidence templates changed during collection.',
    );
  } else {
    assertCondition(
      initialDestinationPresent === false && currentDestination.exists === false,
      'The M06 evidence destination appeared or changed during collection.',
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
  const [content, lockDocument] = await Promise.all([
    readFile(path.join(rootDirectory, '.npmrc'), 'utf8'),
    readJson(path.join(rootDirectory, 'package-lock.json')),
  ]);

  if (
    /(?:_auth|authToken|authorization|password|username)\s*=/iu.test(content) ||
    /https?:\/\/[^/\s:@]+:[^@\s/]+@/iu.test(content)
  ) {
    throw new Error('Project npm configuration contains credential-bearing settings.');
  }

  const inspectLockValue = (value) => {
    if (typeof value === 'string') {
      let parsedUrl;

      if (/^https?:\/\//iu.test(value)) {
        try {
          parsedUrl = new URL(value);
        } catch {
          throw new Error('Package lock contains an invalid HTTP(S) URL.');
        }
      }

      if (
        (parsedUrl !== undefined && (parsedUrl.username !== '' || parsedUrl.password !== '')) ||
        /[?&](?:access_token|auth|password|token)=[^&\s]+/iu.test(value) ||
        /(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,}|\bsk-[A-Za-z0-9_-]{20,}\b|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b)/u.test(
          value,
        )
      ) {
        throw new Error('Package lock contains a credential-bearing URL.');
      }

      return;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        inspectLockValue(entry);
      }

      return;
    }

    if (isRecord(value)) {
      for (const entry of Object.values(value)) {
        inspectLockValue(entry);
      }
    }
  };

  inspectLockValue(lockDocument);
};

const childEnvironment = () => {
  const runtimePath = path.dirname(process.execPath);
  const executableSearchPaths =
    process.platform === 'win32'
      ? [
          runtimePath,
          process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32') : undefined,
          process.env.SystemRoot,
        ]
      : [runtimePath, '/usr/local/bin', '/usr/bin', '/bin'];
  const environment = {
    CI: 'true',
    FORCE_COLOR: '0',
    HUSKY: '0',
    NO_COLOR: '1',
    PATH: executableSearchPaths.filter(Boolean).join(path.delimiter),
    TEMP: childTemporaryDirectory,
    TMP: childTemporaryDirectory,
    TMPDIR: childTemporaryDirectory,
    npm_config_audit: 'false',
    npm_config_cache: npmCacheDirectory,
    npm_config_fund: 'false',
    npm_config_globalconfig: npmGlobalConfig,
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
    child.on('close', (exitCode, signal) => {
      resolve({ exitCode: exitCode ?? -1, signal, stderr, stdout });
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
    `Observed signal: ${result.signal ?? 'none'}`,
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

  const passed = expectedExitCodes.includes(result.exitCode) && result.signal === null;

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
    'The isolated source snapshot changed while the M06 gates were running.',
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
      Number.isSafeInteger(totalTests) &&
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

const assertCanonicalJsonFile = async (directory, fileName) => {
  const content = await readFile(path.join(directory, fileName), 'utf8');
  const value = JSON.parse(content);

  assertCondition(
    content === (await format(JSON.stringify(value, null, 2), jsonFormatOptions)),
    `Artifact JSON is not canonically formatted: ${fileName}`,
  );

  assertCondition(isRecord(value), `${fileName} must contain one JSON object.`);
  return value;
};

const readAndValidateScenario = async (directory) => {
  const [actual, expected, manifest, comparison, report] = await Promise.all([
    assertCanonicalJsonFile(directory, 'controlled-projects-actual.json'),
    assertCanonicalJsonFile(directory, 'controlled-projects-expected.json'),
    assertCanonicalJsonFile(directory, 'controlled-projects-manifest.json'),
    assertCanonicalJsonFile(directory, 'deterministic-comparison.json'),
    assertCanonicalJsonFile(directory, 'invalid-audit-report.normalized.json'),
  ]);

  assertCondition(
    actual.scenarioId === 'M06-CONTROLLED-PROJECTS' &&
      expected.scenarioId === 'M06-CONTROLLED-PROJECTS' &&
      manifest.corpusId === 'M06-CONTROLLED-PROJECTS' &&
      comparison.scenarioId === 'M06-CONTROLLED-PROJECTS',
    'Controlled-project scenario identity is invalid.',
  );
  assertCondition(
    comparison.byteIdentical === true &&
      comparison.manifestExpectationsAsserted === true &&
      comparison.projectOrderMatched === true,
    'Controlled-project scenario is not deterministic or did not assert its manifest.',
  );
  assertCondition(
    Array.isArray(actual.projects) &&
      actual.projects.length === 5 &&
      Array.isArray(expected.projects) &&
      expected.projects.length === 5,
    'Controlled-project scenario does not contain five projects.',
  );
  assertCondition(
    valuesMatch(
      actual.projects.map(({ id }) => id),
      scenarioExpectations.map(({ id }) => id),
    ) &&
      valuesMatch(
        expected.projects.map(({ id }) => id),
        scenarioExpectations.map(({ id }) => id),
      ) &&
      valuesMatch(manifest.stableRuleIds, stableRuleIds),
    'Controlled-project scenario does not use the exact reviewed project and rule order.',
  );

  for (const expectation of scenarioExpectations) {
    const observedProject = actual.projects.find(({ id }) => id === expectation.id);
    const expectedProject = expected.projects.find(({ id }) => id === expectation.id);
    const errors = observedProject?.audit?.errors;
    const parserErrors = Array.isArray(errors)
      ? errors.filter(({ stage }) => stage === 'parse').length
      : undefined;

    assertCondition(
      observedProject?.audit?.summary?.findings?.total === expectation.findings &&
        observedProject.audit.summary.files?.selected === expectation.selectedFiles &&
        observedProject.audit.summary.files?.parsed === expectation.parsedFiles &&
        observedProject.audit.summary.files?.failed === expectation.failedFiles &&
        Array.isArray(errors) &&
        errors.length === expectation.parserErrors &&
        parserErrors === expectation.parserErrors &&
        observedProject.cli?.exitCode === 0 &&
        observedProject.cli?.stderr === '' &&
        observedProject.reports?.htmlExact === true &&
        observedProject.reports?.jsonExact === true &&
        observedProject.reports?.terminalExact === true &&
        observedProject.safety?.projectRootMatched === true &&
        observedProject.safety?.targetCodeExecuted === false &&
        expectedProject?.expected?.totalFindings === expectation.findings &&
        expectedProject.expected.sourceCandidateCount === expectation.selectedFiles &&
        expectedProject.expected.parsedFileCount === expectation.parsedFiles &&
        expectedProject.expected.failedFileCount === expectation.failedFiles &&
        Array.isArray(expectedProject.expected.parserErrors) &&
        expectedProject.expected.parserErrors.length === expectation.parserErrors,
      `Controlled-project scenario has unexpected quantitative results for ${expectation.id}.`,
    );
  }
  assertCondition(
    report.schemaVersion === '1.0.0' &&
      report.projectRoot === '<PROJECT_ROOT>' &&
      Array.isArray(report.findings),
    'Retained invalid-project report is malformed.',
  );

  for (const fileName of [
    'invalid-audit-report.normalized.html',
    'invalid-terminal-report.normalized.txt',
  ]) {
    const content = await readFile(path.join(directory, fileName), 'utf8');

    assertCondition(
      content.length > 0 && !content.includes('\r'),
      `Retained scenario sample is empty or non-portable: ${fileName}`,
    );
  }

  return {
    deterministic: true,
    findingsByProject: Object.fromEntries(
      actual.projects.map(({ audit, id }) => [id, audit.summary.findings.total]),
    ),
    parserErrorsByProject: Object.fromEntries(
      actual.projects.map(({ audit, id }) => [
        id,
        audit.errors.filter(({ stage }) => stage === 'parse').length,
      ]),
    ),
    projects: actual.projects.length,
  };
};

const renderCsv = (rows) => {
  const cell = (value) => {
    const text = value === null || value === undefined ? '' : String(value);

    return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };

  return `${rows.map((row) => row.map(cell).join(',')).join('\n')}\n`;
};

const readAndValidateAccuracy = async (directory) => {
  const [results, comparison, unsupported, groundTruth] = await Promise.all([
    assertCanonicalJsonFile(directory, 'accuracy-results.json'),
    assertCanonicalJsonFile(directory, 'accuracy-comparison.json'),
    assertCanonicalJsonFile(directory, 'accuracy-unsupported.json'),
    assertCanonicalJsonFile(directory, 'accuracy-ground-truth.json'),
  ]);

  assertCondition(
    results.scenarioId === 'M06-RULE-ACCURACY' &&
      comparison.scenarioId === 'M06-RULE-ACCURACY' &&
      unsupported.scenarioId === 'M06-RULE-ACCURACY' &&
      results.expectedMatched === true &&
      comparison.expectedMatched === true,
    'Accuracy evidence does not match the reviewed ground truth.',
  );
  assertCondition(
    Array.isArray(results.metrics) &&
      results.metrics.length === 8 &&
      Array.isArray(results.instanceObservations) &&
      results.instanceObservations.length === 27 &&
      results.caseCounts?.positive === 11 &&
      results.caseCounts?.negative === 8 &&
      results.caseCounts?.unsupported === 8 &&
      Array.isArray(results.findingIdentities) &&
      results.findingIdentities.length === 11 &&
      Array.isArray(results.unmatchedFindings) &&
      results.unmatchedFindings.length === 0 &&
      Array.isArray(unsupported.cases) &&
      unsupported.cases.length === 8 &&
      unsupported.detectedCount === 0 &&
      Array.isArray(comparison.caseMismatches) &&
      comparison.caseMismatches.length === 0 &&
      Array.isArray(comparison.metricMismatches) &&
      comparison.metricMismatches.length === 0 &&
      comparison.unmatchedFindingCount === 0 &&
      comparison.unsupportedDetectedCount === 0 &&
      Array.isArray(groundTruth.instances) &&
      groundTruth.instances.length === 27 &&
      valuesMatch(groundTruth.stableRuleIds, stableRuleIds),
    'Accuracy evidence has incomplete rule/case results.',
  );

  assertCondition(
    valuesMatch(
      results.metrics.map(({ ruleId }) => ruleId),
      stableRuleIds,
    ) &&
      results.metrics.every(
        ({
          falseNegativeCount,
          falsePositiveCount,
          precision,
          recall,
          ruleId,
          trueNegativeCount,
          truePositiveCount,
          unmatchedFindingCount,
          unsupportedCount,
          unsupportedDetectedCount,
        }) =>
          expectedTruePositivesByRule[ruleId] === truePositiveCount &&
          falsePositiveCount === 0 &&
          trueNegativeCount === 1 &&
          falseNegativeCount === 0 &&
          unsupportedCount === 1 &&
          unsupportedDetectedCount === 0 &&
          unmatchedFindingCount === 0 &&
          precision === 1 &&
          recall === 1,
      ),
    'Accuracy evidence does not contain the exact reviewed per-rule confusion matrices.',
  );

  const counts = results.metrics.reduce(
    (total, metrics) => ({
      falseNegatives: total.falseNegatives + metrics.falseNegativeCount,
      falsePositives: total.falsePositives + metrics.falsePositiveCount,
      trueNegatives: total.trueNegatives + metrics.trueNegativeCount,
      truePositives: total.truePositives + metrics.truePositiveCount,
      unsupported: total.unsupported + metrics.unsupportedCount,
    }),
    {
      falseNegatives: 0,
      falsePositives: 0,
      trueNegatives: 0,
      truePositives: 0,
      unsupported: 0,
    },
  );

  assertCondition(
    counts.truePositives === 11 &&
      counts.falsePositives === 0 &&
      counts.trueNegatives === 8 &&
      counts.falseNegatives === 0 &&
      counts.unsupported === 8,
    'Controlled accuracy does not contain the exact reviewed confusion-matrix totals.',
  );

  const [metricsCsv, casesCsv] = await Promise.all([
    readFile(path.join(directory, 'accuracy-by-rule.csv'), 'utf8'),
    readFile(path.join(directory, 'accuracy-cases.csv'), 'utf8'),
  ]);
  const expectedMetricsCsv = renderCsv([
    [
      'rule_id',
      'true_positives',
      'false_positives',
      'true_negatives',
      'false_negatives',
      'precision',
      'recall',
      'unsupported',
      'unsupported_detected',
      'unmatched_findings',
      'notes',
      'corrective_action',
    ],
    ...results.metrics.map((row) => [
      row.ruleId,
      row.truePositiveCount,
      row.falsePositiveCount,
      row.trueNegativeCount,
      row.falseNegativeCount,
      row.precision === null ? null : row.precision.toFixed(6),
      row.recall === null ? null : row.recall.toFixed(6),
      row.unsupportedCount,
      row.unsupportedDetectedCount,
      row.unmatchedFindingCount,
      'Controlled instance-level static cases; unsupported cases are excluded from denominators.',
      'None; observed findings matched the reviewed ground truth.',
    ]),
  ]);
  const expectedCasesCsv = renderCsv([
    [
      'project_id',
      'rule_id',
      'case_id',
      'classification',
      'detected',
      'expected_detected',
      'outcome',
      'matched_finding_count',
      'rationale',
    ],
    ...results.instanceObservations.map((observation) => [
      observation.projectId,
      observation.ruleId,
      observation.caseId,
      observation.classification,
      observation.detected,
      observation.expectedDetected,
      observation.outcome,
      observation.matchedFindings.length,
      observation.rationale,
    ]),
  ]);

  assertCondition(
    metricsCsv === expectedMetricsCsv &&
      casesCsv === expectedCasesCsv &&
      !metricsCsv.includes('\r') &&
      !casesCsv.includes('\r'),
    'Accuracy CSV artifacts do not exactly represent the validated JSON results.',
  );

  return {
    ...counts,
    expectedMatched: true,
    rules: results.metrics.length,
  };
};

const renderQuotedCsv = (rows, fields) => {
  const escapeCell = (value) => {
    const text = value === null || value === undefined ? '' : String(value);

    return `"${text.replaceAll('"', '""')}"`;
  };

  return `${[
    fields.map(escapeCell).join(','),
    ...rows.map((row) => fields.map((field) => escapeCell(row[field])).join(',')),
  ].join('\n')}\n`;
};

const readAndValidateRobustness = async (directory) => {
  const [system, performance, security, xss, deterministic] = await Promise.all([
    assertCanonicalJsonFile(directory, 'system-robustness.json'),
    assertCanonicalJsonFile(directory, 'performance-baseline.json'),
    assertCanonicalJsonFile(directory, 'security-checklist.json'),
    assertCanonicalJsonFile(directory, 'html-injection-validation.json'),
    assertCanonicalJsonFile(directory, 'deterministic-security-comparison.json'),
  ]);

  assertCondition(
    system.scenarioId === 'M06-SYSTEM-ROBUSTNESS-SECURITY-PERFORMANCE' &&
      performance.scenarioId === 'M06-SYSTEM-ROBUSTNESS-SECURITY-PERFORMANCE' &&
      security.scenarioId === 'M06-SYSTEM-ROBUSTNESS-SECURITY-PERFORMANCE',
    'Robustness evidence has an invalid scenario identity.',
  );
  assertCondition(
    Array.isArray(system.cases) &&
      system.cases.length === 15 &&
      valuesMatch(
        system.cases.map(({ id }) => id),
        robustnessCaseIds,
      ) &&
      system.cases.every(({ id, objective, observation, status }) => {
        const allowedStatuses = allowedRobustnessStatusesById[id];

        return (
          Array.isArray(allowedStatuses) &&
          allowedStatuses.includes(status) &&
          typeof objective === 'string' &&
          objective.length > 0 &&
          isRecord(observation)
        );
      }),
    'Robustness evidence does not contain the exact 15 reviewed cases and statuses.',
  );
  assertCondition(
    performance.summary?.runCount === 5 &&
      performance.summary?.scale?.sourceFileCount === 240 &&
      performance.summary?.scale?.componentCount === 240 &&
      Array.isArray(performance.samples) &&
      performance.samples.length === 5 &&
      performance.samples.every(
        ({ durationMs, peakRssBytes, run }, index) =>
          run === index + 1 &&
          isFiniteNumber(durationMs) &&
          durationMs >= 0 &&
          (process.platform === 'linux'
            ? isNonNegativeInteger(peakRssBytes)
            : peakRssBytes === null),
      ) &&
      performance.summary.durations?.values?.length === 5 &&
      performance.summary.durations.values.every(
        (duration) => isFiniteNumber(duration) && duration >= 0,
      ),
    'Performance evidence does not contain five complete 240-file runs.',
  );
  assertCondition(
    performance.summary.peakRss?.measurement ===
      (process.platform === 'linux' ? 'observed-linux-proc' : 'unavailable'),
    'Performance memory measurement does not match the execution platform.',
  );
  assertCondition(
    deterministic.hostileHtmlMatched === true &&
      deterministic.hostileStableJsonMatched === true &&
      xss.contentSecurityPolicyMatched === true &&
      xss.executableOrResourceTagsAbsent === true &&
      xss.hostilePathEscaped === true &&
      xss.rawControlCharactersAbsent === true,
    'Security determinism or structural XSS assertions did not pass.',
  );
  assertCondition(
    security.codeqlConclusion.includes('Unexecuted') &&
      Array.isArray(security.checks) &&
      security.checks.length === securityCheckIds.length &&
      valuesMatch(
        security.checks.map(({ id }) => id),
        securityCheckIds,
      ) &&
      security.checks.every(({ evidence, id, status }) => {
        const allowedStatuses = allowedSecurityStatusesById[id];

        return (
          Array.isArray(allowedStatuses) &&
          allowedStatuses.includes(status) &&
          typeof evidence === 'string' &&
          evidence.length > 0
        );
      }) &&
      security.dependencyAudit?.exitCode === 0 &&
      security.dependencyAudit?.vulnerabilities?.moderate === 0 &&
      security.dependencyAudit?.vulnerabilities?.high === 0 &&
      security.dependencyAudit?.vulnerabilities?.critical === 0,
    'Security checklist does not contain the expected dependency/CodeQL status.',
  );

  const casesById = new Map(system.cases.map((testCase) => [testCase.id, testCase]));
  const observationsMatch =
    casesById.get('canonical-project-root')?.observation?.exitCode === 0 &&
    casesById.get('canonical-project-root')?.observation?.canonicalRootMatched === true &&
    casesById.get('missing-project-root')?.observation?.exitCode === 2 &&
    casesById.get('missing-project-argument')?.observation?.exitCode === 2 &&
    casesById.get('missing-project-argument')?.observation?.stableCommanderDiagnostic === true &&
    casesById.get('invalid-configuration')?.observation?.exitCode === 2 &&
    casesById.get('invalid-configuration')?.observation?.reportsCreated === false &&
    casesById.get('output-path-escape')?.observation?.exitCode === 2 &&
    casesById.get('output-path-escape')?.observation?.outsideReportCreated === false &&
    casesById.get('exclusive-report-write')?.observation?.exitCode === 3 &&
    casesById.get('exclusive-report-write')?.observation?.digestUnchanged === true &&
    casesById.get('malformed-source-isolation')?.observation?.failedFiles === 1 &&
    casesById.get('malformed-source-isolation')?.observation?.findings === 3 &&
    casesById.get('malformed-source-isolation')?.observation?.parsedFiles === 4 &&
    casesById.get('deep-project-traversal')?.observation?.nestedDirectoryCount === 32 &&
    casesById.get('deep-project-traversal')?.observation?.findingCount === 0 &&
    casesById.get('deep-project-traversal')?.observation?.parsedFiles === 1 &&
    casesById.get('hostile-html-structure')?.observation?.cspMatched === true &&
    casesById.get('hostile-html-structure')?.observation?.escapedHostilePath === true &&
    casesById.get('hostile-html-structure')?.observation?.structuralValidationOnly === true &&
    casesById.get('deterministic-hostile-rerun')?.observation?.htmlMatched === true &&
    casesById.get('deterministic-hostile-rerun')?.observation?.stableJsonMatched === true &&
    casesById.get('performance-large-project')?.observation?.runCount === 5 &&
    casesById.get('performance-large-project')?.observation?.sourceFileCount === 240;

  assertCondition(
    observationsMatch,
    'Robustness evidence is missing required exit-code, isolation, security, or scale observations.',
  );

  for (const id of ['symlink-output-escape', 'symlink-policy']) {
    const testCase = casesById.get(id);

    assertCondition(
      testCase?.status === 'passed'
        ? id === 'symlink-output-escape'
          ? testCase.observation?.exitCode === 3 &&
            testCase.observation?.outsideReportCreated === false &&
            testCase.observation?.outsideSentinelUnchanged === true
          : testCase.observation?.createdLinks === 3 &&
            Array.isArray(testCase.observation?.linkObservations) &&
            testCase.observation.linkObservations.length === 3 &&
            testCase.observation?.findings === 1
        : typeof testCase?.observation?.reason === 'string',
      `Robustness evidence has an invalid portable link observation for ${id}.`,
    );
  }

  for (const [id, expectedExitCode] of [
    ['inaccessible-project-root', 2],
    ['unwritable-report-output', 3],
  ]) {
    const testCase = casesById.get(id);

    assertCondition(
      testCase?.status === 'passed'
        ? testCase.observation?.exitCode === expectedExitCode
        : typeof testCase?.observation?.reason === 'string' &&
            typeof testCase.observation?.substituteEvidence === 'string',
      `Robustness evidence has an invalid permission observation for ${id}.`,
    );
  }

  const [casesCsv, performanceCsv] = await Promise.all([
    readFile(path.join(directory, 'robustness-cases.csv'), 'utf8'),
    readFile(path.join(directory, 'performance-runs.csv'), 'utf8'),
  ]);

  assertCondition(
    casesCsv ===
      renderQuotedCsv(
        system.cases.map(({ id, objective, status }) => ({ id, objective, status })),
        ['id', 'objective', 'status'],
      ) &&
      performanceCsv ===
        renderQuotedCsv(performance.samples, ['run', 'durationMs', 'peakRssBytes']) &&
      !casesCsv.includes('\r') &&
      !performanceCsv.includes('\r'),
    'Robustness CSV artifacts do not exactly represent the validated JSON observations.',
  );

  return {
    cases: system.cases.length,
    codeql: 'unexecuted',
    failedCases: system.cases.filter(({ status }) => status === 'failed').length,
    memoryMeasurement: performance.summary.peakRss.measurement,
    performanceRuns: performance.summary.runCount,
    sourceFiles: performance.summary.scale.sourceFileCount,
  };
};

const renderHeuristicReviewCsv = (tasks) => {
  const fields = [
    'order',
    'id',
    'completed',
    'expertProcedureDurationMs',
    'errors',
    'backtrackingCount',
    'helpUsed',
    'severity',
    'observation',
    'correctiveAction',
  ];
  const escapeCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = tasks.map((task) => ({
    ...task,
    errors: task.errors.join(' | '),
  }));

  return `${[
    fields.map(escapeCell).join(','),
    ...rows.map((row) => fields.map((field) => escapeCell(row[field])).join(',')),
  ].join('\n')}\n`;
};

const readAndValidateUsability = async (directory) => {
  const [review, status] = await Promise.all([
    assertCanonicalJsonFile(directory, 'heuristic-review.json'),
    assertCanonicalJsonFile(directory, 'usability-status.json'),
  ]);
  const reviewKeys = ['executedAt', 'method', 'reviewId', 'schemaVersion', 'summary', 'tasks'];
  const statusKeys = [
    'expertHeuristicReview',
    'participantTesting',
    'reviewId',
    'schemaVersion',
    'sus',
  ];
  const taskKeys = [
    'backtrackingCount',
    'completed',
    'correctiveAction',
    'errors',
    'evidence',
    'expertProcedureDurationMs',
    'helpUsed',
    'id',
    'objective',
    'observation',
    'order',
    'severity',
  ];

  assertCondition(
    valuesMatch(Object.keys(review).toSorted(), reviewKeys) &&
      valuesMatch(Object.keys(status).toSorted(), statusKeys) &&
      review.schemaVersion === 1 &&
      review.reviewId === 'M06-EXPERT-HEURISTIC-REVIEW' &&
      status.schemaVersion === 1 &&
      status.reviewId === review.reviewId &&
      typeof review.executedAt === 'string' &&
      new Date(review.executedAt).toISOString() === review.executedAt &&
      Array.isArray(review.tasks) &&
      review.tasks.length === 6 &&
      valuesMatch(
        review.tasks.map(({ helpUsed, id, severity }) => ({ helpUsed, id, severity })),
        heuristicTaskExpectations,
      ) &&
      review.tasks.every(
        (task, index) =>
          valuesMatch(Object.keys(task).toSorted(), taskKeys) &&
          task.order === index + 1 &&
          task.completed === true &&
          isFiniteNumber(task.expertProcedureDurationMs) &&
          task.expertProcedureDurationMs >= 0 &&
          Array.isArray(task.errors) &&
          task.errors.length === 0 &&
          task.backtrackingCount === 0 &&
          typeof task.objective === 'string' &&
          task.objective.length > 0 &&
          typeof task.observation === 'string' &&
          task.observation.length > 0 &&
          typeof task.correctiveAction === 'string' &&
          task.correctiveAction.length > 0 &&
          isRecord(task.evidence),
      ) &&
      review.method?.kind === 'expert-heuristic-review' &&
      review.method?.participantTestingStatus === 'unexecuted' &&
      review.method?.participantCount === 0 &&
      review.method?.susStatus === 'not-applicable' &&
      review.method?.susScore === null &&
      review.method?.timingKind === 'scripted-expert-procedure-wall-clock' &&
      valuesMatch(Object.keys(review.method).toSorted(), [
        'kind',
        'participantCount',
        'participantReason',
        'participantTestingStatus',
        'susScore',
        'susStatus',
        'timingInterpretation',
        'timingKind',
      ]) &&
      valuesMatch(Object.keys(review.summary ?? {}).toSorted(), [
        'completedTaskCount',
        'severityCounts',
        'taskCount',
      ]) &&
      review.summary?.taskCount === review.tasks.length &&
      review.summary?.completedTaskCount === review.tasks.length &&
      valuesMatch(review.summary?.severityCounts, {
        high: 0,
        low: 1,
        medium: 0,
        none: 5,
      }),
    'Expert heuristic review does not contain six completed protocol tasks.',
  );
  assertCondition(
    valuesMatch(Object.keys(status.expertHeuristicReview ?? {}).toSorted(), [
      'completedTaskCount',
      'status',
      'timingInterpretation',
    ]) &&
      valuesMatch(Object.keys(status.participantTesting ?? {}).toSorted(), [
        'participantCount',
        'reason',
        'status',
      ]) &&
      valuesMatch(Object.keys(status.sus ?? {}).toSorted(), [
        'reason',
        'responseCount',
        'score',
        'status',
      ]) &&
      status.expertHeuristicReview?.status === 'executed' &&
      status.expertHeuristicReview?.completedTaskCount === review.tasks.length &&
      status.participantTesting?.status === 'unexecuted' &&
      status.participantTesting?.participantCount === 0 &&
      status.sus?.status === 'not-applicable' &&
      status.sus?.responseCount === 0 &&
      status.sus?.score === null,
    'Usability status does not truthfully distinguish heuristic and participant testing.',
  );
  const csv = await readFile(path.join(directory, 'heuristic-review.csv'), 'utf8');

  assertCondition(
    csv === renderHeuristicReviewCsv(review.tasks) && !csv.includes('\r'),
    'Heuristic-review CSV does not exactly represent the validated six-task review.',
  );

  return {
    completedTasks: review.tasks.length,
    method: review.method.kind,
    participantTesting: status.participantTesting.status,
    sus: status.sus.status,
  };
};

const comparableEnvironment = (environment) => ({
  evidenceId: environment.evidenceId,
  integrity: environment.integrity,
  productVersion: environment.productVersion,
  results: environment.results,
  runtime: environment.runtime,
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

const comparableVolatileRobustness = async (directory) => {
  const [performance, system] = await Promise.all([
    readJson(path.join(directory, 'robustness', 'performance-baseline.json')),
    readJson(path.join(directory, 'robustness', 'system-robustness.json')),
  ]);
  const performanceProjection = structuredClone(performance);
  const systemProjection = structuredClone(system);

  performanceProjection.samples = performanceProjection.samples.map(
    ({ durationMs, peakRssBytes, run }) => ({
      durationObserved: isFiniteNumber(durationMs) && durationMs >= 0,
      peakRssObserved: peakRssBytes === null ? 'unavailable' : isNonNegativeInteger(peakRssBytes),
      run,
    }),
  );
  performanceProjection.summary.durations = {
    count: performanceProjection.summary.durations.values.length,
    valuesObserved: performanceProjection.summary.durations.values.every(
      (duration) => isFiniteNumber(duration) && duration >= 0,
    ),
  };
  performanceProjection.summary.peakRss = {
    count: performanceProjection.summary.peakRss.values.length,
    measurement: performanceProjection.summary.peakRss.measurement,
    valuesObserved: performanceProjection.summary.peakRss.values.every((value) =>
      isNonNegativeInteger(value),
    ),
  };

  systemProjection.cases = systemProjection.cases.map((testCase) => {
    if (testCase.id !== 'performance-large-project') {
      return testCase;
    }

    const normalized = structuredClone(testCase);

    normalized.observation.durationMaxMs = '<VOLATILE_DURATION_MS>';
    normalized.observation.durationMedianMs = '<VOLATILE_DURATION_MS>';
    normalized.observation.durationMinMs = '<VOLATILE_DURATION_MS>';
    return normalized;
  });

  return {
    performance: performanceProjection,
    system: systemProjection,
  };
};

const comparableVolatileUsability = async (directory) => {
  const review = await readJson(path.join(directory, 'usability', 'heuristic-review.json'));

  return {
    method: review.method,
    reviewId: review.reviewId,
    schemaVersion: review.schemaVersion,
    summary: review.summary,
    tasks: review.tasks?.map((task) => {
      const projection = { ...task };

      Reflect.deleteProperty(projection, 'expertProcedureDurationMs');
      return projection;
    }),
  };
};

const assertExistingEvidenceMatches = async (expectedEnvironment) => {
  await assertBaseEvidencePackageIsComplete(finalEvidenceDirectory);
  await assertEvidenceManifestIsValid(finalEvidenceDirectory);
  await assertEvidenceIsSanitized(finalEvidenceDirectory);
  await assertEvidenceJsonIsCanonical(finalEvidenceDirectory);

  const [existingScenario, existingAccuracy, existingRobustness, existingUsability] =
    await Promise.all([
      readAndValidateScenario(path.join(finalEvidenceDirectory, 'scenario')),
      readAndValidateAccuracy(path.join(finalEvidenceDirectory, 'accuracy')),
      readAndValidateRobustness(path.join(finalEvidenceDirectory, 'robustness')),
      readAndValidateUsability(path.join(finalEvidenceDirectory, 'usability')),
    ]);
  const existingEnvironment = await readJson(path.join(finalEvidenceDirectory, 'environment.json'));

  assertCondition(
    JSON.stringify(comparableEnvironment(existingEnvironment)) ===
      JSON.stringify(comparableEnvironment(expectedEnvironment)),
    'Existing evidence does not match the current verified source tree and stable results.',
  );
  assertCondition(
    JSON.stringify(existingScenario) === JSON.stringify(expectedEnvironment.results.scenario) &&
      JSON.stringify(existingAccuracy) === JSON.stringify(expectedEnvironment.results.accuracy) &&
      JSON.stringify(existingRobustness) ===
        JSON.stringify(expectedEnvironment.results.robustness) &&
      JSON.stringify(existingUsability) === JSON.stringify(expectedEnvironment.results.usability),
    'Existing retained evidence summaries do not match the current execution.',
  );

  const [expectedSummary, existingSummary] = await Promise.all([
    readFile(path.join(temporaryEvidence, 'SUMMARY.md'), 'utf8'),
    readFile(path.join(finalEvidenceDirectory, 'SUMMARY.md'), 'utf8'),
  ]);

  assertCondition(
    normalizeSummaryForComparison(existingSummary) ===
      normalizeSummaryForComparison(expectedSummary),
    'Existing evidence summary does not match current verification.',
  );

  for (const relativePath of stableResultRelativePaths) {
    const [expectedContent, existingContent] = await Promise.all([
      readFile(path.join(temporaryEvidence, relativePath)),
      readFile(path.join(finalEvidenceDirectory, relativePath)),
    ]);

    assertCondition(
      expectedContent.equals(existingContent),
      `Existing stable evidence differs: ${relativePath}`,
    );
  }

  const [
    expectedVolatileProjection,
    existingVolatileProjection,
    expectedUsabilityProjection,
    existingUsabilityProjection,
  ] = await Promise.all([
    comparableVolatileRobustness(temporaryEvidence),
    comparableVolatileRobustness(finalEvidenceDirectory),
    comparableVolatileUsability(temporaryEvidence),
    comparableVolatileUsability(finalEvidenceDirectory),
  ]);

  assertCondition(
    JSON.stringify(expectedVolatileProjection) === JSON.stringify(existingVolatileProjection),
    'Existing performance/robustness evidence differs beyond documented volatile measurements.',
  );
  assertCondition(
    JSON.stringify(expectedUsabilityProjection) === JSON.stringify(existingUsabilityProjection),
    'Existing usability evidence differs beyond documented volatile measurements.',
  );

  for (const result of expectedEnvironment.verification.commands) {
    const rawRecord = await readFile(
      path.join(finalEvidenceDirectory, 'raw', result.fileName),
      'utf8',
    );

    assertCondition(
      rawRecord.includes(`Observed exit code: ${String(result.observedExitCode)}`),
      `Existing raw evidence is inconsistent: ${result.fileName}`,
    );
  }
};

try {
  if (typeof npmExecPath !== 'string' || npmExecPath.length === 0) {
    throw new Error('npm executable path is unavailable; run this collector through npm.');
  }

  temporaryRoot = await mkdtemp(path.join(tmpdir(), 'uxaudit-m06-evidence-'));
  isolatedWorkspace = path.join(temporaryRoot, 'workspace');
  temporaryEvidence = path.join(temporaryRoot, 'evidence');
  rawEvidence = path.join(temporaryEvidence, 'raw');
  scenarioEvidence = path.join(temporaryEvidence, 'scenario');
  accuracyEvidence = path.join(temporaryEvidence, 'accuracy');
  robustnessEvidence = path.join(temporaryEvidence, 'robustness');
  usabilityEvidence = path.join(temporaryEvidence, 'usability');
  measurementEvidence = path.join(temporaryEvidence, 'measurements');
  childTemporaryDirectory = path.join(temporaryRoot, 'child-tmp');
  npmCacheDirectory = path.join(temporaryRoot, 'npm-cache');
  npmGlobalConfig = path.join(temporaryRoot, 'npm-globalrc');
  npmUserConfig = path.join(temporaryRoot, 'npmrc');
  vitestResultsPath = path.join(isolatedWorkspace, vitestResultsRelativePath);
  sensitivePathValues = [isolatedWorkspace, rootDirectory, temporaryRoot, homedir()].filter(
    Boolean,
  );

  const initialDestination = await inspectEvidenceDestination();

  initialDestinationPresent = initialDestination.exists;
  initialPlaceholderPresent = await isInitialPlaceholderSet(initialDestination.files);

  if (initialDestination.exists && !initialPlaceholderPresent) {
    await assertBaseEvidencePackageIsComplete(finalEvidenceDirectory);
  }

  await Promise.all([
    mkdir(rawEvidence, { recursive: true }),
    mkdir(scenarioEvidence, { recursive: true }),
    mkdir(accuracyEvidence, { recursive: true }),
    mkdir(robustnessEvidence, { recursive: true }),
    mkdir(usabilityEvidence, { recursive: true }),
    mkdir(measurementEvidence, { recursive: true }),
    mkdir(path.join(temporaryEvidence, 'activity3'), { recursive: true }),
    mkdir(path.join(temporaryEvidence, 'defects'), { recursive: true }),
    mkdir(path.join(temporaryEvidence, 'unsupported'), { recursive: true }),
    mkdir(childTemporaryDirectory, { recursive: true }),
    mkdir(npmCacheDirectory, { recursive: true }),
    writeFile(npmGlobalConfig, '', 'utf8'),
    writeFile(npmUserConfig, '', 'utf8'),
    assertProjectNpmConfigIsSafe(),
  ]);

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
  const usabilityRunner = path.join(isolatedWorkspace, 'scripts', 'run-m06-usability.mjs');
  const [npmVersionResult, baseCommitResult, branchResult, usabilityRunnerMetadata] =
    await Promise.all([
      captureCommand(process.execPath, [npmExecPath, '--version'], isolatedWorkspace),
      captureCommand('git', ['rev-parse', 'HEAD'], rootDirectory),
      captureCommand('git', ['branch', '--show-current'], rootDirectory),
      lstat(usabilityRunner),
    ]);
  const npmVersion = npmVersionResult.stdout.trim();
  const baseCommit = baseCommitResult.stdout.trim();
  const branch = branchResult.stdout.trim();

  assertCondition(
    usabilityRunnerMetadata.isFile() && !usabilityRunnerMetadata.isSymbolicLink(),
    'M06 usability runner must be a regular source file.',
  );
  assertCondition(
    npmVersionResult.exitCode === 0 &&
      baseCommitResult.exitCode === 0 &&
      branchResult.exitCode === 0 &&
      /^\d+\.\d+\.\d+$/u.test(npmVersion) &&
      /^[0-9a-f]{40,64}$/u.test(baseCommit) &&
      branch !== '',
    'Unable to establish verified runtime and Git evidence metadata.',
  );
  assertCondition(
    process.version === `v${pinnedNodeVersion}` &&
      pinnedNodeVersion === '24.18.0' &&
      packageMetadata.packageManager === `npm@${npmVersion}` &&
      npmVersion === '11.16.0' &&
      packageMetadata.engines?.node === '>=24.18.0 <25' &&
      packageMetadata.engines?.npm === '>=11.16.0 <12',
    'Evidence runtime does not match the pinned Node.js 24/npm 11 contract.',
  );
  assertCondition(
    harnessState.activeMilestone === 'M06' &&
      harnessState.activeTask === 'M06-T05' &&
      harnessState.currentBranch === branch,
    'Evidence collection requires the active M06-T05 milestone branch.',
  );

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
    args: [npmExecPath, 'run', 'test:scenario:m06', '--', '--output', scenarioEvidence],
    command: process.execPath,
    displayedArgs: ['run', 'test:scenario:m06', '--', '--output', '<SCENARIO_DIR>'],
    displayedCommand: 'npm',
    fileName: 'm06-scenario.txt',
    label: 'Controlled M06 end-to-end scenario',
  });
  await recordCommand({
    args: [npmExecPath, 'run', 'test:accuracy:m06', '--', '--output', accuracyEvidence],
    command: process.execPath,
    displayedArgs: ['run', 'test:accuracy:m06', '--', '--output', '<ACCURACY_DIR>'],
    displayedCommand: 'npm',
    fileName: 'm06-accuracy.txt',
    label: 'M06 per-rule accuracy scenario',
  });
  await recordCommand({
    args: [npmExecPath, 'run', 'test:robustness:m06', '--', '--output', robustnessEvidence],
    command: process.execPath,
    displayedArgs: ['run', 'test:robustness:m06', '--', '--output', '<ROBUSTNESS_DIR>'],
    displayedCommand: 'npm',
    fileName: 'm06-robustness.txt',
    label: 'M06 robustness, security, and performance scenario',
  });
  await recordCommand({
    args: ['scripts/run-m06-usability.mjs', '--output', usabilityEvidence],
    command: process.execPath,
    displayedArgs: ['scripts/run-m06-usability.mjs', '--output', '<USABILITY_DIR>'],
    fileName: 'm06-usability.txt',
    label: 'M06 expert heuristic usability review',
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

  const [coverageSummary, testReport, scenario, accuracy, robustness, usability] =
    await Promise.all([
      readJson(path.join(isolatedWorkspace, 'coverage', 'coverage-summary.json')),
      readJson(vitestResultsPath),
      readAndValidateScenario(scenarioEvidence),
      readAndValidateAccuracy(accuracyEvidence),
      readAndValidateRobustness(robustnessEvidence),
      readAndValidateUsability(usabilityEvidence),
    ]);
  const coverage = normalizeCoverage(coverageSummary);
  const tests = normalizeTestReport(testReport);
  const vulnerabilities = normalizeAuditReport(JSON.parse(auditResult.stdout));

  await assertSourceSnapshotWasNotMutated(sourceTreeDigest);

  await Promise.all([
    writeCanonicalJson(path.join(measurementEvidence, 'coverage-summary.json'), coverage),
    writeCanonicalJson(path.join(measurementEvidence, 'test-summary.json'), tests),
  ]);

  const defects = {
    schemaVersion: 1,
    evidenceId: 'M06-DEFECTS-CORRECTIONS',
    defects: [
      {
        correctiveAction:
          'Use Commander option-value sources so only explicit CLI values override inert JSON configuration.',
        defect:
          'The default value of an absent --no-color option could otherwise override a file color setting.',
        id: 'M06-D01',
        status: 'corrected-and-regression-tested',
      },
      {
        correctiveAction:
          'Normalize loss of root authority after initial validation as a fatal pipeline failure.',
        defect:
          'A post-authorization invalid-path error could otherwise be misclassified as initial user input.',
        id: 'M06-D02',
        status: 'corrected-and-regression-tested',
      },
      {
        correctiveAction:
          'Require exact total processing errors, zero unversioned discovery issues, and truthful projection field names.',
        defect:
          'The initial controlled-project projection could omit unexpected discovery or rule errors.',
        id: 'M06-D03',
        status: 'corrected-and-regression-tested',
      },
      {
        correctiveAction:
          'Validate every derived confusion-matrix denominator as a safe integer before calculating ratios.',
        defect:
          'The initial accuracy metrics boundary did not reject every safe-integer denominator overflow.',
        id: 'M06-D04',
        status: 'corrected-and-regression-tested',
      },
      {
        correctiveAction: 'Write mismatch diagnostics before returning a nonzero accuracy result.',
        defect:
          'An accuracy mismatch could terminate before retaining the evidence needed to inspect it.',
        id: 'M06-D05',
        status: 'corrected-and-regression-tested',
      },
      {
        correctiveAction:
          'Pass the raw equivalent root spelling, await in-flight RSS sampling, strengthen report/sentinel assertions, and qualify review-only claims.',
        defect:
          'The first robustness runner pre-normalized its canonical-path input, could miss the final RSS sample, and had incomplete or overstated safety assertions.',
        id: 'M06-D06',
        status: 'corrected-and-regression-tested',
      },
      {
        correctiveAction:
          'Accept and render the coherent zero-active-milestone terminal state while retaining strict ready-state validation.',
        defect:
          'Harness validation and status rendering did not support completion of the final milestone.',
        id: 'M06-D07',
        status: 'corrected-and-regression-tested',
      },
      {
        correctiveAction:
          'Require exact project/rule/case/task identities and quantitative observations, closed robustness/usability statuses, JSON-to-CSV agreement, and full second-run comparison with only measured timing/RSS removed.',
        defect:
          'The first T05 collector validation accepted incomplete robustness/usability projections and over-normalized the second robustness execution.',
        id: 'M06-D08',
        status: 'corrected-and-independently-reviewed',
      },
      {
        correctiveAction:
          'Use empty user/global npm configuration, a bounded executable path, lockfile credential-URL inspection, execution-neutral publication wording, complete Activity 3 summaries, exact host context, and a non-empty structured milestone-report gate.',
        defect:
          'The first evidence lifecycle did not fully establish its credential/configuration boundary or validate every academic and final-report claim.',
        id: 'M06-D09',
        status: 'corrected-and-independently-reviewed',
      },
      {
        correctiveAction:
          'Use deep strict value comparison so JSON object property order is irrelevant while array order, types, and values remain exact.',
        defect:
          'The first isolated collection rejected the correct usability severity totals because their JSON object keys used a different insertion order.',
        id: 'M06-D10',
        status: 'corrected-and-static-verified',
      },
      {
        correctiveAction:
          'Canonicalize both runner and collector JSON from an explicitly two-space-indented semantic value before applying the same Prettier options.',
        defect:
          'The second isolated collection used a compact semantic reserialization in the package contract and rejected the canonical multiline accuracy output produced by the runner.',
        id: 'M06-D11',
        status: 'corrected-and-static-verified',
      },
      {
        correctiveAction:
          'Normalize the HTML duration through its exact table-row structure and assert that exactly one duration placeholder is present.',
        defect:
          'The first successful base package retained a raw duration in its normalized HTML sample, so the mandatory second collection correctly detected different bytes.',
        id: 'M06-D12',
        status: 'corrected-and-scenario-verified',
      },
      {
        correctiveAction:
          'Exclude exact generated normalized HTML evidence from repository-wide Prettier rewrites while retaining its byte-level scenario and manifest validation.',
        defect:
          'The first reproducible package exposed that the global formatting gate attempted to rewrite its normalized HTML sample because the evidence ignore policy covered only the older report filename.',
        id: 'M06-D13',
        status: 'corrected-and-full-gate-verified',
      },
    ],
    observedValidationMismatches: {
      falseNegatives: accuracy.falseNegatives,
      falsePositives: accuracy.falsePositives,
      unmatchedFindings: 0,
    },
  };
  const unsupported = {
    schemaVersion: 1,
    evidenceId: 'M06-UNSUPPORTED-UNEXECUTED',
    checks: [
      {
        id: 'hosted-codeql',
        reason: 'No hosted result was retrieved during local evidence collection.',
        status: 'unexecuted',
      },
      {
        id: 'browser-runtime-xss',
        reason: 'HTML validation was structural and CSP-based; no browser exploit was executed.',
        status: 'unexecuted',
      },
      {
        id: 'participant-usability',
        reason: 'No real participant responses are present; an expert heuristic review was used.',
        status: usability.participantTesting,
      },
      {
        id: 'system-usability-scale',
        reason: 'SUS is valid only with real participant responses.',
        status: usability.sus,
      },
      {
        id: 'runtime-rendered-behavior',
        reason:
          'Static analysis does not execute React, resolve custom abstractions, or measure browser behavior.',
        status: 'unsupported',
      },
      {
        id: 'remote-publication-and-pull-request',
        reason:
          'Remote publication is not executed by this local evidence collector; publication capability is recorded separately in the harness session log.',
        status: 'unexecuted',
      },
      {
        id: 'hosted-ci-platforms',
        reason:
          'No hosted CI run was retrieved during local evidence collection; local Linux results are retained separately.',
        status: 'unexecuted',
      },
    ],
  };

  await Promise.all([
    writeCanonicalJson(
      path.join(temporaryEvidence, 'defects', 'defects-and-corrections.json'),
      defects,
    ),
    writeCanonicalJson(
      path.join(temporaryEvidence, 'unsupported', 'unexecuted-checks.json'),
      unsupported,
    ),
  ]);

  const implementationSummary = `# Activity 3 — Implementation Summary

## Objective and scope

UXAudit is a local Node.js 24 CLI that canonicalizes a selected React/TypeScript project, loads
bounded inert JSON configuration, discovers and securely reads supported source files, builds one
parser-independent analysis model, evaluates eight isolated stable rules, constructs one immutable
audit result, and renders terminal, JSON, and standalone HTML reports.

The implemented scope is static analysis of \`.ts\`, \`.tsx\`, \`.js\`, and \`.jsx\`. The CLI does not
execute analyzed source, modify it, use a database, send telemetry, or require a production network
service. The exact runtime and source digest are retained in
[\`environment.json\`](../environment.json).

## Components and integration boundaries

- Commander validates command input and forwards only explicit command-line overrides.
- The audit facade composes configuration, project traversal, parsing/model construction, rule
  evaluation, normalized result creation, and report persistence.
- Discovery/source/parser failures remain typed and recoverable where safe; a rule failure is
  isolated from sibling rules.
- Rules consume only the normalized analysis model. Terminal, JSON, and HTML reporters consume the
  same immutable \`AuditResult\`.
- Report paths are authorized below the canonical project root and written exclusively without
  overwrite. JSON and HTML generation claims are emitted only for completed writes.

The controlled integration inputs and expected boundaries are versioned in
[\`controlled-projects-manifest.json\`](../scenario/controlled-projects-manifest.json), while the
observed complete-flow projection is retained in
[\`controlled-projects-actual.json\`](../scenario/controlled-projects-actual.json).

## Security and non-functional behavior

The implementation keeps target code inert, isolates recoverable file/rule failures, orders files,
rules, findings, and reports deterministically, and authorizes report paths through exclusive
in-root writes. HTML uses fixed markup and CSP with escaped untrusted values. The CLI has no
database, telemetry, hosted service, browser execution, or automatic source modification.

The executed security boundary and its local limitations are recorded in
[\`security-checklist.json\`](../robustness/security-checklist.json). The five-run performance record
is descriptive, environment-specific evidence without a machine-dependent acceptance threshold.

## M06 delivery and limits

M06 completes the command-line composition, controlled projects, per-rule validation metrics,
robustness/security/performance execution, and expert heuristic usability review. Public behavior
and limitations remain documented in the repository system of record. Runtime browser behavior,
custom-component semantics, participant usability, SUS, hosted CodeQL, hosted CI, and remote
publication are not presented as executed work; their status is listed in
[\`unexecuted-checks.json\`](../unsupported/unexecuted-checks.json).
`;
  const testingSummary = `# Activity 3 — Testing Summary

## Objective, environment, and tools

The objective is to verify the complete local CLI against reviewed inputs, expected outputs, error
boundaries, security controls, detection ground truth, and documented limitations. The isolated
evidence run performs a locked clean install under the pinned Node.js/npm runtime. Exact source,
runtime, platform, kernel, CPU-count, memory, commands, and result summaries are retained in
[\`environment.json\`](../environment.json); raw installation and gate output remain under
[\`raw/\`](../raw/).

Vitest is used because it exercises TypeScript units and integration boundaries with deterministic
fixtures and produces V8 coverage plus a machine-readable zero-skip/todo result. Shell-free Node.js
runners execute the compiled CLI for behavior that unit adapters cannot establish. \`npm audit\`
checks the exact lockfile at the moderate threshold, and the harness scripts validate delivery
state.

## Unit and integration tests

The isolated evidence run performs a locked clean install, the complete quality gate, coverage,
machine-readable zero-skip/todo tests, compiled CLI smoke tests, five controlled-project scans,
instance-level rule accuracy, robustness/security/performance cases, an expert heuristic review,
harness validation, and a moderate-threshold dependency audit.

- Unit/integration tests: ${String(tests.totalTests)} passed across ${String(
    tests.testFiles,
  )} files; zero failed, skipped, or todo.
- Coverage: statements ${String(coverage.statements)}%, branches ${String(
    coverage.branches,
  )}%, functions ${String(coverage.functions)}%, lines ${String(coverage.lines)}%.
- Selected units include configuration, traversal/source authorization, Babel parsing/model
  construction, eight rules, rule isolation, result normalization, three reporters, CLI/application
  composition, quantitative validation helpers, and terminal harness lifecycle.
- Inputs include positive, negative, boundary, hostile, malformed, filtered, permission, symlink,
  overwrite, and final-state fixtures. Expected values are versioned independently and compared
  against normalized domain results rather than incidental AST structures.
- Integration tests cover configuration → scan/analyze, model → rule engine, rule engine →
  \`AuditResult\`, result → three reporters/writer, Commander → application facade, and
  task-completion → final harness advance.

The machine-readable totals are in [\`test-summary.json\`](../measurements/test-summary.json), and
coverage percentages are in
[\`coverage-summary.json\`](../measurements/coverage-summary.json).

## System and end-to-end tests

- System scenario: ${String(
    scenario.projects,
  )} projects with byte-stable normalized reruns. Findings were 0/8/3/1/0 for
  valid/invalid/mixed/hostile/large; only the mixed project retained one recoverable parser error.
- Every project ran through the built CLI with terminal, JSON, and HTML output. Target-code
  sentinels remained absent, generated report claims matched actual writes, and expected versus
  actual artifacts are retained under [\`scenario/\`](../scenario/).

## Validation and detection behavior

- Accuracy: ${String(accuracy.rules)} rules, ${String(
    accuracy.truePositives,
  )} TP, ${String(accuracy.falsePositives)} FP, ${String(
    accuracy.trueNegatives,
  )} TN, ${String(accuracy.falseNegatives)} FN, and ${String(
    accuracy.unsupported,
  )} unsupported cases outside denominators on the controlled corpus.
- The reviewed ground truth, case identities, expected/actual comparison, per-rule matrices, and CSV
  projections are retained under [\`accuracy/\`](../accuracy/). Precision/recall apply only to this
  small synthetic corpus and are not generalized to arbitrary projects.

## Robustness, security, and performance

- Robustness/security: ${String(
    robustness.cases,
  )} exact cases with no failed case, covering invalid input/configuration, malformed isolation,
  canonical/path/symlink/output boundaries, permissions where executable, deterministic hostile
  reports, CSP/escaping, non-execution sentinels, and exclusive writes.
- Performance: ${String(robustness.performanceRuns)} complete built-CLI runs over ${String(
    robustness.sourceFiles,
  )} generated files. Durations and sampled child RSS are observations, not portable pass
  thresholds or exact lifetime peaks.
- Dependency audit: ${String(vulnerabilities.total)} known vulnerabilities, including zero moderate,
  high, or critical vulnerabilities. Hosted CodeQL was not executed locally.

Raw observations and concise machine-readable results are retained under
[\`robustness/\`](../robustness/) and [\`raw/\`](../raw/).

## Usability

- Usability: ${String(
    usability.completedTasks,
  )} protocol tasks completed by expert heuristic review; participant testing was not executed and
  SUS is not applicable.
- Five observations had no issue and one recorded a low-severity prioritization ambiguity. Script
  durations, errors, backtracking, and help use describe the expert procedure only, not people.
  Detailed JSON/CSV and status are retained under [\`usability/\`](../usability/).

## Defects, corrective actions, and remaining work

Thirteen M06 defects, their corrective actions, and their exact verification statuses are listed in
[\`defects-and-corrections.json\`](../defects/defects-and-corrections.json). Remaining unsupported,
unexecuted, or not-applicable work is explicit in
[\`unexecuted-checks.json\`](../unsupported/unexecuted-checks.json).

These results describe the retained synthetic corpus and local execution environment. They do not
claim runtime browser coverage, real-world accuracy, participant usability, or hosted CodeQL.
`;

  await Promise.all([
    writeFile(
      path.join(temporaryEvidence, 'activity3', 'IMPLEMENTATION_SUMMARY.md'),
      await format(implementationSummary, { parser: 'markdown' }),
      'utf8',
    ),
    writeFile(
      path.join(temporaryEvidence, 'activity3', 'TESTING_SUMMARY.md'),
      await format(testingSummary, { parser: 'markdown' }),
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
    schemaVersion: 1,
    evidenceId: 'M06-VALIDATION',
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
      kernelRelease: release(),
      logicalCpuCount: availableParallelism(),
      platform: process.platform,
      totalMemoryBytes: totalmem(),
    },
    integrity: {
      algorithm: 'sha256',
      manifest: evidenceManifestRelativePath,
    },
    results: {
      accuracy,
      robustness,
      scenario,
      usability,
    },
    verification,
  };

  await writeCanonicalJson(path.join(temporaryEvidence, 'environment.json'), environment);

  const commandRows = commandResults
    .map(
      ({ fileName, label, observedExitCode, passed }) =>
        `| ${label} | ${String(observedExitCode)} | ${
          passed ? 'PASS' : 'FAIL'
        } | [raw/${fileName}](raw/${fileName}) |`,
    )
    .join('\n');
  const summary = `# M06 End-to-end Validation Evidence

- Evidence ID: M06-VALIDATION
- Observed at: ${observedAt}
- Source: branch \`${branch}\`, base commit \`${baseCommit}\`, plus the M06-T05 working tree
- Source tree: \`${sourceTreeDigest}\`
- Integrity: SHA-256 manifest in \`${evidenceManifestRelativePath}\`
- Environment: Node.js \`${process.version}\`, npm \`${npmVersion}\`, \`${process.platform}\`/\`${process.arch}\`
- Objective: verify the complete local CLI, controlled expected results, per-rule detection behavior, robustness, security, performance, usability, and Activity 3 records
- Expected result: every executable gate passes; no required test is skipped or todo; stable scenario, accuracy, security, and usability projections reproduce; unsupported or unexecuted work remains explicit

## Executed checks

| Check | Exit | Status | Raw record |
| ----- | ---: | ------ | ---------- |
${commandRows}

## Measurements and validation

- Tests: ${String(tests.totalTests)} passed across ${String(
    tests.testFiles,
  )} files; zero skipped or todo tests.
- Coverage: statements ${String(coverage.statements)}%, branches ${String(
    coverage.branches,
  )}%, functions ${String(coverage.functions)}%, lines ${String(coverage.lines)}%.
- Controlled projects: ${String(
    scenario.projects,
  )} complete built-CLI projects with deterministic stable projections.
- Accuracy: ${String(accuracy.rules)} stable rules; ${String(
    accuracy.truePositives,
  )} TP, ${String(accuracy.falsePositives)} FP, ${String(
    accuracy.trueNegatives,
  )} TN, ${String(accuracy.falseNegatives)} FN, and ${String(
    accuracy.unsupported,
  )} unsupported observations outside denominators.
- Robustness/security: ${String(
    robustness.cases,
  )} cases, zero failed cases, structural hostile-HTML/CSP checks, explicit CodeQL status, and target-code non-execution.
- Performance: ${String(robustness.performanceRuns)} complete built-CLI runs over ${String(
    robustness.sourceFiles,
  )} files; descriptive elapsed and memory observations with no machine-dependent pass threshold.
- Usability: ${String(
    usability.completedTasks,
  )} protocol tasks completed through an expert heuristic review; participant testing was not executed and SUS is not applicable.
- Dependency audit: ${String(vulnerabilities.total)} known vulnerabilities; moderate ${String(
    vulnerabilities.moderate,
  )}, high ${String(vulnerabilities.high)}, critical ${String(vulnerabilities.critical)}.

## Conclusion

PASS. UXAudit completed the local static-analysis flow across controlled normal, invalid, mixed,
hostile, and generated-large projects. Retained evidence distinguishes executed checks from
unsupported runtime behavior, unavailable participant/SUS data, and unexecuted hosted CodeQL. The
isolated child environment uses an explicit allowlist and inherits no credential variables.
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

  const existingEvidenceFiles = initialPlaceholderPresent ? [] : initialDestination.files;

  if (existingEvidenceFiles.length === 0) {
    const destinationBeforeStaging = await assertDestinationUnchangedBeforePublication();

    publicationStagingDirectory = await mkdtemp(
      path.join(destinationBeforeStaging.parentRealPath, '.m06-validation-staging-'),
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
      const templatePath = path.join(finalEvidenceDirectory, 'CONFUSION_MATRIX_TEMPLATE.csv');
      const [placeholderMetadata, templateMetadata, placeholderContent, templateContent] =
        await Promise.all([
          lstat(placeholderPath),
          lstat(templatePath),
          readFile(placeholderPath),
          readFile(templatePath, 'utf8'),
        ]);

      assertCondition(
        placeholderMetadata.isFile() &&
          !placeholderMetadata.isSymbolicLink() &&
          templateMetadata.isFile() &&
          !templateMetadata.isSymbolicLink() &&
          placeholderContent.byteLength === 0 &&
          templateContent === initialTemplateContent,
        'The initial M06 evidence templates changed during collection.',
      );
      await rm(placeholderPath);
      await rm(templatePath);
      await rmdir(finalEvidenceDirectory);
    }

    const destinationBeforeRename = await inspectEvidenceDestination();

    assertCondition(
      destinationBeforeRename.exists === false &&
        destinationBeforeRename.parentRealPath === destinationBeforeStaging.parentRealPath,
      'M06 evidence destination is not safe for atomic publication.',
    );
    await rename(publicationStagingDirectory, finalEvidenceDirectory);
    publicationStagingDirectory = undefined;

    const publishedDestination = await inspectEvidenceDestination();

    assertCondition(
      publishedDestination.exists,
      'M06 evidence publication did not create the approved destination.',
    );
    await assertBaseEvidencePackageIsComplete(finalEvidenceDirectory);
    await assertEvidenceManifestIsValid(finalEvidenceDirectory);
    await assertEvidenceIsSanitized(finalEvidenceDirectory);
    await assertEvidenceJsonIsCanonical(finalEvidenceDirectory);
  } else {
    await assertExistingEvidenceMatches(environment);
  }

  console.log('M06 evidence collection: PASS');
  console.log(
    existingEvidenceFiles.length === 0
      ? 'Evidence written to evidence/m06-validation/'
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

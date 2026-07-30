import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { format } from 'prettier';

export const evidenceManifestRelativePath = 'MANIFEST.sha256';
export const milestoneReportRelativePath = 'MILESTONE_REPORT.md';

const manifestedEvidenceRelativePaths = [
  'SUMMARY.md',
  'activity3/IMPLEMENTATION_SUMMARY.md',
  'activity3/TESTING_SUMMARY.md',
  'accuracy/accuracy-by-rule.csv',
  'accuracy/accuracy-cases.csv',
  'accuracy/accuracy-comparison.json',
  'accuracy/accuracy-ground-truth.json',
  'accuracy/accuracy-results.json',
  'accuracy/accuracy-unsupported.json',
  'defects/defects-and-corrections.json',
  'environment.json',
  'measurements/coverage-summary.json',
  'measurements/test-summary.json',
  'raw/cli-smoke.txt',
  'raw/coverage.txt',
  'raw/harness-validation.txt',
  'raw/m06-accuracy.txt',
  'raw/m06-robustness.txt',
  'raw/m06-scenario.txt',
  'raw/m06-usability.txt',
  'raw/npm-audit.json.txt',
  'raw/npm-ci.txt',
  'raw/test-results.txt',
  'raw/verify.txt',
  'robustness/deterministic-security-comparison.json',
  'robustness/html-injection-validation.json',
  'robustness/performance-baseline.json',
  'robustness/performance-runs.csv',
  'robustness/robustness-cases.csv',
  'robustness/security-checklist.json',
  'robustness/system-robustness.json',
  'scenario/controlled-projects-actual.json',
  'scenario/controlled-projects-expected.json',
  'scenario/controlled-projects-manifest.json',
  'scenario/deterministic-comparison.json',
  'scenario/invalid-audit-report.normalized.html',
  'scenario/invalid-audit-report.normalized.json',
  'scenario/invalid-terminal-report.normalized.txt',
  'unsupported/unexecuted-checks.json',
  'usability/heuristic-review.csv',
  'usability/heuristic-review.json',
  'usability/usability-status.json',
];
const requiredEvidenceRelativePaths = [
  evidenceManifestRelativePath,
  ...manifestedEvidenceRelativePaths,
];
const optionalEvidenceRelativePaths = [milestoneReportRelativePath];
export const baseEvidenceArtifactCount = manifestedEvidenceRelativePaths.length;
const jsonFormatOptions = {
  endOfLine: 'lf',
  parser: 'json',
  printWidth: 100,
};
const toPortablePath = (value) => value.split(path.sep).join('/');

const sensitivePatterns = [
  {
    label: 'GitHub token',
    pattern: /ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/gu,
    replacement: '<REDACTED_GITHUB_TOKEN>',
  },
  {
    label: 'npm token',
    pattern: /npm_[A-Za-z0-9]{20,}/gu,
    replacement: '<REDACTED_NPM_TOKEN>',
  },
  {
    label: 'OpenAI-style token',
    pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/gu,
    replacement: '<REDACTED_API_TOKEN>',
  },
  {
    label: 'AWS access key',
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu,
    replacement: '<REDACTED_AWS_ACCESS_KEY>',
  },
  {
    label: 'private key material',
    pattern: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/gu,
    replacement: '<REDACTED_PRIVATE_KEY>',
  },
  {
    label: 'authorization data',
    pattern: /(?:authorization\s*:[\t ]*[^\r\n]+|bearer[\t ]+[^\s]+)/giu,
    replacement: '<REDACTED_AUTHORIZATION>',
  },
  {
    label: 'secret environment assignment',
    pattern: /(?:_authToken|GH_TOKEN|GITHUB_TOKEN|NODE_AUTH_TOKEN|NPM_TOKEN)\s*[:=]\s*[^\s]+/giu,
    replacement: '<REDACTED_CREDENTIAL_ASSIGNMENT>',
  },
  {
    label: 'Linux home path',
    pattern: /\/home\/[^/\\\s"'`:]+/gu,
    replacement: '<HOME>',
  },
  {
    label: 'root home path',
    pattern: /\/root(?=\/|\\)/gu,
    replacement: '<HOME>',
  },
  {
    label: 'macOS home path',
    pattern: /\/Users\/[^/\\\s"'`:]+/gu,
    replacement: '<HOME>',
  },
  {
    label: 'Windows home path',
    pattern: /[A-Za-z]:[\\/]Users[\\/][^/\\\s"'`:]+/giu,
    replacement: '<HOME>',
  },
];
const unsafeEvidenceCharacterPattern =
  // eslint-disable-next-line no-control-regex -- Retained evidence permits structural LF only.
  /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069\ufeff]/gu;

export const findEvidenceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  if (entries.length === 0) {
    throw new Error('Evidence contains an empty directory.');
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await findEvidenceFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    } else {
      throw new Error('Evidence contains an unsupported entry type.');
    }
  }

  return files;
};

const relativeEvidenceFiles = async (directory) =>
  new Set(
    (await findEvidenceFiles(directory)).map((filePath) =>
      toPortablePath(path.relative(directory, filePath)),
    ),
  );

const assertEvidenceFilesMatch = async ({ allowedPaths, directory, label, requiredPaths }) => {
  const relativeFiles = await relativeEvidenceFiles(directory);
  const missingFiles = requiredPaths.filter((relativePath) => !relativeFiles.has(relativePath));
  const allowedFiles = new Set(allowedPaths);
  const unexpectedFiles = [...relativeFiles].filter(
    (relativePath) => !allowedFiles.has(relativePath),
  );

  if (missingFiles.length > 0) {
    throw new Error(`${label} is incomplete: ${missingFiles.join(', ')}`);
  }

  if (unexpectedFiles.length > 0) {
    throw new Error(`${label} has unexpected files: ${unexpectedFiles.join(', ')}`);
  }
};

export const sanitizeEvidenceText = (content, knownPaths = []) => {
  let sanitized = content.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  const normalizedKnownPaths = [...new Set(knownPaths.filter(Boolean))].toSorted(
    (left, right) => right.length - left.length,
  );

  for (const knownPath of normalizedKnownPaths) {
    sanitized = sanitized.replaceAll(knownPath, '<REDACTED_PATH>');
  }

  for (const { pattern, replacement } of sensitivePatterns) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized.replace(unsafeEvidenceCharacterPattern, (character) => {
    const codeUnit = character.charCodeAt(0).toString(16).padStart(4, '0');

    return `\\u${codeUnit}`;
  });
};

export const renderEvidenceManifest = async (directory) => {
  const availableFiles = await relativeEvidenceFiles(directory);
  const paths = [
    ...manifestedEvidenceRelativePaths,
    ...optionalEvidenceRelativePaths.filter((relativePath) => availableFiles.has(relativePath)),
  ];
  const lines = [];

  for (const relativePath of paths) {
    const content = await readFile(path.join(directory, relativePath));
    lines.push(`${createHash('sha256').update(content).digest('hex')}  ${relativePath}`);
  }

  return `${lines.join('\n')}\n`;
};

export const assertEvidenceManifestIsValid = async (directory) => {
  const expectedManifest = await renderEvidenceManifest(directory);
  const observedManifest = await readFile(
    path.join(directory, evidenceManifestRelativePath),
    'utf8',
  );

  if (observedManifest !== expectedManifest) {
    throw new Error('Evidence integrity manifest does not match the retained package.');
  }
};

export const assertBaseEvidenceArtifactsAreComplete = async (directory) =>
  assertEvidenceFilesMatch({
    allowedPaths: manifestedEvidenceRelativePaths,
    directory,
    label: 'Base evidence artifacts',
    requiredPaths: manifestedEvidenceRelativePaths,
  });

export const assertBaseEvidencePackageIsComplete = async (directory) =>
  assertEvidenceFilesMatch({
    allowedPaths: requiredEvidenceRelativePaths,
    directory,
    label: 'Base evidence package',
    requiredPaths: requiredEvidenceRelativePaths,
  });

export const assertEvidencePackageIsComplete = async (directory) =>
  assertEvidenceFilesMatch({
    allowedPaths: [...requiredEvidenceRelativePaths, ...optionalEvidenceRelativePaths],
    directory,
    label: 'Evidence package',
    requiredPaths: requiredEvidenceRelativePaths,
  });

export const assertEvidenceIsSanitized = async (directory) => {
  for (const filePath of await findEvidenceFiles(directory)) {
    const content = await readFile(filePath, 'utf8');

    if (!content.isWellFormed()) {
      throw new Error(
        `Evidence sanitization failed: ill-formed Unicode found in ${path.basename(filePath)}`,
      );
    }

    unsafeEvidenceCharacterPattern.lastIndex = 0;

    if (unsafeEvidenceCharacterPattern.test(content)) {
      throw new Error(
        `Evidence sanitization failed: terminal controls or bidirectional text found in ${path.basename(filePath)}`,
      );
    }

    for (const { label, pattern } of sensitivePatterns) {
      pattern.lastIndex = 0;

      if (pattern.test(content)) {
        throw new Error(
          `Evidence sanitization failed: ${label} found in ${path.basename(filePath)}`,
        );
      }
    }
  }
};

export const assertEvidenceJsonIsCanonical = async (directory) => {
  for (const filePath of await findEvidenceFiles(directory)) {
    if (path.extname(filePath) !== '.json') {
      continue;
    }

    const relativePath = toPortablePath(path.relative(directory, filePath));
    const content = await readFile(filePath, 'utf8');
    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`Evidence JSON is invalid: ${relativePath}`);
    }

    if (content !== (await format(JSON.stringify(parsed, null, 2), jsonFormatOptions))) {
      throw new Error(`Evidence JSON is not canonically formatted: ${relativePath}`);
    }
  }
};

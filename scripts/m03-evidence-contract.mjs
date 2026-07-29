import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const evidenceManifestRelativePath = 'MANIFEST.sha256';
export const milestoneReportRelativePath = 'MILESTONE_REPORT.md';

const manifestedEvidenceRelativePaths = [
  'SUMMARY.md',
  'environment.json',
  'measurements/coverage-summary.json',
  'measurements/test-summary.json',
  'raw/babel-dependencies.json.txt',
  'raw/cli-smoke.txt',
  'raw/coverage.txt',
  'raw/harness-validation.txt',
  'raw/m03-scenario.txt',
  'raw/npm-audit.json.txt',
  'raw/npm-ci.txt',
  'raw/test-results.txt',
  'raw/verify.txt',
  'scenario/cli-summary.json',
  'scenario/deterministic-comparison.json',
  'scenario/location-sample.json',
  'scenario/model-sample.json',
  'scenario/performance-baseline.json',
  'scenario/scenario-actual.json',
  'scenario/scenario-expected.json',
];
const requiredEvidenceRelativePaths = [
  evidenceManifestRelativePath,
  ...manifestedEvidenceRelativePaths,
];
const optionalEvidenceRelativePaths = [milestoneReportRelativePath];
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
    label: 'authorization data',
    pattern: /(?:authorization\s*:|bearer\s+)[^\s]+/giu,
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

export const findEvidenceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

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

export const sanitizeEvidenceText = (content, knownPaths = []) => {
  let sanitized = content;
  const normalizedKnownPaths = [...new Set(knownPaths.filter(Boolean))].toSorted(
    (left, right) => right.length - left.length,
  );

  for (const knownPath of normalizedKnownPaths) {
    sanitized = sanitized.replaceAll(knownPath, '<REDACTED_PATH>');
  }

  for (const { pattern, replacement } of sensitivePatterns) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized;
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

export const assertEvidencePackageIsComplete = async (directory) => {
  const relativeFiles = await relativeEvidenceFiles(directory);
  const missingFiles = requiredEvidenceRelativePaths.filter(
    (relativePath) => !relativeFiles.has(relativePath),
  );
  const allowedFiles = new Set([
    ...requiredEvidenceRelativePaths,
    ...optionalEvidenceRelativePaths,
  ]);
  const unexpectedFiles = [...relativeFiles].filter(
    (relativePath) => !allowedFiles.has(relativePath),
  );

  if (missingFiles.length > 0) {
    throw new Error(`Evidence package is incomplete: ${missingFiles.join(', ')}`);
  }

  if (unexpectedFiles.length > 0) {
    throw new Error(`Evidence package has unexpected files: ${unexpectedFiles.join(', ')}`);
  }
};

export const assertEvidenceIsSanitized = async (directory) => {
  for (const filePath of await findEvidenceFiles(directory)) {
    const content = await readFile(filePath, 'utf8');

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

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
  'raw/cli-smoke.txt',
  'raw/coverage.txt',
  'raw/harness-validation.txt',
  'raw/m02-scenario.txt',
  'raw/npm-audit.json.txt',
  'raw/npm-ci.txt',
  'raw/test-results.txt',
  'raw/verify.txt',
  'scenario/cli-summary.json',
  'scenario/deterministic-comparison.json',
  'scenario/deterministic-run-1.json',
  'scenario/deterministic-run-2.json',
  'scenario/excluded-paths.json',
  'scenario/inventory-actual.json',
  'scenario/inventory-expected.json',
  'scenario/scenario-actual.json',
  'scenario/scenario-expected.json',
  'scenario/symlink-behavior.json',
];
const requiredEvidenceRelativePaths = [
  evidenceManifestRelativePath,
  ...manifestedEvidenceRelativePaths,
];
const optionalEvidenceRelativePaths = [milestoneReportRelativePath];
const toPortablePath = (value) => value.split(path.sep).join('/');

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
  const forbiddenPatterns = [
    {
      label: 'GitHub token',
      pattern: /ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/u,
    },
    { label: 'npm token', pattern: /npm_[A-Za-z0-9]{20,}/u },
    {
      label: 'authorization data',
      pattern: /(?:authorization\s*:|bearer\s+)[^\s]+/iu,
    },
    {
      label: 'secret environment assignment',
      pattern: /(?:_authToken|GH_TOKEN|GITHUB_TOKEN|NODE_AUTH_TOKEN|NPM_TOKEN)\s*[:=]/iu,
    },
    { label: 'Linux home path', pattern: /\/home\/[^/\s]+/u },
    { label: 'root home path', pattern: /\/root(?:\/|\\)/u },
    { label: 'macOS home path', pattern: /\/Users\/[^/\s]+/u },
    { label: 'Windows home path', pattern: /[A-Za-z]:[\\/]Users[\\/]/iu },
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

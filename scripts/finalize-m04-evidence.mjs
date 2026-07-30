import { access, lstat, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  assertEvidenceIsSanitized,
  assertEvidenceManifestIsValid,
  assertEvidencePackageIsComplete,
  evidenceManifestRelativePath,
  milestoneReportRelativePath,
  renderEvidenceManifest,
} from './m04-evidence-contract.mjs';

const rootDirectory = process.cwd();
const evidenceParentDirectory = path.join(rootDirectory, 'evidence');
const evidenceDirectory = path.join(evidenceParentDirectory, 'm04-rules');
const milestoneReport = path.join(evidenceDirectory, milestoneReportRelativePath);
const manifest = path.join(evidenceDirectory, evidenceManifestRelativePath);
const temporaryManifest = path.join(
  evidenceDirectory,
  `.${evidenceManifestRelativePath}.${String(process.pid)}.tmp`,
);
const baseArtifactCount = 20;
const manifestLinePattern = /^([a-f0-9]{64}) {2}([^\r\n]+)$/u;

const assertEvidenceDestinationIsAuthorized = async () => {
  const [rootRealPath, evidenceParentMetadata, evidenceMetadata] = await Promise.all([
    realpath(rootDirectory),
    lstat(evidenceParentDirectory),
    lstat(evidenceDirectory),
  ]);

  if (
    !evidenceParentMetadata.isDirectory() ||
    evidenceParentMetadata.isSymbolicLink() ||
    !evidenceMetadata.isDirectory() ||
    evidenceMetadata.isSymbolicLink()
  ) {
    throw new Error('M04 evidence destination is not a regular in-repository directory.');
  }

  const [evidenceParentRealPath, evidenceRealPath] = await Promise.all([
    realpath(evidenceParentDirectory),
    realpath(evidenceDirectory),
  ]);

  if (
    evidenceParentRealPath !== path.join(rootRealPath, 'evidence') ||
    evidenceRealPath !== path.join(evidenceParentRealPath, 'm04-rules')
  ) {
    throw new Error('M04 evidence destination resolves outside the repository.');
  }

  const [manifestMetadata, reportMetadata] = await Promise.all([
    lstat(manifest),
    lstat(milestoneReport),
  ]);

  if (
    !manifestMetadata.isFile() ||
    manifestMetadata.isSymbolicLink() ||
    !reportMetadata.isFile() ||
    reportMetadata.isSymbolicLink()
  ) {
    throw new Error('M04 evidence manifest and report must be regular files.');
  }
};

const requireManifestLines = (content) => {
  if (!content.endsWith('\n') || content.includes('\r')) {
    throw new Error('Evidence manifest does not use the canonical line format.');
  }

  const lines = content.slice(0, -1).split('\n');

  if (
    lines.some((line) => {
      const match = manifestLinePattern.exec(line);
      return match === null || match[2] === '';
    })
  ) {
    throw new Error('Evidence manifest does not use the canonical line format.');
  }

  return lines;
};

const assertPreexistingBaseManifestIsValid = async (finalManifest) => {
  const finalLines = requireManifestLines(finalManifest);
  const reportLine = finalLines.at(-1);

  if (
    finalLines.length !== baseArtifactCount + 1 ||
    !reportLine?.endsWith(`  ${milestoneReportRelativePath}`)
  ) {
    throw new Error('Final evidence manifest does not contain the expected report entry.');
  }

  const expectedBaseManifest = `${finalLines.slice(0, -1).join('\n')}\n`;
  const observedBaseManifest = await readFile(manifest, 'utf8');

  if (
    requireManifestLines(observedBaseManifest).length !== baseArtifactCount ||
    observedBaseManifest !== expectedBaseManifest
  ) {
    throw new Error('Pre-existing evidence manifest does not match the 20 base artifacts.');
  }
};

await access(milestoneReport);
await assertEvidenceDestinationIsAuthorized();
await assertEvidencePackageIsComplete(evidenceDirectory);
await assertEvidenceIsSanitized(evidenceDirectory);
const finalManifest = await renderEvidenceManifest(evidenceDirectory);

await assertPreexistingBaseManifestIsValid(finalManifest);
await assertEvidenceDestinationIsAuthorized();
try {
  await writeFile(temporaryManifest, finalManifest, {
    encoding: 'utf8',
    flag: 'wx',
  });
  await rename(temporaryManifest, manifest);
} finally {
  await rm(temporaryManifest, { force: true });
}
await assertEvidencePackageIsComplete(evidenceDirectory);
await assertEvidenceManifestIsValid(evidenceDirectory);
await assertEvidenceIsSanitized(evidenceDirectory);

console.log('M04 evidence finalization: PASS');
console.log('MILESTONE_REPORT.md is covered by MANIFEST.sha256');

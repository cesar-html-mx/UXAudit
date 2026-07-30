import { access, lstat, open, readFile, realpath, rename } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  assertEvidenceIsSanitized,
  assertEvidenceJsonIsCanonical,
  assertEvidenceManifestIsValid,
  assertEvidencePackageIsComplete,
  baseEvidenceArtifactCount,
  evidenceManifestRelativePath,
  milestoneReportRelativePath,
  renderEvidenceManifest,
} from './m05-evidence-contract.mjs';

const rootDirectory = process.cwd();
const evidenceParentDirectory = path.join(rootDirectory, 'evidence');
const evidenceDirectory = path.join(evidenceParentDirectory, 'm05-reporting');
const milestoneReport = path.join(evidenceDirectory, milestoneReportRelativePath);
const manifest = path.join(evidenceDirectory, evidenceManifestRelativePath);
const temporaryManifest = path.join(
  evidenceDirectory,
  `.${evidenceManifestRelativePath}.${String(process.pid)}.tmp`,
);
const manifestLinePattern = /^([a-f0-9]{64}) {2}([^\r\n]+)$/u;

const sameIdentity = (left, right) => left.dev === right.dev && left.ino === right.ino;

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
    throw new Error('M05 evidence destination is not a regular in-repository directory.');
  }

  const [evidenceParentRealPath, evidenceRealPath] = await Promise.all([
    realpath(evidenceParentDirectory),
    realpath(evidenceDirectory),
  ]);

  if (
    evidenceParentRealPath !== path.join(rootRealPath, 'evidence') ||
    evidenceRealPath !== path.join(evidenceParentRealPath, 'm05-reporting')
  ) {
    throw new Error('M05 evidence destination resolves outside the repository.');
  }

  const [currentEvidenceParentMetadata, currentEvidenceMetadata, manifestMetadata, reportMetadata] =
    await Promise.all([
      lstat(evidenceParentDirectory),
      lstat(evidenceDirectory),
      lstat(manifest),
      lstat(milestoneReport),
    ]);

  if (
    !sameIdentity(evidenceParentMetadata, currentEvidenceParentMetadata) ||
    !sameIdentity(evidenceMetadata, currentEvidenceMetadata)
  ) {
    throw new Error('M05 evidence destination changed during authorization.');
  }

  const [manifestRealPath, reportRealPath] = await Promise.all([
    realpath(manifest),
    realpath(milestoneReport),
  ]);

  if (
    manifestRealPath !== path.join(evidenceRealPath, evidenceManifestRelativePath) ||
    reportRealPath !== path.join(evidenceRealPath, milestoneReportRelativePath)
  ) {
    throw new Error('M05 evidence manifest or report resolves outside the approved destination.');
  }

  if (
    !manifestMetadata.isFile() ||
    manifestMetadata.isSymbolicLink() ||
    !reportMetadata.isFile() ||
    reportMetadata.isSymbolicLink()
  ) {
    throw new Error('M05 evidence manifest and report must be regular files.');
  }

  return {
    directory: currentEvidenceMetadata,
    manifest: manifestMetadata,
    parent: currentEvidenceParentMetadata,
    report: reportMetadata,
  };
};

const assertAuthorizationIsUnchanged = (expected, observed) => {
  if (
    !sameIdentity(expected.parent, observed.parent) ||
    !sameIdentity(expected.directory, observed.directory) ||
    !sameIdentity(expected.manifest, observed.manifest) ||
    !sameIdentity(expected.report, observed.report)
  ) {
    throw new Error('M05 evidence destination changed before manifest publication.');
  }
};

const assertTemporaryManifestIsAuthorized = async (expectedIdentity) => {
  const [metadata, temporaryRealPath] = await Promise.all([
    lstat(temporaryManifest),
    realpath(temporaryManifest),
  ]);

  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    !sameIdentity(metadata, expectedIdentity) ||
    temporaryRealPath !== temporaryManifest
  ) {
    throw new Error('Temporary evidence manifest changed before publication.');
  }
};

const createTemporaryManifest = async (content, authorization) => {
  const handle = await open(temporaryManifest, 'wx', 0o600);

  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    const handleMetadata = await handle.stat();
    const pathMetadata = await lstat(temporaryManifest);

    if (
      !handleMetadata.isFile() ||
      !pathMetadata.isFile() ||
      pathMetadata.isSymbolicLink() ||
      !sameIdentity(handleMetadata, pathMetadata)
    ) {
      throw new Error('Temporary evidence manifest identity is invalid.');
    }

    const currentAuthorization = await assertEvidenceDestinationIsAuthorized();

    assertAuthorizationIsUnchanged(authorization, currentAuthorization);
    await assertTemporaryManifestIsAuthorized(handleMetadata);

    return handleMetadata;
  } finally {
    await handle.close();
  }
};

const publishTemporaryManifest = async (temporaryIdentity, authorization) => {
  const currentAuthorization = await assertEvidenceDestinationIsAuthorized();

  assertAuthorizationIsUnchanged(authorization, currentAuthorization);
  await assertTemporaryManifestIsAuthorized(temporaryIdentity);
  await rename(temporaryManifest, manifest);
};

/*
  Keep the finalizer's fixed-path mutation small and fail closed. If any operation fails after the
  exclusive temporary file is created, it is deliberately retained for manual inspection: deleting
  it through a pathname after an ancestor substitution would be unsafe.
*/

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
    finalLines.length !== baseEvidenceArtifactCount + 1 ||
    !reportLine?.endsWith(`  ${milestoneReportRelativePath}`)
  ) {
    throw new Error('Final evidence manifest does not contain the expected report entry.');
  }

  const expectedBaseManifest = `${finalLines.slice(0, -1).join('\n')}\n`;
  const observedBaseManifest = await readFile(manifest, 'utf8');

  if (
    requireManifestLines(observedBaseManifest).length !== baseEvidenceArtifactCount ||
    observedBaseManifest !== expectedBaseManifest
  ) {
    throw new Error('Pre-existing evidence manifest does not match the 22 base artifacts.');
  }
};

await access(milestoneReport);
await assertEvidenceDestinationIsAuthorized();
await assertEvidencePackageIsComplete(evidenceDirectory);
await assertEvidenceIsSanitized(evidenceDirectory);
await assertEvidenceJsonIsCanonical(evidenceDirectory);
const finalManifest = await renderEvidenceManifest(evidenceDirectory);

await assertPreexistingBaseManifestIsValid(finalManifest);
const publicationAuthorization = await assertEvidenceDestinationIsAuthorized();
const temporaryIdentity = await createTemporaryManifest(finalManifest, publicationAuthorization);

await publishTemporaryManifest(temporaryIdentity, publicationAuthorization);
await assertEvidencePackageIsComplete(evidenceDirectory);
await assertEvidenceManifestIsValid(evidenceDirectory);
await assertEvidenceIsSanitized(evidenceDirectory);
await assertEvidenceJsonIsCanonical(evidenceDirectory);

console.log('M05 evidence finalization: PASS');
console.log('MILESTONE_REPORT.md is covered by MANIFEST.sha256');

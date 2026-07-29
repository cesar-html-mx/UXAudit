import { access, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  assertEvidenceIsSanitized,
  assertEvidenceManifestIsValid,
  assertEvidencePackageIsComplete,
  evidenceManifestRelativePath,
  milestoneReportRelativePath,
  renderEvidenceManifest,
} from './m03-evidence-contract.mjs';

const evidenceDirectory = path.join(process.cwd(), 'evidence', 'm03-parsing');
const milestoneReport = path.join(evidenceDirectory, milestoneReportRelativePath);
const manifest = path.join(evidenceDirectory, evidenceManifestRelativePath);
const temporaryManifest = path.join(
  evidenceDirectory,
  `.${evidenceManifestRelativePath}.${String(process.pid)}.tmp`,
);

await access(milestoneReport);
await assertEvidenceIsSanitized(evidenceDirectory);
try {
  await writeFile(temporaryManifest, await renderEvidenceManifest(evidenceDirectory), {
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

console.log('M03 evidence finalization: PASS');
console.log('MILESTONE_REPORT.md is covered by MANIFEST.sha256');

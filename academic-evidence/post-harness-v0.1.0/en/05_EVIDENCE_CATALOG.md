[Español](../es/05_EVIDENCE_CATALOG.md) | **English**

# Evidence catalog

## Public and Git-verifiable evidence

| ID          | Class | Evidence and supported claim                                                                                                                                                                                                                                                    |
| ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EV-PH-001` | `B`   | [`2fa29c7`](https://github.com/cesar-html-mx/UXAudit/commit/2fa29c72ba37ce19ab0ddef27a6da0d679bb5f47) closes M06 with the archived harness complete.                                                                                                                            |
| `EV-PH-002` | `A`   | [Pull request #9](https://github.com/cesar-html-mx/UXAudit/pull/9) integrates M06 into `main`.                                                                                                                                                                                  |
| `EV-PH-003` | `A`   | [Pull request #10](https://github.com/cesar-html-mx/UXAudit/pull/10) integrates bilingual post-M06 documentation.                                                                                                                                                               |
| `EV-PH-004` | `B`   | [`harness-complete-v1`](https://github.com/cesar-html-mx/UXAudit/tree/harness-complete-v1) preserves the complete harness and evidence before public cleanup.                                                                                                                   |
| `EV-PH-005` | `A`   | [Pull request #11](https://github.com/cesar-html-mx/UXAudit/pull/11) prepares the public npm distribution and product-facing repository.                                                                                                                                        |
| `EV-PH-006` | `A`   | [Failed Product Quality run](https://github.com/cesar-html-mx/UXAudit/actions/runs/30569151477) records the Windows/macOS portability defects instead of hiding them.                                                                                                           |
| `EV-PH-007` | `B`   | [`cf8e4d6`](https://github.com/cesar-html-mx/UXAudit/commit/cf8e4d69d86d08e2905d79002d2a3194dd87d024) corrects path and symlinked-entry portability.                                                                                                                            |
| `EV-PH-008` | `A`   | [Corrected Product Quality run](https://github.com/cesar-html-mx/UXAudit/actions/runs/30570680109) passes the release branch on all three operating systems.                                                                                                                    |
| `EV-PH-009` | `B`   | [`v0.1.0`](https://github.com/cesar-html-mx/UXAudit/tree/v0.1.0) is an annotated tag targeting merge commit `6668d8f`.                                                                                                                                                          |
| `EV-PH-010` | `A`   | [Publication run](https://github.com/cesar-html-mx/UXAudit/actions/runs/30589077315) and [publish job](https://github.com/cesar-html-mx/UXAudit/actions/runs/30589077315/job/91027158681) completed successfully.                                                               |
| `EV-PH-011` | `A`   | [npm package page](https://www.npmjs.com/package/@cesar-html-mx/uxaudit/v/0.1.0) and [registry metadata](https://registry.npmjs.org/%40cesar-html-mx%2Fuxaudit/0.1.0) expose version, binary, engines, repository, and integrity.                                               |
| `EV-PH-012` | `A`   | [Public attestations](https://registry.npmjs.org/-/npm/v1/attestations/%40cesar-html-mx%2Fuxaudit@0.1.0) bind the package digest to the tag, workflow, commit, and run.                                                                                                         |
| `EV-PH-013` | `A`   | [Public `main` branch API](https://api.github.com/repos/cesar-html-mx/UXAudit/branches/main) reports protection and the five required status-check contexts.                                                                                                                    |
| `EV-PH-014` | `A`   | [Public environments API](https://api.github.com/repos/cesar-html-mx/UXAudit/environments) reports the `npm` environment and a custom deployment branch policy.                                                                                                                 |
| `EV-PH-015` | `A`   | [Pull request #12](https://github.com/cesar-html-mx/UXAudit/pull/12) migrates the current publication workflow to OIDC and passes all reported checks.                                                                                                                          |
| `EV-PH-016` | `B`   | [Current release workflow permalink](https://github.com/cesar-html-mx/UXAudit/blob/de540f0ec3d3a7d198905eccd06eae46bc3ac3e7/.github/workflows/release.yml) contains OIDC permissions and no token variable.                                                                     |
| `EV-PH-017` | `B`   | [OIDC regression test permalink](https://github.com/cesar-html-mx/UXAudit/blob/de540f0ec3d3a7d198905eccd06eae46bc3ac3e7/tests/release-workflow.test.ts) requires OIDC and rejects token names.                                                                                  |
| `EV-PH-018` | `A`   | [PR #12 Product Quality](https://github.com/cesar-html-mx/UXAudit/actions/runs/30590618128), [CodeQL](https://github.com/cesar-html-mx/UXAudit/actions/runs/30590618131), and [Dependency Review](https://github.com/cesar-html-mx/UXAudit/actions/runs/30590618120) succeeded. |
| `EV-PH-019` | `B`   | [`main` at `de540f0`](https://github.com/cesar-html-mx/UXAudit/commit/de540f0ec3d3a7d198905eccd06eae46bc3ac3e7) is the verified source state after OIDC migration.                                                                                                              |
| `EV-PH-020` | `A`   | [Repository API](https://api.github.com/repos/cesar-html-mx/UXAudit) reports the repository as public with `main` as default and the MIT license.                                                                                                                               |
| `EV-PH-021` | `A`   | [Environment deployment policies](https://api.github.com/repos/cesar-html-mx/UXAudit/environments/npm/deployment-branch-policies) report `v*.*.*` as a tag pattern.                                                                                                             |
| `EV-PH-022` | `A`   | At the cutoff, the public [environment API](https://api.github.com/repos/cesar-html-mx/UXAudit/environments/npm) exposes no required reviewer and the [rulesets API](https://api.github.com/repos/cesar-html-mx/UXAudit/rulesets) returns an empty list.                        |

## Maintainer confirmations not publicly reproducible

These controls cannot be fully inspected through an unauthenticated public API. They should be
supported by redacted screenshots or an authenticated settings export when used in an academic
submission.

| ID          | Class | Maintainer-confirmed state                                                                                                  |
| ----------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| `EV-PH-C01` | `C`   | Detailed `main` protection requires pull requests, current branches, resolved conversations, linear history, and no bypass. |
| `EV-PH-C02` | `C`   | The bootstrap secret used for `v0.1.0` held a short-lived granular npm token.                                               |
| `EV-PH-C03` | `C`   | npm account 2FA is enabled and required for write actions.                                                                  |
| `EV-PH-C04` | `C`   | npm Trusted Publisher names GitHub Actions, `cesar-html-mx/UXAudit`, `release.yml`, environment `npm`, and `npm publish`.   |
| `EV-PH-C05` | `C`   | GitHub environment secret `NPM_TOKEN` was deleted after pull request #12 merged.                                            |
| `EV-PH-C06` | `C`   | The temporary npm granular token was revoked; the access-token page displayed zero tokens.                                  |
| `EV-PH-C07` | `C`   | Package access uses `Require two-factor authentication and disallow bypass 2FA tokens (recommended)`.                       |

## Session-observed validation

| ID          | Class | Observation                                                                                                                                          |
| ----------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EV-PH-D01` | `D`   | A temporary Vite React/TypeScript consumer installed `@cesar-html-mx/uxaudit@0.1.0` from npm and resolved `ux-audit` as version `0.1.0`.             |
| `EV-PH-D02` | `D`   | The consumer scan parsed two source files, ran eight rules successfully, produced nine findings and zero processing errors, and generated JSON/HTML. |
| `EV-PH-D03` | `D`   | `npm run audit:ux` produced the same nine findings, and `tsc -b && vite build` completed successfully.                                               |
| `EV-PH-D04` | `D`   | The final 54-package consumer dependency audit reported zero known vulnerabilities at validation time.                                               |
| `EV-PH-D05` | `D`   | The temporary consumer was moved to trash and the UXAudit checkout remained clean.                                                                   |

## Suggested screenshot attachments

The following filenames are recommendations for the maintainer's existing screenshots. They are not
included in this branch because conversation attachments were not available as original local
files.

| Filename                                  | Supported evidence |
| ----------------------------------------- | ------------------ |
| `C01-main-protection-required-checks.png` | `EV-PH-C01`        |
| `C02-initial-npm-token-properties.png`    | `EV-PH-C02`        |
| `C03-npm-account-2fa-enabled.png`         | `EV-PH-C03`        |
| `C04-npm-trusted-publisher.png`           | `EV-PH-C04`        |
| `C05-github-npm-token-secret-removed.png` | `EV-PH-C05`        |
| `C06-npm-token-revoked-zero-tokens.png`   | `EV-PH-C06`        |
| `C07-npm-publishing-access-hardened.png`  | `EV-PH-C07`        |
| `D01-pr11-portability-failure.png`        | `EV-PH-006`        |
| `D02-pr11-all-checks-passed.png`          | `EV-PH-008`        |
| `D03-pr12-all-checks-passed.png`          | `EV-PH-015`        |
| `D04-codeql-success.png`                  | `EV-PH-018`        |

No screenshot should expose an npm token, GitHub secret, recovery code, session cookie, password,
private source path, or authentication challenge. Crop unrelated browser chrome and redact private
values before including an image in a submission.

## Reproduction notes

- Public API and registry links are preferred over screenshots for independently reproducible facts.
- Commit and workflow permalinks are preferred over moving branch links.
- A branch pushed to this public repository is publicly discoverable even when it is never merged
  into `main`; review and redact every attachment before publishing it.
- `v0.1.0` has an annotated Git tag and a GitHub-rendered tag page. The REST Release endpoint returns
  no authored GitHub Release object; do not describe autogenerated source archives as a maintained
  binary release.
- The initial publish run used the tagged workflow and its temporary token configuration. The current
  OIDC workflow exists only after pull request #12.
- Machine-readable exact values are duplicated in
  [`evidence-sources.json`](../data/evidence-sources.json).

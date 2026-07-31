[Español](../es/01_POST_HARNESS_REPORT.md) | **English**

# Post-harness report

## Record

| Field               | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| Project             | UXAudit                                                      |
| Academic scope      | Operationalization and first public distribution             |
| Record cutoff       | `2026-07-30` in `America/Mexico_City`                        |
| Formal harness      | `complete`; M01–M06 complete; no active milestone or task    |
| Archival boundary   | `harness-complete-v1`                                        |
| Public version      | `@cesar-html-mx/uxaudit@0.1.0`                               |
| Public branch state | `main` at `de540f0ec3d3a7d198905eccd06eae46bc3ac3e7`         |
| Evidence branch     | `evidence/post-harness-v0.1.0`; intentionally not for merger |

## Boundary with the harness

The formal harness ended on branch `milestone/m06-integration-validation` at commit `2fa29c7`. Its
state records `status: complete`, completed milestones M01–M06, no active milestone or task, no
blockers, and a final `PASS` verification with `619/619` tests. Running the archived
`validate-harness.mjs` and `show-status.mjs` scripts again from that branch returned `PASS` and
reported the same completed lifecycle.

Pull request #9 integrated M06 into `main`. Pull request #10 then added the durable bilingual
documentation policy as post-M06 maintenance without changing product behavior. The annotated tag
`harness-complete-v1` points to the result after #10 and preserves the complete internal harness and
evidence before public cleanup.

For this dossier, everything after `harness-complete-v1` is unambiguously post-harness. The dossier
does not modify archived state or claim additional harness milestones.

## Outcome

- The repository was converted into a public product-facing source tree while the internal history
  remained available through tags, commits, and milestone branches.
- Public documentation was aligned in Latin American Spanish and English.
- The CLI was packaged as `@cesar-html-mx/uxaudit`, with `ux-audit` as its executable.
- Cross-platform CI was corrected and passed on Linux, Windows, and macOS.
- `main` was protected with required product quality, CodeQL, and Dependency Review checks.
- The annotated tag `v0.1.0` triggered the first successful npm publication with provenance.
- The temporary bootstrap credential was removed after npm Trusted Publishing was configured.
- Pull request #12 converted the current release workflow to tokenless OIDC authentication.
- A clean Vite React/TypeScript consumer installed `0.1.0`, ran the CLI, generated JSON and HTML, and
  built successfully.

## Chronology

All timestamps in this table use UTC so the record is independent of the reader's locale.

| Timestamp                  | Event                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `2026-07-30T08:23:17Z`     | Commit `2fa29c7` closed M06 with the harness in `complete` state.                                                                |
| `2026-07-30T15:04:47Z`     | Pull request #9 merged M06 into `main` as `8e0e327`.                                                                             |
| `2026-07-30T16:30:14Z`     | Pull request #10 merged bilingual public documentation as `f9fb70c`.                                                             |
| `2026-07-30T17:07:48Z`     | Annotated tag `harness-complete-v1` archived `f9fb70c`, including the complete harness and evidence.                             |
| `2026-07-30T18:09:03Z`     | Pull request #11 opened from `release/public-v0.1.0`.                                                                            |
| `2026-07-30T18:09:09Z`     | Initial PR #11 quality run failed on Windows and macOS, exposing portability assumptions.                                        |
| `2026-07-30T18:24:48Z`     | Commit `cf8e4d6` corrected portable path handling and symlinked-path script execution.                                           |
| `2026-07-30T18:30:14Z`     | Corrected PR #11 quality run started and later passed on Linux, Windows, and macOS.                                              |
| `2026-07-30T18:33:48Z`     | Pull request #11 merged as `6668d8f`, producing the public distribution source state.                                            |
| `2026-07-30T22:58:39Z`     | Annotated tag `v0.1.0` was created at `6668d8f`.                                                                                 |
| `2026-07-30T23:00:10Z`     | GitHub Actions began release run `30589077315` for tag `v0.1.0`.                                                                 |
| `2026-07-30T23:01:38.023Z` | npm registered `@cesar-html-mx/uxaudit@0.1.0` and assigned the `latest` dist-tag.                                                |
| `2026-07-30T23:01:42Z`     | Release run `30589077315` completed with `success`.                                                                              |
| `2026-07-30T23:28:22Z`     | Pull request #12 opened to remove token use from the current workflow and enforce OIDC by test.                                  |
| `2026-07-30T23:33:37Z`     | Pull request #12 merged as `de540f0`; all nine reported checks had succeeded.                                                    |
| Post-merge session         | The GitHub secret was deleted, the npm token was revoked, package access was hardened, and a real consumer validation completed. |

## Decisions and rationale

### Preserve history without exposing it in the user path

The completed harness, milestone evidence, and implementation history were retained through the
annotated archive tag and branches. They were removed only from the public `main` tree so installation
and contribution documentation would describe the product instead of the internal execution
mechanism.

### Bootstrap first, migrate immediately

The package did not exist before `0.1.0`, so a package-specific Trusted Publisher relationship could
not complete the whole bootstrap alone. The tagged workflow proves that the first publication used
an npm secret in a tag-scoped GitHub environment; the maintainer confirmed that the secret contained
a short-lived granular token. Once the package existed, the maintainer configured Trusted
Publishing, merged a workflow that no longer consumes a reusable npm publication credential,
deleted the GitHub secret, revoked the npm token, and selected the restrictive package access
policy.

### Avoid an artificial release

No synthetic `0.1.1` was published solely to exercise OIDC. The workflow configuration and regression
test are verified now; its first operational OIDC publication will occur with the next legitimate
version.

## Residual limitations

- Detailed npm access policy, token inventory, secret inventory, and some branch protection settings
  are platform state unavailable through the public APIs used here. They are recorded as maintainer
  confirmations.
- The current OIDC workflow has not yet published a version. Its live result must be added after the
  next legitimate release.
- The repository's automated publication path is constrained by the workflow, environment tag
  policy, and Trusted Publisher identity, but it is not the only technical publication path: an npm
  maintainer can still publish interactively with 2FA. At the record cutoff, no tag ruleset or
  required environment reviewer was publicly observed.
- The consumer project and generated reports were temporary. Results and observed digests are
  documented, but the temporary files were moved to trash and were not committed. Exact dependency
  resolution cannot be reconstructed because the lockfile and generated artifacts were not retained.
- A static-analysis result is review guidance; the nine findings observed in the Vite project are not
  a certification of that project's accessibility, UX, SEO, or performance.
- At the record cutoff, the GitHub repository description still called UXAudit a “planned” tool.
  Updating that administrative description to reflect the published CLI remains a non-blocking
  maintainer follow-up.

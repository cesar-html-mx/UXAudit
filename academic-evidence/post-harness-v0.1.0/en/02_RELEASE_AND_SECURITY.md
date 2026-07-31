[Español](../es/02_RELEASE_AND_SECURITY.md) | **English**

# Release and security evidence

## Repository controls

The public repository API reports `cesar-html-mx/UXAudit` as public, with `main` as its default
branch. The public branch endpoint reports `main` as protected and exposes these required checks:

- `Node 24 / ubuntu-24.04`
- `Node 24 / windows-2025`
- `Node 24 / macos-15`
- `Analyze JavaScript and TypeScript`
- `Review dependency changes`

The detailed protection endpoint requires authenticated administrative access. The maintainer
separately confirmed that changes require a pull request, required branches must be current before
merger, conversations must be resolved, linear history is required, and the configured protection
cannot be bypassed. Those detailed statements are class `C`, while protected status and required
check names are class `A`.

The public environments endpoint reports one environment named `npm` with a custom deployment branch
policy. Its public deployment-policy endpoint reports the exact pattern `v*.*.*` with type `tag`;
this is class `A` evidence. At the record cutoff, the environment endpoint exposed only the branch
policy and no required reviewer, while the repository rulesets endpoint returned an empty list.
Secret names and values are not available through the public API.

## Cross-platform correction

The first Product Quality run for pull request #11 failed rather than being bypassed. Windows exposed
a path separator assumption in a system-validation manifest test. macOS exposed script-entry
detection that was not stable through a symlinked repository path.

Commit `cf8e4d6` accepted both portable directory separators and used `import.meta.main`, with a
symlink-path regression test. The corrected run passed on Ubuntu, Windows, and macOS before #11 was
merged. This failure-and-correction sequence is retained because it demonstrates evidence-based
portability work.

## Initial npm publication

The annotated tag `v0.1.0` points to commit `6668d8f`, the squash merge of pull request #11. The tag
is not cryptographically signed; this dossier does not claim otherwise. GitHub renders a tag page and
automatic source archives, but the REST API does not report an authored GitHub Release object.

Release run `30589077315`:

1. was triggered by a push of `refs/tags/v0.1.0`;
2. validated that the tag matched `package.json`;
3. required the tagged commit to be contained in `main`;
4. installed the lockfile and ran `npm run release:check`;
5. published with public access and npm provenance;
6. completed with `success`.

The workflow stored at the `v0.1.0` tag still supplied `NODE_AUTH_TOKEN` from the `NPM_TOKEN`
environment secret. Therefore the initial npm authentication used that bootstrap credential. The
workflow proves the secret reference, but not the secret value, token type, scope, or expiration;
the maintainer separately confirmed that it was a short-lived granular npm token, a class `C` fact.
The existing `id-token: write` permission supported provenance; it must not be misrepresented as
Trusted Publishing authentication for `0.1.0`.

## Published artifact and provenance

| Field                  | Verified value                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Package                | `@cesar-html-mx/uxaudit`                                                                                                           |
| Version / dist-tag     | `0.1.0` / `latest`                                                                                                                 |
| Registry timestamp     | `2026-07-30T23:01:38.023Z`                                                                                                         |
| Executable             | `ux-audit` → `dist/cli/index.js`                                                                                                   |
| License                | `MIT`                                                                                                                              |
| Node engine            | `>=24.18.0 <25`                                                                                                                    |
| npm engine             | `>=11.16.0 <12`                                                                                                                    |
| SHA-1                  | `58d2ccd0ef52434b1c37ab91cdf3a8982e368f9f`                                                                                         |
| SHA-512 subject digest | `bcdc2d28810d940557205bb25cffac6ce5e3a74ce7ae42e32b2670777ce3766a1bade9e2df518d972179b40ee4124e1fd68295a2f2fc49ab328848f075fd830d` |
| SLSA predicate         | `https://slsa.dev/provenance/v1`                                                                                                   |
| Provenance source      | `refs/tags/v0.1.0`, `.github/workflows/release.yml`, commit `6668d8f`                                                              |
| Provenance invocation  | `https://github.com/cesar-html-mx/UXAudit/actions/runs/30589077315/attempts/1`                                                     |

The public attestation endpoint returns both the npm publish attestation and SLSA provenance. The
SLSA subject digest matches the tarball integrity metadata. The npm registry also publishes its own
package signature; that registry signature is distinct from the unsigned Git tag.

## Migration to Trusted Publishing

After the package existed, the maintainer configured npm Trusted Publishing for:

| Setting              | Value            |
| -------------------- | ---------------- |
| Publisher            | `GitHub Actions` |
| Organization or user | `cesar-html-mx`  |
| Repository           | `UXAudit`        |
| Workflow filename    | `release.yml`    |
| Environment          | `npm`            |
| Allowed action       | `npm publish`    |

These backend settings are maintainer-confirmed platform state and are class `C`. Their compatible
repository configuration is publicly reproducible:

- `.github/workflows/release.yml` grants `id-token: write`;
- the publish job uses `environment: npm`;
- the job runs
  `npm publish --access public --ignore-scripts --provenance --tag "$NPM_DIST_TAG"`;
- the current workflow contains neither `NPM_TOKEN` nor `NODE_AUTH_TOKEN`;
- `tests/release-workflow.test.ts` prevents those token names from being reintroduced and requires
  the OIDC permission, environment, and publication command.

Pull request #12 passed Product Quality on all three operating systems, CodeQL, and Dependency Review
before merger.

## Credential retirement and access hardening

After #12 merged, the maintainer confirmed these platform actions:

1. the GitHub environment secret `NPM_TOKEN` was deleted;
2. the maintainer-confirmed short-lived granular npm token was revoked, with the npm account showing
   zero access tokens;
3. account two-factor authentication remained enabled and required for write actions;
4. package publishing access was changed to
   `Require two-factor authentication and disallow bypass 2FA tokens (recommended)`;
5. the npm Trusted Publisher relationship remained configured.

The current public workflow proves it does not consume a reusable npm publication credential. It
cannot independently prove deletion from secret stores or the npm account policy, so those controls
remain class `C`.

## Current security posture

- Normal source changes use protected branches, pull requests, and required CI checks.
- The repository's automated npm publication path is constrained to matching version tags, the `npm`
  environment, the release workflow, and the Trusted Publisher identity.
- No reusable npm write credential is required by the current repository workflow.
- This automated path is not technically exclusive. npm documents that the selected package policy
  blocks granular access tokens but still allows a maintainer to publish interactively with 2FA.
- Protecting `main` does not itself protect release tags. At the cutoff, no tag ruleset or required
  environment reviewer was publicly observed. Before the next release, add those controls or record
  the explicit exception; npm recommends tag protection and deployment approvals for Trusted
  Publishing.
- The next legitimate version will provide the first public operational evidence that OIDC
  authentication succeeds end to end.
- No secret, token, recovery-code, or credential value is recorded in this dossier.

The relevant current guidance is npm's
[Trusted Publishing security guidance](https://docs.npmjs.com/trusted-publishers/), npm's
[package 2FA behavior](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/),
and GitHub's
[environment protection documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

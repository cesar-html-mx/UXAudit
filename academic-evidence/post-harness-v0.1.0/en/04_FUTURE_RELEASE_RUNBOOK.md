[Español](../es/04_FUTURE_RELEASE_RUNBOOK.md) | **English**

# Future release runbook

## Principle

Source changes and pull requests do not require an npm token. Git authentication continues to handle
branches and pull requests. npm authentication is needed only by the publication job, and the
current design obtains a short-lived OIDC identity automatically from GitHub Actions.

Do not create another reusable npm publication token, do not add `NPM_TOKEN` or `NODE_AUTH_TOKEN`,
and do not run `npm publish` locally. An interactive publish with 2FA remains technically possible,
but it is outside this project's controlled release procedure.

## Preconditions

Before preparing a version, confirm:

- `main` is clean and synchronized with `origin/main`;
- the new semantic version has never been published;
- `package.json`, `package-lock.json`, and `PRODUCT_VERSION` in `src/index.ts` will use the same
  version;
- the GitHub environment remains named `npm`;
- npm Trusted Publishing still names `cesar-html-mx/UXAudit`, `release.yml`, and `npm`;
- `.github/workflows/release.yml` still has `id-token: write` and no token environment variable;
- Node.js and npm satisfy the engines declared by the package.

Before the next publication, also close or explicitly record these two security gaps:

- add an active GitHub tag ruleset for `v*.*.*` that controls release-tag creation, update, and
  deletion; protecting `main` alone does not protect tags;
- require approval for the GitHub `npm` environment and prevent self-review when a distinct reviewer
  is available. For a single-maintainer academic repository without a second reviewer, record that
  exception instead of claiming independent approval.

npm recommends both tag protection and deployment approvals for Trusted Publishing. For an even
stronger future posture, consider changing the Trusted Publisher to `npm stage publish` only and
requiring interactive 2FA approval of each staged artifact. That is a separate design change, not a
prerequisite for documenting the current workflow.

## Prepare the change

The commands below use `0.1.1` only as an example. Replace it with the intended unused version.

```bash
(
  set -euo pipefail
  git switch main
  git pull --ff-only origin main
  git status --short --branch
  git switch -c release/v0.1.1
  npm ci
  npm version 0.1.1 --no-git-tag-version
)
```

Update `PRODUCT_VERSION` in `src/index.ts` to `0.1.1`, then verify all three version locations:

```bash
node --input-type=module -e "import packageManifest from './package.json' with { type: 'json' }; console.log(packageManifest.version)"
rg -n '"version": "0.1.1"' package.json package-lock.json
rg -n "PRODUCT_VERSION.*0.1.1" src/index.ts
```

Update English and Latin American Spanish documentation whenever observable behavior changes.
Then run the release gate:

```bash
npm run release:check
npm pack --dry-run
git diff --check
git status --short
```

Review the diff, create a conventional commit, and push only the release branch:

```bash
(
  set -euo pipefail
  git add package.json package-lock.json src/index.ts
  git commit -m "chore(release): prepare v0.1.1"
  git push -u origin release/v0.1.1
)
```

Add any behavior, test, or documentation files that legitimately belong to that release before the
commit. The three-file `git add` example is only the minimum version-only case.

## Pull request and merger

Create a pull request from `release/v0.1.1` to `main`. Do not bypass:

- Product Quality on Ubuntu, Windows, and macOS;
- CodeQL;
- Dependency Review;
- the up-to-date branch requirement;
- unresolved-conversation protection.

Use the repository's linear-history merger. After the pull request is merged, synchronize locally
and repeat the complete release gate from the exact `main` commit that will be tagged:

```bash
(
  set -euo pipefail
  git switch main
  git pull --ff-only origin main
  git status --short --branch
  npm ci
  npm run release:check
)
```

## Create and push the release tag

Confirm again that the package version is `0.1.1`. Verify that the tag ruleset is active, or record
the approved single-maintainer exception before continuing. Then create one annotated tag:

```bash
(
  set -euo pipefail
  RELEASE_VERSION=0.1.1
  RELEASE_TAG="v${RELEASE_VERSION}"

  if git rev-parse --verify --quiet "refs/tags/${RELEASE_TAG}" >/dev/null; then
    printf 'Refusing to continue: local tag %s already exists.\n' "$RELEASE_TAG" >&2
    exit 1
  fi

  REMOTE_TAG_MATCHES=$(git ls-remote --tags origin "refs/tags/${RELEASE_TAG}")
  if [[ -n "$REMOTE_TAG_MATCHES" ]]; then
    printf 'Refusing to continue: remote tag %s already exists.\n' "$RELEASE_TAG" >&2
    exit 1
  fi

  git tag -a "$RELEASE_TAG" -m "Release ${RELEASE_TAG}"
  git show --no-patch --decorate "$RELEASE_TAG"
  git push origin "refs/tags/${RELEASE_TAG}"
)
```

Pushing the tag is the publication trigger. Do not invoke npm publication yourself.

## Verify the OIDC publication

Open the `Publish npm package` run triggered by the tag and verify:

1. the workflow source is the tagged commit;
2. `Validate tag and package version` succeeds;
3. `Require release commit on main` succeeds;
4. `Run release quality gate` succeeds;
5. `Publish through npm trusted publishing` succeeds;
6. the run does not request an `NPM_TOKEN` secret;
7. the registry contains the exact new version and expected dist-tag;
8. public attestations bind the package digest to the tag, workflow, commit, and run.

After the registry entry exists, verify it from a clean consumer:

```bash
(
  set -euo pipefail
  npm view @cesar-html-mx/uxaudit@0.1.1 version dist.integrity
  UXAUDIT_SOURCE_ROOT=$(git rev-parse --show-toplevel)
  UXAUDIT_CONSUMER_PARENT=$(mktemp -d)

  case "$UXAUDIT_CONSUMER_PARENT" in
    "$UXAUDIT_SOURCE_ROOT" | "$UXAUDIT_SOURCE_ROOT"/*)
      printf 'Refusing to scaffold inside UXAudit: %s\n' "$UXAUDIT_CONSUMER_PARENT" >&2
      exit 1
      ;;
  esac

  printf 'Consumer evidence directory: %s\n' "$UXAUDIT_CONSUMER_PARENT"
  cd -- "$UXAUDIT_CONSUMER_PARENT"
  npm create vite@9.1.2 uxaudit-release-consumer -- --template react-ts
  cd -- uxaudit-release-consumer
  npm install
  npm install --save-dev @cesar-html-mx/uxaudit@0.1.1
  npm exec --offline -- ux-audit --version
  npm exec --offline -- ux-audit scan .
  npm run build
)
```

Record the temporary directory and evidence paths, then move that exact consumer directory to trash
after retaining the sanitized lockfile, command output, and reports needed for reproducibility.

The first legitimate version after `0.1.0` is especially important: its successful run will be the
first operational proof of the current Trusted Publishing/OIDC path. Add that run and attestation to
this academic record or its successor.

## Failure handling

### Failure before the tag

Fix the issue on the release branch, rerun the required checks, and merge through another reviewed
commit. No npm state has changed.

### Failure after pushing the tag

First determine registry truth; do not infer publication state only from the workflow conclusion:

```bash
npm view @cesar-html-mx/uxaudit@0.1.1 version dist.integrity --json
```

Also inspect the public attestation endpoint for that exact package version. If the version exists,
npm accepted the publication even if the job later failed or lost its response. Treat it as
published, retain the failure evidence, and follow the immutable-version procedure below.

If the version does not exist:

- for a transient platform failure or a correction limited to the private Trusted Publisher
  configuration, rerun the same GitHub Actions run. Confirm the rerun retains the same tag, ref, and
  commit;
- if the artifact or tagged workflow must change, fix it through a pull request, choose another
  unused version, and create a new tag.

Never force-move a public tag to different code. A skipped version is safer evidence than mutable
release history.

For an OIDC authentication failure, inspect:

- exact npm Trusted Publisher owner, repository, workflow filename, and environment;
- `permissions: id-token: write`;
- job `environment: npm`;
- supported npm version;
- tag and `main` ancestry;
- whether the package access policy or publisher relationship changed.

Do not solve an OIDC configuration failure by restoring a long-lived token.

### Failure after publication

npm versions are immutable. Do not overwrite, reuse, or move the published version. Correct the
problem in a new patch or otherwise appropriate semantic version. If necessary, deprecate the
affected version with a clear message after reviewing npm policy.

## Evidence to retain for each release

- pull request URL and merge commit;
- successful required-check URLs;
- annotated tag object and target commit;
- publication run and job URLs;
- npm version timestamp, dist-tag, integrity, and tarball URL;
- publish and SLSA attestation URLs;
- clean-consumer installation, version, scan, and build summary;
- any failure, diagnosis, correction, and rerun;
- explicit confirmation that no reusable npm publication token was introduced.

Current platform guidance:

- [npm Trusted Publishing and security practices](https://docs.npmjs.com/trusted-publishers/)
- [npm staged publishing](https://docs.npmjs.com/cli/v11/commands/npm-stage/)
- [GitHub tag rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)
- [GitHub deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)

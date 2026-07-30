[Español](es/11_INFRASTRUCTURE.md) | **English**

# Infrastructure and distribution

## User runtime

UXAudit is a local Node.js CLI. The supported runtime is Node.js `>=24.18.0 <25`; npm
`>=11.16.0 <12` is supported for installation and project scripts. The target React project does not
need a server, database, container, browser, or UXAudit-specific build integration.

```bash
npm install --save-dev @cesar-html-mx/uxaudit
npm exec --offline -- ux-audit scan .
```

The scan runs in the caller's process environment and uses the local filesystem. Product execution
does not require network access.

## Public npm artifact

The npm package is `@cesar-html-mx/uxaudit`; the binary is `ux-audit`. The published tarball contains
only:

- compiled runtime files below `dist/`;
- public JSON schemas below `schemas/`;
- `LICENSE`;
- `README.md`, `README.en.md`, and `README.es.md`;
- npm-generated package metadata.

Repository source, tests, fixtures, local reports, internal records, development scripts, and GitHub
automation are not part of the consumer artifact. UXAudit is distributed as a CLI, not as a public
importable JavaScript library API.

The package build emits ESM JavaScript, declarations, and source maps. The executable entry is
`dist/cli/index.js`, and package installation links it as `ux-audit`.

## Source development environment

Contributors use the pinned runtime and lockfile:

```bash
nvm install
nvm use
npm ci
npm run verify
```

`npm ci` installs development tooling only in a repository checkout. Package consumers do not run the
repository verification workflow or Git hooks. Contributors can opt into local hooks with
`npm run setup:hooks`.

## Continuous integration

The quality workflow should run on supported Linux, Windows, and macOS environments. It checks
formatting, bilingual documentation, lint, strict types, tests, build, compiled CLI behavior, and
installation from the packed npm artifact. Linux additionally runs coverage, dependency audit, and
the full controlled system validations.

Dependency Review and CodeQL protect repository changes when the GitHub plan and repository settings
make them available. Third-party actions remain pinned to reviewed immutable commit hashes, and
Dependabot proposes controlled dependency and workflow updates.

Hosted CI status is separate from local claims. A check is reported as executed only when its actual
run result is available.

## Release gate

Before publishing:

```bash
npm ci
npm run release:check
npm pack --dry-run
```

`npm run release:check` composes the complete local quality, controlled-system, robustness,
accuracy, and package-installation checks. `prepack` rebuilds `dist/`. `prepublishOnly` is a local
safety net when a maintainer publishes without `--ignore-scripts`; the automated workflow runs the
gate explicitly and then uses `npm publish --ignore-scripts` to avoid running it twice.

The package test creates a temporary tarball and consumer project, verifies the allowlisted contents,
installs without relying on repository state, resolves the binary, and runs representative help,
version, and scan commands.

## Publication

Publishing requires the authorized `cesar-html-mx` npm account, current registry authentication,
two-factor or trusted-publisher policy as configured, and an unused semantic version. The package is
configured for public access and npm provenance.

The initial public version is `0.1.0`. Versions below `1.0.0` may still evolve, so compare the
documented contract and repository changes before upgrading. Publish every version deliberately;
never reuse or overwrite a version that already reached the registry.

### Automated release workflow

The repository publishes only from `.github/workflows/release.yml` after a tag named `vX.Y.Z` is
pushed. The workflow rejects a tag whose version differs from `package.json` or whose commit is not
contained in `main`. It then runs the complete release gate and publishes with npm provenance.

For the first publication:

1. enable two-factor authentication on the npm account that owns the package scope;
2. make the GitHub repository public and protect the `main` branch;
3. create a GitHub environment named `npm` and restrict it to release tags or approved deployments;
4. create a granular npm token with the shortest practical expiration, `Packages and scopes` set to
   `Read and write`, `Select packages` set to `All Packages`, and `Bypass 2FA` enabled; a package that
   does not exist cannot yet be selected individually;
5. add the token only as the `NPM_TOKEN` secret of the `npm` environment; never store its value in
   the repository;
6. after the first package version exists, configure npm Trusted Publishing for repository
   `cesar-html-mx/UXAudit`, workflow `release.yml`, and environment `npm`;
7. delete the `NPM_TOKEN` secret, revoke the temporary token, and set package publishing access to
   `Require two-factor authentication and disallow tokens`.

For every version, update `package.json`, `package-lock.json`, and `PRODUCT_VERSION` in
`src/index.ts` to the same unused semantic version. Merge that change through the normal pull request
and CI path. From a clean, up-to-date `main`, validate and create the release tag:

```bash
npm ci
npm run release:check
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

Do not run `npm publish` locally. Confirm the GitHub Actions run and the registry entry before
announcing the version.

## Artifacts and persistence

UXAudit does not deploy a service. Its only product artifacts are terminal output and optional local
JSON/HTML files under the analyzed project. The default file directory is `uxaudit-reports`.
Reports are created exclusively and are not overwritten.

The repository's build output `dist/`, coverage output, temporary tarballs, and test reports are
reproducible development artifacts and are not source-controlled as product data.

## Portability

- Product paths use Node.js path APIs and portable project-relative configuration.
- Output directory validation rejects absolute paths, backslashes, parent segments, control
  characters, unsafe Windows names, and platform-invalid components.
- Tests distinguish portable guarantees from permissions, links, or process measurements that vary
  by operating system.
- The CLI requires no graphical environment and reports text as UTF-8.

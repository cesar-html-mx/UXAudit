# M01 ExecPlan — Repository bootstrap and CLI foundation

## Purpose and observable outcome

Create a buildable, testable TypeScript CLI project. A developer can request help and invoke
`ux-audit scan <project-path>`. The application validates the initial path and returns clear typed
errors, but it does not yet discover or parse project files.

## Repository context and prerequisites

Read `docs/01_PROJECT_CONTEXT.md`, `02_PRODUCT_SPEC.md`, `03_REQUIREMENTS.md`,
`05_ENGINEERING_STANDARDS.md`, `09_ACCEPTANCE_CRITERIA.md`, and `11_INFRASTRUCTURE.md`.

The repository currently contains the harness but may not contain `package.json` or product code.
Inspect before creating files.

## Scope

- Node/npm/TypeScript ESM scaffold.
- strict compiler configuration and build output.
- Commander CLI entry and `scan` command.
- path existence/directory/access validation.
- typed application request/error boundary.
- Vitest, coverage, ESLint, Prettier, Husky.
- CI and initial developer documentation.
- unit and CLI smoke tests.

## Out of scope

- recursive discovery;
- parsing;
- rules;
- reports beyond minimal CLI messaging;
- target application execution.

## Requirements and traceability

RF-01, RF-02, RNF-03, and RNF-09. RNF-08 remains assigned to M02/M03: M01 establishes the
TypeScript/JavaScript toolchain but does not yet discover, classify, or parse `.ts`, `.tsx`, `.js`,
or `.jsx`. Update `docs/12_TRACEABILITY_MATRIX.md` with actual filenames and test identifiers.

## Architecture and contracts

Create only enough structure to preserve the planned packages. The CLI maps user input to an
application request. Path validation is not embedded in Commander option definitions. Product
logic must be callable from tests without spawning a shell.

## Milestone tasks

### M01-T01 — Initialize Node and TypeScript project

- Create package metadata, ESM build, strict `tsconfig`, source and test structure.
- Define supported Node engine without inventing infrastructure.
- Add build, dev, typecheck, and clean scripts.
- Verify a minimal build.
- Status: completed on 2026-07-29 with Node.js `24.18.0`. Typecheck and build passed.

### M01-T02 — Configure quality and test toolchain

- Configure ESLint, Prettier, Vitest, coverage, and Husky.
- Add `format`, `format:check`, `lint`, `typecheck`, `test`, `test:coverage`, `build`, and `verify`.
- Commit the lockfile.
- Do not introduce unapproved production dependencies.
- Status: completed on 2026-07-29. The Node.js 24 quality gate, typed linting, deterministic
  formatting, V8 coverage thresholds, and pre-commit verification all passed.

### M01-T03 — Create CLI entry point and scan command

- Use Commander.
- Provide help/version behavior and required project path.
- Delegate to an application-level scan request.
- Establish intended exit-code handling without claiming later pipeline behavior.
- Status: completed on 2026-07-29. Help, version, scan delegation, required arguments, and
  unexpected-failure handling passed unit tests and built-CLI smoke checks.

### M01-T04 — Implement input and project-path validation

- Validate existence, directory type, and accessibility.
- Use typed errors and path APIs.
- Cover valid directory, missing path, regular file, and access/error behavior where portable.
- Do not traverse project content yet.
- Status: completed on 2026-07-29. Canonicalization, directory/access checks, typed error mapping,
  portable injected failures, CLI exit behavior, and built valid/invalid-path smokes passed.

### M01-T05 — Establish CI, documentation, and evidence baseline

- Make current GitHub workflows execute real project checks.
- Update README usage and developer setup.
- Store command outputs and environment summary in `evidence/m01-bootstrap/`.
- Update state, traceability, session log, and this plan.
- Status: completed on 2026-07-29. The Node.js 24 cross-platform workflows, portable smoke runner,
  M01 documentation, sanitized clean-room evidence, and dependency/security baseline passed local
  verification.

## Validation and acceptance

Run:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
node dist/cli/index.js --help
node dist/cli/index.js scan .
node .github/harness/scripts/validate-harness.mjs
```

Acceptance is defined by M01 in `docs/09_ACCEPTANCE_CRITERIA.md`.

## Evidence to retain

- tool versions;
- `npm run verify` output;
- CLI help output;
- valid and invalid path smoke output;
- coverage summary;
- commit and branch identifiers.

## Progress

- [x] Milestone started.
- [x] Repository inspected and plan reconciled with reality.
- [x] Tasks completed.
- [x] Quality gate passed.
- [x] Evidence collected.
- [x] Documentation and traceability updated.
- [x] Milestone closed and state advanced.

## Discoveries

- At the owner's explicit request, the first unpublished M01 attempt was discarded and the local
  milestone branch was restored to the clean harness commit `4959dba`. Generated `node_modules/`,
  `dist/`, and `coverage/` artifacts from that attempt were removed.
- Node.js `24.18.0` (Krypton LTS) and npm `11.16.0` are installed locally. The supported contract is
  constrained to Node.js 24/npm 11 because later major lines are not in the CI matrix. The
  interactive shell default remains Node.js 22, so every M01 command explicitly selects Node.js 24.
- Registry metadata checked on 2026-07-29 identifies Commander `15.0.0`, ESLint `10.8.0`,
  TypeScript ESLint `8.65.0`, Vitest/coverage `4.1.10`, Prettier `3.9.6`, Husky `9.1.7`, and tsx
  `4.23.1` as current stable releases.
- TypeScript `7.0.2` is current, but TypeScript ESLint `8.65.0` supports TypeScript
  `>=4.8.4 <6.1.0`. TypeScript `6.0.3` is therefore the newest stable mutually compatible compiler;
  forcing TypeScript 7 would violate npm's peer contract.
- The newest Node.js 24 declarations are `@types/node` `24.13.3`.
- npm `11.16.0` reports dependency install scripts that have not been reviewed. The only T01 script
  belongs to esbuild `0.28.1`, pulled by tsx, and is explicitly approved at that exact version in
  `package.json`; no unreviewed install scripts remain.
- ESLint 10 flat configuration requires the project to declare `@eslint/js` and `globals`
  explicitly. This avoids relying on transitive packages and allows Node ESM globals without
  enabling CommonJS-only globals such as `require` or `__dirname`.
- Prettier established the first repository-wide formatting baseline. The resulting existing-file
  changes are mechanical; generated outputs, raw evidence, the lockfile, and architecture diagrams
  are excluded.
- Commander `15.0.0` supports the Node.js 24 contract and provides overridable output and exit
  behavior. This lets unit tests exercise the actual command definition without spawning a child
  process.
- The M01-T03 application action only normalizes the requested path and reports that a scan request
  was prepared. It deliberately does not claim the path is valid or that discovery occurred; path
  validation remains M01-T04 and traversal remains M02.
- A review found that M01-T03 had left two root `dependencies` keys in `package.json` after npm and
  the implementation patch both added Commander. npm resolved the same effective dependency, but
  duplicate JSON keys are ambiguous for other consumers; T04 removed the duplicate before closure.
- An independent acceptance review found that the CLI still imported project-layer error types
  directly. T05 applied the existing application-boundary decision by translating path failures
  into `ScanProjectError`; the CLI now depends only on the application contract.
- `fs.access` is a preflight check, not a durable authorization guarantee. `X_OK` also has different
  effective semantics on Windows. M02 must handle real operation failures and re-check canonical
  descendant containment while traversing.
- A user may deliberately select a root through `..` or a symlink. M01 returns that root's exact
  canonical `realpath`; it does not confine the chosen root to the current working directory.
  Path-escape protection applies to descendants of this selected canonical root in M02.
- Current official GitHub action releases were pinned to full immutable SHAs: checkout `7.0.1`,
  setup-node `7.0.0`, upload-artifact `7.0.1`, CodeQL `4.37.3`, and Dependency Review `5.0.0`.
  Dependabot remains responsible for reviewed action updates.
- Dependency Review availability varies for private repositories. Its job runs automatically for
  public repositories and can be enabled for a private repository with GitHub Code Security by
  setting `DEPENDENCY_REVIEW_ENABLED=true`.
- The evidence collector copied the complete working tree to an isolated temporary workspace,
  executed a clean lockfile installation and every retained check, rejected personal paths/token
  patterns, and copied only sanitized records into `evidence/m01-bootstrap/`. It identifies the
  exact copied snapshot with a SHA-256 tree digest and hashes every core artifact in a manifest;
  reproducibility checks reject incomplete, unsanitized, integrity-invalid, source-mismatched, or
  result-mismatched retained evidence.
- The original plan listed RNF-08 under M01 even though discovery/classification/parsing are
  explicitly out of scope. The plan was reconciled to RF-01, RF-02, RNF-03, and RNF-09; RNF-08
  remains truthfully planned and traced to M02/M03.
- npm 11's `allowScripts` policy is advisory unless `strict-allow-scripts=true`. M01 enables strict
  enforcement, approves only esbuild `0.28.1`, and explicitly denies optional fsevents scripts so
  the macOS matrix cannot execute an unreviewed lifecycle script.
- Node cannot execute Windows `.cmd` wrappers directly without a command shell, while passing
  arguments with `shell:true` is deprecated for injection risk. The quality and evidence runners
  therefore execute npm's JavaScript CLI through `process.execPath`, preserving shell-free
  cross-platform behavior.
- Final acceptance review confirmed the M01 contracts and identified only an unasserted public
  `scan --help` path. A focused regression now verifies its successful, side-effect-free behavior.
- Final security review reproduced ANSI/OSC/BEL injection through canonical paths, Commander
  diagnostics, and unexpected error messages. The CLI boundary now renders C0/C1, bidirectional,
  reflected line breaks, and line-separator controls as visible Unicode escapes, with focused
  hostile-output regressions.
- npm audit and Dependency Review now fail at moderate severity rather than accepting moderate
  dependency vulnerabilities.
- Remote workflows could not be executed or observed before publication. The local evidence states
  this explicitly; the three-platform matrix becomes authoritative when the branch is pushed.

## Decision log

- Raise the project baseline to Node.js 24 at the owner's explicit direction. Pin the development
  runtime in `.nvmrc`, declare Node.js `>=24.18.0 <25` and npm `>=11.16.0 <12`, and use those major
  lines in CI and evidence.
- Select current stable dependency releases from registry metadata, constrained by declared engine
  and peer compatibility. Use TypeScript `6.0.3` until stable TypeScript ESLint supports 7.
- Keep Commander as the only M01 production dependency and defer Babel packages to M03.
- Pin direct dependencies exactly and commit the npm lockfile. Dependabot remains responsible for
  proposing reviewed updates instead of allowing installation-time range drift.
- Use the ESLint 10 flat API with type-aware strict and stylistic TypeScript rules, reject warnings,
  and require 90% coverage for statements, branches, functions, and lines. Keep the process-only CLI
  entry outside unit coverage and cover it with smoke tests in M01-T05.
- Keep process arguments, streams, and `exitCode` in `src/cli/index.ts`. Make `runCli` depend on
  injected I/O and an application-level `ScanProject` function, with exit codes 0 for success/help,
  2 for command/input errors, and 3 for unexpected application failures.
- Validate the selected root with `resolve` → `realpath` → `stat` → `access(R_OK | X_OK)`. Map
  missing/non-directory/inaccessible input to stable typed errors and exit 2; map unknown filesystem
  failures to a safe validation error and exit 3. Preserve native causes for programmatic diagnosis
  but never print them at the CLI boundary.
- Use the exact `.nvmrc` Node.js 24 runtime on Ubuntu 24.04, Windows 2025, and macOS 15. Pin actions
  by full SHA, disable persisted checkout credentials, use minimum permissions and bounded
  timeouts, run the shared gate/smokes everywhere, and retain Linux-only coverage/audit evidence.

## Risks and recovery

- Raising the minimum runtime intentionally drops Node.js 20/22 support from the original default.
  The owner approved this M01 contract change, and documentation, CI, and evidence must remain
  consistent with Node.js 24.
- Fast-moving toolchain majors can conflict even when individually current. The lockfile, strict
  peer-resolution, dependency audit, and recorded registry metadata are the recovery controls.
- Never store or interpolate GitHub credentials in repository files, command arguments, logs, or
  evidence. Remote publication must use a safely configured credential helper or GitHub CLI.
- GitHub Actions have been inspected and formatted locally, but only a remote run can verify hosted
  runner/action availability. Workflow dispatch, pull-request checks, and retained coverage are the
  recovery controls after publication.

## Outcomes and retrospective

M01 now provides an ESM/strict-TypeScript CLI on Node.js 24 with current compatible tooling,
Commander help/version/scan behavior, canonical root validation, typed safe errors, portable unit
and smoke tests, hardened cross-platform CI configuration, complete developer documentation, and a
sanitized evidence package.

The clean evidence run passed 31 tests in 4 files, 100% statements/branches/functions/lines, six
compiled CLI scenarios, harness validation, and an npm audit reporting zero known vulnerabilities.
The product still does not traverse, parse, evaluate rules, or create reports; M02 owns safe
discovery and canonical descendant containment.

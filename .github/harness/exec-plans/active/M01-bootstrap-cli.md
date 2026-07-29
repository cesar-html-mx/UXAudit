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

RF-01, RF-02, RNF-03, RNF-08, RNF-09. Update `docs/12_TRACEABILITY_MATRIX.md` with actual
filenames and test identifiers.

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

### M01-T05 — Establish CI, documentation, and evidence baseline

- Make current GitHub workflows execute real project checks.
- Update README usage and developer setup.
- Store command outputs and environment summary in `evidence/m01-bootstrap/`.
- Update state, traceability, session log, and this plan.

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
- [ ] Tasks completed.
- [ ] Quality gate passed.
- [ ] Evidence collected.
- [ ] Documentation and traceability updated.
- [ ] Milestone closed and state advanced.

## Discoveries

- At the owner's explicit request, the first unpublished M01 attempt was discarded and the local
  milestone branch was restored to the clean harness commit `4959dba`. Generated `node_modules/`,
  `dist/`, and `coverage/` artifacts from that attempt were removed.
- Node.js `24.18.0` (Krypton LTS) and npm `11.16.0` are installed locally. The interactive shell
  default remains Node.js 22, so every M01 command will explicitly select the Node.js 24 toolchain.
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

## Decision log

- Raise the project baseline to Node.js 24 at the owner's explicit direction. Pin the development
  runtime in `.nvmrc`, declare Node.js `>=24` in package metadata, and use Node.js 24 in CI and
  evidence.
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

## Risks and recovery

- Raising the minimum runtime intentionally drops Node.js 20/22 support from the original default.
  The owner approved this M01 contract change, and documentation, CI, and evidence must remain
  consistent with Node.js 24.
- Fast-moving toolchain majors can conflict even when individually current. The lockfile, strict
  peer-resolution, dependency audit, and recorded registry metadata are the recovery controls.
- Never store or interpolate GitHub credentials in repository files, command arguments, logs, or
  evidence. Remote publication must use a safely configured credential helper or GitHub CLI.

## Outcomes and retrospective

At closure, describe what now works, what was actually verified, remaining limitations, commits, and
the next milestone.

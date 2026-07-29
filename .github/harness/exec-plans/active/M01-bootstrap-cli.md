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

### M01-T02 — Configure quality and test toolchain

- Configure ESLint, Prettier, Vitest, coverage, and Husky.
- Add `format`, `format:check`, `lint`, `typecheck`, `test`, `test:coverage`, `build`, and `verify`.
- Commit the lockfile.
- Do not introduce unapproved production dependencies.

### M01-T03 — Create CLI entry point and scan command

- Use Commander.
- Provide help/version behavior and required project path.
- Delegate to an application-level scan request.
- Establish intended exit-code handling without claiming later pipeline behavior.

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

- [ ] Milestone started.
- [ ] Repository inspected and plan reconciled with reality.
- [ ] Tasks completed.
- [ ] Quality gate passed.
- [ ] Evidence collected.
- [ ] Documentation and traceability updated.
- [ ] Milestone closed and state advanced.

## Discoveries

Record implementation facts, library behavior, and assumptions discovered during work.

## Decision log

Record decisions made within the authority allowed by `AGENTS.md`.

## Risks and recovery

Maintain task-specific risks, rollback steps, and any remaining debt.

## Outcomes and retrospective

At closure, describe what now works, what was actually verified, remaining limitations, commits, and
the next milestone.


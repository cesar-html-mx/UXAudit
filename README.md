# UXAudit

UXAudit is a local, static-analysis CLI for React and TypeScript projects. Milestone M01 delivers a
production-oriented Node.js/TypeScript foundation: the executable can show help and version
information, accept `scan <project-path>`, validate and canonicalize the selected project root, and
return stable exit codes and messages.

Discovery, parsing, rules, and terminal/JSON/HTML audit reports are later milestones. The current
`scan` command does not inspect project files and must not be interpreted as a completed audit.

## Requirements

- Node.js `24.18.0` LTS (the repository pins it in `.nvmrc`)
- npm `11.16.0` or later in the npm 11 line
- Git

With nvm:

```bash
nvm install
nvm use
npm ci
```

The package enforces Node.js 24, exact direct dependency versions, strict peer resolution, and a
reviewed dependency-install script allowlist.

## Use the CLI

Build first, then invoke the compiled executable:

```bash
npm run build
node dist/cli/index.js --help
node dist/cli/index.js --version
node dist/cli/index.js scan .
```

A valid directory produces its canonical path:

```text
Project path validated: <canonical-project-path>
```

Empty, missing, regular-file, and inaccessible paths are rejected before any traversal. Native
filesystem causes and stack traces are not printed for typed path errors. Control and bidirectional
characters, including injected line breaks, in project paths, command errors, and unexpected
messages are rendered as visible Unicode escapes before reaching the terminal.

Current M01 exit codes:

| Code | Meaning                                                                               |
| ---: | ------------------------------------------------------------------------------------- |
|  `0` | Help/version completed or the selected project root was validated.                    |
|  `1` | Reserved for a future completed audit that meets a configured finding-failure policy. |
|  `2` | Invalid command, missing argument, or invalid/inaccessible project root.              |
|  `3` | Unexpected application failure or an unclassified filesystem validation failure.      |

## Develop and verify

```bash
npm run dev -- scan .
npm run verify
npm run test:coverage
npm run test:smoke
```

Useful individual commands:

| Command                 | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `npm run format`        | Apply the repository Prettier baseline.                         |
| `npm run format:check`  | Reject formatting drift.                                        |
| `npm run lint`          | Run warning-free ESLint 10 typed rules.                         |
| `npm run typecheck`     | Run strict TypeScript checks without emission.                  |
| `npm test`              | Run focused Vitest tests once.                                  |
| `npm run test:coverage` | Run V8 coverage with 90% global thresholds.                     |
| `npm run build`         | Emit ESM JavaScript, declarations, and source maps to `dist/`.  |
| `npm run test:smoke`    | Build and execute six CLI scenarios without a shell.            |
| `npm run verify`        | Run format, lint, typecheck, unit tests, and build in one gate. |

Husky invokes `npm run verify` before local commits. CI is configured for Node.js 24 on Ubuntu
24.04, Windows 2025, and macOS 15; coverage and dependency audit run on Linux. GitHub actions are
pinned to immutable release SHAs and Dependabot tracks updates. Dependency Review and CodeQL run
for public repositories; private repositories can enable them with `DEPENDENCY_REVIEW_ENABLED=true`
and `CODEQL_ENABLED=true` after confirming GitHub Code Security availability.

## M01 boundaries

- Local CLI only; no service, database, telemetry, or product network dependency.
- Static analysis only; analyzed code is never executed or imported.
- Root validation is a preflight. M02 must still handle filesystem races and confine every
  discovered canonical descendant to the selected canonical root.
- No recursive discovery, JSX/TSX parsing, rule execution, or reports yet.

## Repository map

- `src/cli/`: executable boundary and Commander adapter.
- `src/application/`: application request orchestration.
- `src/project/`: project-root validation; discovery follows in M02.
- `tests/`: focused application, CLI, and project tests.
- `.github/harness/`: milestone state, plans, decisions, risks, and lifecycle scripts.
- `.github/workflows/`: quality, harness, CodeQL, and dependency-review automation.
- `docs/`: product and engineering system of record.
- `evidence/`: reproducible milestone evidence.

Validate the harness at any time:

```bash
node .github/harness/scripts/validate-harness.mjs
node .github/harness/scripts/show-status.mjs
```

After M01 closes, the harness activates M02 — project discovery, inventory, and classification.

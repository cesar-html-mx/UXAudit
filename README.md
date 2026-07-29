# UXAudit

UXAudit is a local, static-analysis CLI for React and TypeScript projects. Milestone M02 extends the
Node.js 24 foundation with safe recursive project discovery, a normalized deterministic inventory,
and conservative `.js`, `.jsx`, `.ts`, and `.tsx` source-candidate classification.

The current `scan` command validates and canonicalizes the selected root, discovers files without
executing target code, and prints discovery counts. Parsing, rules, and terminal/JSON/HTML audit
reports are later milestones, so a successful M02 scan must not be interpreted as a completed
audit.

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

A valid directory produces its canonical path and one stable discovery summary:

```text
Project path validated: <canonical-project-path>
Discovery summary: discovered=<n> inventory=<n> candidates=<n> exclusions=<n> issues=<n>
```

The default traversal skips symbolic links and dependency, generated-output, cache, coverage, and
configuration names. The inventory retains canonical in-root file paths in stable project-relative
order; classification excludes declarations and conventionally named configuration sources without
reading file content or claiming React component semantics.

Empty, missing, regular-file, and inaccessible roots are rejected before traversal. Fatal discovery,
inventory, or classification failures use stable application messages; recoverable descendant
filesystem failures are counted as `issues` while safe siblings continue. Native filesystem causes
and stack traces are not printed. Control and bidirectional characters, including injected line
breaks, are rendered as visible Unicode escapes before reaching the terminal.

Current M02 exit codes:

| Code | Meaning                                                                               |
| ---: | ------------------------------------------------------------------------------------- |
|  `0` | Help/version completed or project discovery and classification completed safely.      |
|  `1` | Reserved for a future completed audit that meets a configured finding-failure policy. |
|  `2` | Invalid command, missing argument, or invalid/inaccessible project root.              |
|  `3` | Fatal processing failure or unexpected application failure.                           |

## Develop and verify

```bash
npm run dev -- scan .
npm run verify
npm run test:coverage
npm run test:smoke
npm run test:scenario:m02
```

Useful individual commands:

| Command                         | Purpose                                                                  |
| ------------------------------- | ------------------------------------------------------------------------ |
| `npm run format`                | Apply the repository Prettier baseline.                                  |
| `npm run format:check`          | Reject formatting drift.                                                 |
| `npm run lint`                  | Run warning-free ESLint 10 typed rules.                                  |
| `npm run typecheck`             | Run strict TypeScript checks without emission.                           |
| `npm test`                      | Run focused Vitest tests once.                                           |
| `npm run test:coverage`         | Run V8 coverage with 90% global thresholds.                              |
| `npm run build`                 | Emit ESM JavaScript, declarations, and source maps to `dist/`.           |
| `npm run test:smoke`            | Build and execute six CLI scenarios without a shell.                     |
| `npm run test:scenario:m02`     | Verify reviewed inventory, exclusions, links, determinism, and no exec.  |
| `npm run evidence:m02`          | Collect the isolated, sanitized, integrity-checked M02 evidence package. |
| `npm run evidence:m02:finalize` | Add the milestone report to the retained SHA-256 manifest.               |
| `npm run verify`                | Run format, lint, typecheck, unit tests, and build in one gate.          |

Husky invokes `npm run verify` before local commits. CI is configured for Node.js 24 on Ubuntu
24.04, Windows 2025, and macOS 15; coverage and dependency audit run on Linux. GitHub actions are
pinned to immutable release SHAs and Dependabot tracks updates. Dependency Review and CodeQL run
for public repositories; private repositories can enable them with `DEPENDENCY_REVIEW_ENABLED=true`
and `CODEQL_ENABLED=true` after confirming GitHub Code Security availability.

## M02 boundaries

- Local CLI only; no service, database, telemetry, or product network dependency.
- Static analysis only; analyzed code is never executed or imported.
- The canonical root is the traversal authorization boundary. Links are skipped by default; the
  internal opt-in follows only canonical in-root targets and prevents cycles.
- Discovery and inventory are candidate-producing stages, not permanent file authorization. M03
  must revalidate containment when opening each candidate.
- No JSX/TSX parsing, semantic React detection, rule execution, or reports yet.

## Repository map

- `src/cli/`: executable boundary and Commander adapter.
- `src/application/`: validation → discovery → inventory → classification orchestration.
- `src/project/`: root validation plus focused discovery, inventory, and classification modules.
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

After M02 closes, the harness activates M03 — source parsing and the normalized analysis model.

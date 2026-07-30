# UXAudit

UXAudit is a local, static-analysis CLI for React and TypeScript projects. The current Node.js 24
implementation safely discovers and classifies `.js`, `.jsx`, `.ts`, and `.tsx` source candidates,
parses them through an internal Babel boundary, and builds a deterministic parser-independent
analysis model. The completed M04 domain layer adds a deterministic isolated rule engine and eight
stable rules across accessibility, performance, SEO, and UX. The active M05 slice defines
versioned configuration defaults and loading, one immutable normalized `AuditResult`, complete
file/rule/finding/error summaries, and a pure deterministic terminal reporter.

The `scan` command validates and canonicalizes the selected root, discovers files, analyzes safe
source candidates without executing target code, and prints discovery and parsing counts. The CLI
does not invoke the rule/result/reporting layers yet. The terminal reporter is independently
implemented, while JSON/HTML and their CLI integration remain M05/M06, so a successful scan must
not be interpreted as a completed audit.

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

A valid directory produces its canonical path plus stable discovery and parsing summaries:

```text
Project path validated: <canonical-project-path>
Discovery summary: discovered=<n> inventory=<n> candidates=<n> exclusions=<n> issues=<n>
Parsing summary: parsed=<n> failed=<n> components=<n> jsx=<n>
```

The default traversal skips symbolic links and dependency, generated-output, cache, coverage, and
configuration names. The inventory retains canonical in-root file paths in stable project-relative
order; classification excludes declarations and conventionally named configuration sources without
reading file content or claiming React component semantics.

Empty, missing, regular-file, and inaccessible roots are rejected before traversal. Fatal discovery,
inventory, classification, root-authorization, batch-invariant, or model-invariant failures use
stable application messages. Recoverable descendant discovery failures are counted as `issues`;
recoverable read, syntax, and extraction failures are counted as `failed` while safe source siblings
continue into the model.

Source opening reauthorizes the canonical project root and candidate around a verified file-handle
read. A source file may contain at most 1 MiB and is read in chunks of at most 64 KiB; non-regular,
changed, outside-root, unreadable, oversized, and invalid-UTF-8 candidates fail closed. UTF-8 is
decoded strictly and an initial BOM is preserved for Babel. Native filesystem/Babel causes, source
text, absolute paths, and AST values do not leave their boundaries. Control and bidirectional
characters, including injected line breaks, are rendered as visible Unicode escapes before reaching
the terminal.

Current CLI exit codes:

| Code | Meaning                                                                               |
| ---: | ------------------------------------------------------------------------------------- |
|  `0` | Help/version completed or project discovery, parsing, and modeling completed safely.  |
|  `1` | Reserved for a future completed audit that meets a configured finding-failure policy. |
|  `2` | Invalid command, missing argument, or invalid/inaccessible project root.              |
|  `3` | Fatal processing failure or unexpected application failure.                           |

## Configure an audit

The configuration boundary loads optional `uxaudit.config.json` from an already canonical project
root, or a user-selected JSON file, without importing or executing it. This example requests all
three future reporters and restricts rules by category:

```json
{
  "schemaVersion": 1,
  "categories": ["accessibility", "seo"],
  "formats": ["terminal", "json", "html"],
  "minimumSeverity": "medium",
  "outputDirectory": "uxaudit-reports",
  "color": true,
  "verbose": false
}
```

Defaults are terminal output, `info`, color, non-verbose detail, `uxaudit-reports`, and the stable
rule catalog. `null` category/rule filters select that catalog; `[]` intentionally selects none.
Validated CLI overrides take precedence over file values, which take precedence over defaults.
Configuration files are strict UTF-8 JSON limited to 64 KiB, unknown keys and values are rejected,
and output directories must be portable project-relative paths. The loader is available internally
in M05; the current `scan` command does not expose `--config` or reporting options until M06.

The internal terminal reporter consumes one completed `AuditResult`. It keeps canonical finding
order, filters displayed details through the inclusive severity threshold, retains complete totals,
uses one-based human column labels, and shows normalized processing details only in verbose mode.
No-color output contains no escape bytes; color is limited to fixed badges after every dynamic value
has been converted to terminal-safe visible text. The CLI will expose this behavior in M06.

## Develop and verify

```bash
npm run dev -- scan .
npm run verify
npm run test:coverage
npm run test:smoke
npm run test:scenario:m02
npm run test:scenario:m03
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
| `npm run test:scenario:m03`     | Exercise the controlled four-kind parser/model scenario without exec.    |
| `npm run test:scenario:m04`     | Validate the deterministic eight-rule catalog without executing source.  |
| `npm run evidence:m02`          | Collect the isolated, sanitized, integrity-checked M02 evidence package. |
| `npm run evidence:m02:finalize` | Add the milestone report to the retained SHA-256 manifest.               |
| `npm run evidence:m03`          | Collect the isolated, sanitized, integrity-checked M03 evidence package. |
| `npm run evidence:m03:finalize` | Add the milestone report to the retained M03 SHA-256 manifest.           |
| `npm run evidence:m04`          | Collect the isolated, sanitized, integrity-checked M04 evidence package. |
| `npm run evidence:m04:finalize` | Add the milestone report to the retained M04 SHA-256 manifest.           |
| `npm run verify`                | Run format, lint, typecheck, unit tests, and build in one gate.          |

Husky invokes `npm run verify` before local commits. CI is configured for Node.js 24 on Ubuntu
24.04, Windows 2025, and macOS 15; coverage and dependency audit run on Linux. GitHub actions are
pinned to immutable release SHAs and Dependabot tracks updates. Dependency Review and CodeQL run
for public repositories; private repositories can enable them with `DEPENDENCY_REVIEW_ENABLED=true`
and `CODEQL_ENABLED=true` after confirming GitHub Code Security availability.

## Current boundaries

- Local CLI only; no service, database, telemetry, or product network dependency.
- Static analysis only; analyzed code is never executed or imported.
- The canonical root is the traversal authorization boundary. Links are skipped by default; the
  internal opt-in follows only canonical in-root targets and prevents cycles.
- Discovery and inventory remain candidate-producing stages, not permanent file authorization.
  Source opening revalidates root, path, regular-file identity, and bounded descriptor content.
- Babel AST and source text remain internal to the parsing package. Rules consume only the
  normalized `AnalysisModel`.
- Component recognition is intentionally syntactic and conservative; it does not resolve runtime
  aliases, higher-order abstractions, imports, or rendered behavior.
- The domain engine can produce normalized findings and isolated rule errors, and M05 can assemble
  them into an exact recursively frozen `AuditResult`; the CLI does not expose either layer yet.
  Configuration-file loading and terminal rendering are implemented as independent boundaries;
  finding-failure policy, CLI wiring, and JSON/HTML reports remain M05/M06 work.

## Repository map

- `src/cli/`: executable boundary and Commander adapter.
- `src/application/`: preserved scan pipeline plus the additive source-analysis/model facade.
- `src/project/`: root validation plus focused discovery, inventory, and classification modules.
- `src/parsing/`: bounded source reader, Babel-only AST adapter, extraction, and error-isolated
  candidate batch.
- `src/domain/models/`: parser-independent normalized analysis contracts and builder.
- `src/domain/rules/`, `findings/`, and `errors/`: report-independent rule result contracts.
- `src/domain/audit/`: versioned audit result, normalized processing errors, derived summaries, and
  invariant boundary.
- `src/rules/`: validated engine plus category-organized static rules.
- `src/configuration/`: bounded JSON reading, closed validation, precedence, immutable defaults,
  overrides, formats, filenames, and stable errors.
- `src/reporting/`: pure one-result reporter contract and deterministic terminal adapter; JSON,
  shared file writing, and HTML follow in M05.
- `src/shared/`: neutral terminal-value sanitization reused by CLI and reporting.
- `tests/`: focused domain, parser, rule, application, CLI, and project tests.
- `.github/harness/`: milestone state, plans, decisions, risks, and lifecycle scripts.
- `.github/workflows/`: quality, harness, CodeQL, and dependency-review automation.
- `docs/`: product and engineering system of record.
- `evidence/`: reproducible milestone evidence.

Validate the harness at any time:

```bash
node .github/harness/scripts/validate-harness.mjs
node .github/harness/scripts/show-status.mjs
```

Validate the compiled M04 domain catalog independently of the not-yet-integrated CLI:

```bash
npm run test:scenario:m04
```

The controlled scenario analyzes one inert TSX project, matches the reviewed eight-finding
expectation twice, exercises filtering and one isolated rule failure, and proves that target code is
not executed. `npm run evidence:m04` additionally reproduces the gate in an isolated,
credential-free source snapshot while M04-T05 is active.

This implementation slice evaluates M04 rules over parser-independent input without changing the
current CLI contract.

# UXAudit

UXAudit is a local, static-analysis CLI for React and TypeScript projects. The current Node.js 24
implementation safely discovers and classifies `.js`, `.jsx`, `.ts`, and `.tsx` source candidates,
parses them through an internal Babel boundary, and builds a deterministic parser-independent
analysis model. The completed M04 domain layer adds a deterministic isolated rule engine and eight
stable rules across accessibility, performance, SEO, and UX. The completed M05 reporting layer adds
versioned configuration defaults and loading, one immutable normalized `AuditResult`, complete
file/rule/finding/error summaries, pure deterministic terminal/lossless JSON/standalone HTML
reporters, and a shared exclusive local report writer.

The `scan` command validates and canonicalizes the selected root, loads inert JSON configuration
before source traversal and parsing, analyzes safe source candidates without executing target code,
evaluates the selected stable rules over one normalized model, and builds one immutable
`AuditResult`. It renders terminal output when selected and persists selected JSON/HTML reports
locally through the exclusive writer. Findings and recoverable discovery, source, or rule errors do
not by themselves make a completed audit fail.

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
node dist/cli/index.js scan ./project --format all --output reports --no-color --verbose
```

A valid directory preserves the canonical-path, discovery, and parsing progress lines before the
selected terminal report and any confirmed file-report paths:

```text
Project path validated: <canonical-project-path>
Discovery summary: discovered=<n> inventory=<n> candidates=<n> exclusions=<n> issues=<n>
Parsing summary: parsed=<n> failed=<n> components=<n> jsx=<n>
UXAudit <version>
...
```

The `scan` options are:

- `--config <path>` for an explicit inert JSON configuration;
- repeatable `--format <terminal|json|html|all>`, `--category <category>`, and `--rule <rule-id>`;
- `--output <directory>` for a portable project-relative report directory;
- `--severity <info|low|medium|high|critical>` for terminal detail only;
- `--no-color` and `--verbose`.

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

| Code | Meaning                                                                                                 |
| ---: | ------------------------------------------------------------------------------------------------------- |
|  `0` | Help/version or a completed audit, including findings and recoverable processing errors.                |
|  `1` | Reserved for a future configured finding-failure policy; `minimumSeverity` does not activate this code. |
|  `2` | Invalid command/argument, project root, or configuration input.                                         |
|  `3` | Fatal pipeline, invariant, unexpected application, or report-write failure.                             |

## Configure an audit

The configuration boundary loads optional `uxaudit.config.json` from an already canonical project
root, or a user-selected JSON file, without importing or executing it. This example requests all
three reporters and restricts rules by category:

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
and output directories must be portable project-relative paths. Only options explicitly supplied on
the command line become overrides, so Commander's default value for an absent `--no-color` option
cannot replace a file setting.

The terminal reporter consumes one completed `AuditResult`. It keeps canonical finding
order, filters displayed details through the inclusive severity threshold, retains complete totals,
uses one-based human column labels, and shows normalized processing details only in verbose mode.
No-color output contains no escape bytes; color is limited to fixed badges after every dynamic value
has been converted to terminal-safe visible text. The CLI writes this already safe output directly
so a second whole-report sanitizer cannot neutralize its fixed trusted ANSI.

The JSON reporter serializes the complete result with two-space indentation and one final
LF; it preserves timing and stored zero-based columns. JSON/HTML persistence accepts only the fixed
configured relative target, refuses links, path escape, and existing files, and returns a path only
after write, sync, close, and final authorization. The writer does not automatically remove a
partial target after failure because a pathname identity race can make deletion unsafe. Paths inside
`AuditResult` are configured targets; only a returned writer result is announced as generated.

The HTML reporter shows the complete result in fixed severity and processing-stage groups;
terminal thresholds and verbosity do not hide its records. It uses a restrictive CSP, constant
inline CSS, no scripts or external assets, visible hostile-Unicode neutralization followed by HTML
escaping, and inert fallback for any reference that is not reparsed as credential-free HTTP(S).
Human locations include one-based columns, UTF-16 offsets, and an explicit end-exclusive label.

## Develop and verify

```bash
npm run dev -- scan .
npm run verify
npm run test:coverage
npm run test:smoke
npm run test:accuracy:m06
npm run test:scenario:m02
npm run test:scenario:m03
npm run test:scenario:m04
npm run test:scenario:m05
npm run test:scenario:m06
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
| `npm run test:smoke`            | Build and execute eleven compiled CLI scenarios without a shell.         |
| `npm run test:accuracy:m06`     | Compare per-rule CLI findings with reviewed instance-level ground truth. |
| `npm run test:scenario:m02`     | Verify reviewed inventory, exclusions, links, determinism, and no exec.  |
| `npm run test:scenario:m03`     | Exercise the controlled four-kind parser/model scenario without exec.    |
| `npm run test:scenario:m04`     | Validate the deterministic eight-rule catalog without executing source.  |
| `npm run test:scenario:m05`     | Verify configuration and all reporters over one controlled result.       |
| `npm run test:scenario:m06`     | Audit five controlled projects twice through the complete built CLI.     |
| `npm run evidence:m02`          | Collect the isolated, sanitized, integrity-checked M02 evidence package. |
| `npm run evidence:m02:finalize` | Add the milestone report to the retained SHA-256 manifest.               |
| `npm run evidence:m03`          | Collect the isolated, sanitized, integrity-checked M03 evidence package. |
| `npm run evidence:m03:finalize` | Add the milestone report to the retained M03 SHA-256 manifest.           |
| `npm run evidence:m04`          | Collect the isolated, sanitized, integrity-checked M04 evidence package. |
| `npm run evidence:m04:finalize` | Add the milestone report to the retained M04 SHA-256 manifest.           |
| `npm run evidence:m05`          | Collect or verify the isolated, sanitized M05 evidence package.          |
| `npm run evidence:m05:finalize` | Add the milestone report to the retained M05 SHA-256 manifest.           |
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
- The complete CLI composes the domain engine, one recursively frozen `AuditResult`, and all three
  M05 reporters. It does not define a finding-failure policy; `minimumSeverity` affects terminal
  presentation only.
- Audit timing ends when the immutable result is built and excludes subsequent file persistence. A
  later file-write failure is exit `3`, may leave an already written sibling/partial target, and
  never produces a false generation claim or an unsafe automatic rollback.

## Repository map

- `src/cli/`: executable boundary and Commander adapter.
- `src/application/`: preserved scan and source-analysis facades plus the additive complete-audit
  orchestrator.
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
- `src/reporting/`: pure one-result terminal, lossless JSON, and escaped standalone HTML adapters
  plus shared exclusive JSON/HTML file writing.
- `src/shared/`: neutral terminal-value sanitization reused by CLI and reporting.
- `tests/`: focused domain, parser, rule, application, CLI, and project tests.
- `fixtures/m06-validation/`: reviewed valid, invalid, mixed, hostile/security, and generated-large
  project contracts.
- `.github/harness/`: milestone state, plans, decisions, risks, and lifecycle scripts.
- `.github/workflows/`: quality, harness, CodeQL, and dependency-review automation.
- `docs/`: product and engineering system of record.
- `evidence/`: reproducible milestone evidence.

Validate the harness at any time:

```bash
node .github/harness/scripts/validate-harness.mjs
node .github/harness/scripts/show-status.mjs
```

The M05 scenario remains available for independent configuration/reporter boundary validation:

```bash
npm run test:scenario:m05
```

That controlled scenario validates five configuration cases and renders one immutable result with
all severity and processing-stage buckets through terminal, JSON, and HTML twice. It verifies exact
cross-format projections, deterministic output, visible hostile-value escaping, restrictive HTML
CSP, and safe fixed-path writes without executing target code. `npm run evidence:m05` reproduces the
historical M05 gate in an isolated, credential-free source snapshot. The compiled CLI smoke suite
additionally executes the integrated default audit, all formats, configuration/CLI precedence, empty
rule filters, recoverable syntax, and existing-target refusal.

The M06 system scenario builds the CLI and audits five controlled projects twice in fresh temporary
roots:

```bash
npm run test:scenario:m06
```

The committed valid project produces no findings, the invalid project produces one finding for
each of the eight stable rules, and the mixed project exercises nested JavaScript/TypeScript,
excluded output, three controlled findings, and one recoverable syntax error. The runner also
constructs a hostile/security project with default-skipped links and a 240-file safe project from
versioned parameters. It verifies exit codes, exact terminal/JSON/HTML consistency, expected
finding/error counts, byte-identical stable projections, and absence of target-code sentinels.

`npm run test:accuracy:m06` executes the built JSON-report flow on the committed valid, invalid, and
mixed projects. It matches findings to 27 reviewed source instances by rule and half-open model
location, then records TP, FP, TN, FN, precision, recall, unmatched findings, and unsupported
observations for each stable rule. The current 1.0 precision/recall values describe only this small
controlled corpus; they are not a claim about arbitrary React projects or runtime behavior.

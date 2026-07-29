# Architecture

## Style

UXAudit uses a staged processing pipeline with application orchestration and domain contracts. The
main flow is intentionally directed:

```text
CLI
  -> AuditOrchestrator
  -> ProjectDiscovery
  -> FileInventory
  -> FileClassifier
  -> SourceParser
  -> AnalysisModelBuilder
  -> RuleLoader / RuleEvaluator
  -> AuditResult
  -> Terminal / JSON / HTML Reporters
```

## Packages

```text
src/
├── cli/
├── application/
├── project/
│   ├── discovery/
│   ├── inventory/
│   └── classification/
├── parsing/
├── domain/
│   ├── models/
│   ├── rules/
│   ├── findings/
│   └── errors/
├── rules/
│   ├── ux/
│   ├── accessibility/
│   ├── seo/
│   └── performance/
├── reporting/
│   ├── terminal/
│   ├── json/
│   └── html/
├── configuration/
└── shared/
```

The exact filenames may evolve, but the dependency direction and responsibility boundaries may not
be collapsed without an architecture decision.

## Implemented M01 slice

```text
src/cli/index.ts
  -> src/cli/run-cli.ts
       -> src/cli/sanitize-terminal.ts
  -> src/application/scan-project.ts
  -> src/project/validate-project-path.ts
```

- `cli/index.ts` is the only process boundary. It supplies arguments and streams and assigns
  `process.exitCode`.
- `run-cli.ts` owns Commander grammar and maps `ScanProjectError` application errors to terminal
  output and exit codes. It receives I/O and the scan application function as dependencies and does
  not import the project adapter. Its output boundary converts terminal control and bidirectional
  characters in untrusted values to visible Unicode escapes.
- `scan-project.ts` maps project-layer validation errors into its typed application boundary and
  returns the canonical root.
- `validate-project-path.ts` uses an injectable filesystem adapter to execute
  `resolve → realpath → stat → access(R_OK | X_OK)`.

This slice validates only the selected root. It neither traverses the root nor creates an
`AuditResult`.

## Core contracts

### ProjectDiscovery

Input: validated project root and discovery configuration.  
Output: discovered file records and recoverable discovery errors.

M02 implements this contract with an iterative, ordinally sorted traversal. The selected canonical
root remains the authorization boundary. Every candidate target is resolved canonically and checked
with path-relative containment; configured names are checked on both the observed entry and the
canonical target. Symbolic links are skipped by default, while the internal opt-in follows only
targets within the root and tracks visited canonical directories. Descendant operation failures are
normalized and isolated; losing the root is fatal.

### FileInventory

Normalizes canonical and project-relative paths, deduplicates entries, and returns deterministic
ordering.

M02 defines identity as the canonical absolute file path. Inventory entries retain that native
absolute path, derive a portable `/`-separated project-relative path, normalize the final extension
to lowercase, and carry only the justified `file` kind. Canonical aliases deduplicate and entries
sort ordinally by relative path. A non-descendant record is an internal invariant failure.

### FileClassifier

Selects supported source candidates. Classification may use extension and conservative source
signals. It must not falsely claim that every supported extension is a React component.

### SourceParser

Parses one source file and returns either a parser result or a typed per-file error. Parser internals
must not leak to rules.

### AnalysisModelBuilder

Converts parser output into UXAudit domain models containing only justified information needed by
rules. It preserves source locations and can be extended deliberately.

### Rule

Contains metadata and an evaluation operation over the analysis model. A rule is independent of
report format and should not depend on another rule's execution.

### RuleEvaluator

Runs enabled rules in deterministic order, isolates rule failures when safe, and returns findings plus
execution errors.

### Reporter

Transforms one `AuditResult` into a representation. It never discovers, parses, or reevaluates rules.

## Persistence

The initial version has no database. Configuration, JSON, HTML, and optional logs are local files.
Transient inventory, AST adapter output, model, and findings remain in memory during an audit.

## Error boundaries

- Invalid CLI/path/configuration: stop before analysis.
- File access or parser error: record it and continue other files when safe.
- Individual rule error: record it and continue other rules when model integrity remains valid.
- Report write failure: report the failure clearly; do not claim that output was generated.
- Internal invariant failure: stop with an unrecoverable error.

## Security boundaries

Analyzed projects are untrusted input. Never execute their code, import their modules, interpolate
their text into HTML without escaping, or traverse outside the approved root.

The user may explicitly select any root, including one reached through `..` or a symlink. UXAudit
uses that root's canonical `realpath` as the approved boundary. Starting in M02, every traversed
descendant must be checked against this canonical root and real operation failures must be handled;
M01's access check is only a TOCTOU-susceptible preflight.

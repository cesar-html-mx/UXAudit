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

## Core contracts

### ProjectDiscovery

Input: validated project root and discovery configuration.  
Output: discovered file records and recoverable discovery errors.

### FileInventory

Normalizes canonical and project-relative paths, deduplicates entries, and returns deterministic
ordering.

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

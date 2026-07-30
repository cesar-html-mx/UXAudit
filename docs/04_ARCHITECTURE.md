[Español](es/04_ARCHITECTURE.md) | **English**

# Architecture

## System overview

UXAudit is a layered local CLI. Filesystem and parser adapters turn an authorized project into a
normalized domain model. Rules operate only on that model. Reporters operate only on one normalized
audit result.

```text
project path
  -> path validation
  -> discovery and inventory
  -> source classification and bounded reading
  -> parsing and normalized analysis model
  -> rule loading and isolated evaluation
  -> normalized audit result
  -> terminal / JSON / HTML reporters
```

This direction prevents rules from depending on Babel syntax nodes and prevents reporters from
rerunning analysis.

## Module boundaries

| Area                  | Location             | Responsibility                                                                         |
| --------------------- | -------------------- | -------------------------------------------------------------------------------------- |
| Executable and CLI    | `src/cli/`           | Commander commands, safe output, option sources, and exit-code mapping.                |
| Application           | `src/application/`   | Orchestrate scan, analysis, audit, timing, and report persistence.                     |
| Project processing    | `src/project/`       | Validate roots, discover entries, build inventory, and classify source candidates.     |
| Parsing               | `src/parsing/`       | Bounded source reads, Babel adapter, extraction, and per-file failure isolation.       |
| Analysis domain       | `src/domain/models/` | Parser-independent files, components, JSX nodes, values, relationships, and locations. |
| Audit domain          | `src/domain/audit/`  | Normalized processing errors, counters, timing, findings, and result invariants.       |
| Rule domain           | `src/domain/rules/`  | Rule metadata, evaluation contracts, categories, severity, confidence, and status.     |
| Rules                 | `src/rules/`         | Registry, selection, isolated evaluator, and category-organized checks.                |
| Configuration         | `src/configuration/` | Inert JSON reading, strict validation, defaults, and explicit CLI override merging.    |
| Reporting             | `src/reporting/`     | Pure terminal, JSON, and HTML rendering plus exclusive safe file writes.               |
| Shared safety helpers | `src/shared/`        | Context-neutral normalization used across public output boundaries.                    |

Dependencies point inward toward explicit contracts. Domain modules do not import CLI or reporter
adapters.

## Processing flow

The complete application facade validates the project before configuration lookup. Configuration is
loaded before traversal so selected rules and report formats are known for the audit. Source analysis
then scans, classifies, reads, parses, and builds one model. Rule loading and evaluation happen once.
The result is frozen before any report file is persisted.

Audit timing covers validation through normalized result construction. It intentionally excludes
subsequent JSON and HTML persistence. The returned application value separates the audit result from
the list of files whose writes were confirmed.

## Key contracts

### Discovery and inventory

The canonical project root is the authorization boundary. Discovery uses deterministic ordinal
ordering, skips links by default, prevents cycles when internal link-following is enabled, and records
recoverable descendant failures. Inventory identity is based on canonical paths while public ordering
uses portable project-relative paths.

An inventory entry is only a candidate. Later source reads must revalidate the root, pathname,
regular-file identity, descriptor snapshot, size, and final authorization.

### Parsing and analysis model

The parser boundary accepts bounded source text plus an explicit source kind and returns either a
normalized success or a typed safe failure. Babel syntax trees and source text remain internal.

`AnalysisModel` is a flat, serializable representation of files, recognized component ownership, JSX
nodes, effective attributes, retained static values, and half-open source locations. Lines are
one-based; stored columns and UTF-16 offsets are zero-based. IDs and arrays use deterministic
ordering, and the completed model is recursively immutable.

Component recognition is syntactic and conservative. It recognizes supported function, arrow, and
class patterns but does not resolve imports, runtime aliases, higher-order components, routing, or
rendered composition.

### Rules and findings

A `Rule` combines immutable metadata with an evaluation function that receives the normalized model.
It cannot read source files or consume Babel nodes through the public contract.

The registry validates unique rule IDs and immutable definitions. Rule loading applies category and
ID filters in canonical order. The evaluator runs each enabled rule once, validates its observations,
normalizes them into self-contained findings, and records a safe processing error when one rule
fails. Other rules continue when isolation is safe.

A normalized finding carries rule identity, category, severity, confidence, explanation,
recommendation, limitations, message, reference, and a defensive location copy when available.

### Audit result and reporters

`AuditResult` schema `1.0.0` is the single immutable value consumed by every reporter. It contains:

- product and schema versions;
- canonical project root and timing;
- effective configuration and configured report paths;
- file, rule, finding, severity, category, and processing-error summaries;
- normalized findings and recoverable processing errors.

The terminal reporter may filter visible detail but not underlying totals. The JSON reporter preserves
the complete value. The HTML reporter presents the complete value with fixed grouping and safe
escaping. Reporters are pure renderers; filesystem persistence is a separate adapter.

### Configuration

`AuditConfiguration` is a complete validated value. The loader reads optional
`uxaudit.config.json` or an explicit file as inert UTF-8 JSON, validates a closed schema, and merges
only explicitly supplied CLI values over file values and defaults.

`null` category or rule filters mean no filter. An empty array is an intentional zero-selection.
Output directories are portable project-relative paths; reporter filenames are fixed by format.

## Error model

Public errors are stable and typed at the boundary that can make a recovery decision:

- invalid commands, paths, or configuration map to input failure;
- inaccessible descendants, malformed individual sources, and isolated rule failures may be
  recorded and allow safe siblings to continue;
- broken stage invariants, root authorization failures, and report persistence failures stop the
  audit;
- native filesystem and parser causes are not exposed directly.

The CLI sanitizes dynamic values before terminal output. A recoverable error is never silently
discarded: it contributes to normalized counters and is available in complete reports.

## Determinism

Files, model entities, selected rules, findings, errors, and report groups have explicit stable
ordering. Duplicate values are rejected or deduplicated at defined boundaries. A fixed source tree,
configuration, UXAudit version, platform filesystem semantics, and injected clock produce the same
stable result projection. Project root, timestamps, and duration are expected volatile fields.

## Filesystem and output authorization

Source readers and report writers use canonical roots, descriptor-based checks, bounded chunks, and
post-operation reauthorization. The report writer creates missing directories with restrictive
permissions, refuses links and existing targets, and never announces a file before synchronization,
close, and final authorization succeed.

An automatic rollback is deliberately avoided after an ambiguous partial write because a pathname
identity race could cause deletion of a file no longer owned by the operation.

## Extension rules

- Add a source syntax only through the parser boundary and normalized model.
- Add a rule through the validated registry; do not couple it to CLI or reporter modules.
- Add a report format as a pure `AuditResult` renderer plus an authorized persistence path.
- Preserve one-way dependencies and deterministic ordering.
- Treat any change to configuration, finding, result, exit-code, or report schemas as a public
  contract change requiring tests and bilingual documentation.

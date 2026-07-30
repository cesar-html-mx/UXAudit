# Product Specification

## Command

The primary interface is:

```bash
ux-audit scan <project-path> [options]
```

### Implemented through M03

- `--help` and command help.
- `--version`.
- `scan <project-path>` with one required path argument.
- Canonical project-root validation for existence, directory type, and read/search access.
- Safe recursive discovery with exact default exclusions and secure symbolic-link skipping.
- Deterministic canonical inventory and conservative `.js`/`.jsx`/`.ts`/`.tsx` classification.
- Bounded source reads, Babel parsing, AST-free JSX/component extraction, and deterministic normalized
  model construction.
- Recoverable read, parse, and extraction errors isolated by source file.
- Stable path, discovery-summary, and parsing-summary messages without rule, finding, or audit
  claims.

### Implemented in the active M04 domain layer

- Immutable rule metadata, normalized self-contained findings, stable rule-execution errors, and
  report-independent evaluation counters.
- Explicit validated registry plus fail-closed category/rule-ID filtering.
- Exact-once deterministic evaluation with per-rule isolation, transactional output validation,
  canonical source-location provenance, and runtime model immutability.
- Eight stable rules within documented static scopes: three accessibility checks, image
  lazy-loading/dimension advisories, component-local multiple-H1 review, exact ambiguous-link text,
  and literal inline small-text review.

The CLI remains intentionally unchanged during M04: `scan` still stops after model construction and
does not yet claim an audit result. Application integration, configuration, finding policy, and
terminal/JSON/HTML reporting remain M05/M06 responsibilities.

### Implemented in the active M05 contract slice

- Configuration schema version `1` with explicit category/rule filters, report formats, output
  directory, minimum display severity, color, and verbosity.
- Immutable defaults: stable catalog (`null` filters), terminal output, `info` threshold, color,
  non-verbose detail, and the portable relative `uxaudit-reports` directory.
- Fixed local report names `audit-report.json` and `audit-report.html`.
- `AuditResult` schema `1.0.0` with configuration/tool/timing metadata, discovered/selected/parsed/
  failed counters, complete rule counters/findings, normalized discovery/source/rule errors,
  zero-filled category/severity/stage summaries, and nullable project-relative report paths.
- One pure reporter contract that consumes exactly one completed result.

The boundary defensively copies, validates, canonically orders, and freezes result data. It does not
yet load a configuration file, render a report, write a file, or change the scan-only CLI behavior.

### Planned options

- `--config <path>`: configuration file; default search is `uxaudit.config.json` at project root.
- `--format <terminal|json|html|all>`: selected reporters.
- `--output <directory>`: report output directory.
- `--category <ux|accessibility|seo|performance>`: category filter; repeatable when appropriate.
- `--rule <rule-id>`: explicit rule filter.
- `--severity <info|low|medium|high|critical>`: minimum displayed severity where supported.
- `--no-color`: terminal output without ANSI color.
- `--verbose`: processing detail and recoverable errors.

These options are not implemented through the current M04 task. Final option names may be refined in M05, but
documented behavior and compatibility must be preserved after release.

## Current scan result

The completed `scanProject` contract continues to return the canonical project root, full discovery
result, normalized inventory, classified source candidates, and discovery counts. M03 preserves that
public behavior and adds a separate `analyzeProject` facade with:

- one normalized `AnalysisModel`;
- one ordered list of recoverable per-file parser errors;
- parsed-file, failed-file, component, and JSX-node counts.

The production CLI uses the additive facade and renders:

```text
Project path validated: <canonical-project-path>
Discovery summary: discovered=<n> inventory=<n> candidates=<n> exclusions=<n> issues=<n>
Parsing summary: parsed=<n> failed=<n> components=<n> jsx=<n>
```

The default traversal skips symbolic links. An internal `follow-within-root` policy exists for
controlled callers but is not yet exposed as a CLI option. Descendant operation failures can be
retained as recoverable issues; a root or pipeline invariant failure stops processing with a stable
message.

Classified candidates are processed sequentially in ordinal project-relative path order. The reader
reauthorizes the canonical project root and candidate before and after opening and reading a file
handle. It accepts only regular in-root files up to 1 MiB, requests at most 64 KiB per read, rejects
invalid UTF-8, and preserves an initial UTF-8 BOM. Read, syntax, and expected extraction failures are
retained separately from the model so later siblings can continue. Non-portable internal candidate
declarations, root authorization, candidate-batch invariants, unexpected extraction invariants, and
model invariants remain fatal and detail-free.

The Babel adapter owns the transient AST and composes strict text decoding, source-kind-specific
parsing, and AST-free extraction. No target module, package script, or project configuration is
imported or executed. The normalized model retains files, syntactically justified components, JSX
elements/fragments, attributes, values, relationships, and half-open UTF-16 locations. It does not
claim runtime React semantics.

## Successful execution

A future successful audit returns an `AuditResult` containing:

- project root;
- start/end or duration metadata;
- files discovered, selected, parsed, and failed;
- enabled and executed rule counts;
- normalized findings;
- recoverable execution errors;
- summary by category and severity;
- generated report paths.

## Exit codes

Implemented M03 policy:

- `0`: help/version completed or discovery, source parsing, and model construction completed safely,
  including when recoverable per-file errors were retained.
- `1`: reserved for a future completed audit that meets the configured finding-failure policy.
- `2`: command, argument, project-path, or access input error.
- `3`: fatal validation, discovery, inventory, classification, root authorization, source-batch,
  model, or unexpected application failure.

M05/M06 must refine finding-policy behavior without changing these established input/internal
boundaries incompatibly.

## Determinism

Given the same project content, configuration, and UXAudit version, the ordering and content of
results must be stable. Absolute timestamps and durations may vary and must not affect snapshot
comparisons.

## Finding

Each finding contains at least:

- rule ID and title;
- category;
- severity;
- message and explanation;
- recommendation;
- limitations and confidence;
- a complete project-relative half-open source location when available;
- optional evidence snippet or metadata;
- nullable structured standard/reference.

The M04 domain contract retains one-based lines and zero-based UTF-16 columns/offsets. M05 reporters
own any conversion to display coordinates.

## Configuration

Configuration is local JSON. Unknown keys, invalid values, and conflicting options must produce a
clear stable error. `uxaudit.config.json` at the canonical project root is optional; an explicitly
selected path must exist. Files are regular, no larger than 64 KiB, strict UTF-8 JSON and never
imported or executed. The version-1 file accepts only `schemaVersion`, `categories`, `ruleIds`,
`formats`, `outputDirectory`, `minimumSeverity`, `color`, and `verbose`; duplicate top-level keys
are rejected rather than resolved with last-value-wins behavior.

Defaults are terminal-only output, `info` minimum display severity, color enabled, non-verbose
detail, `uxaudit-reports`, and `null` category/rule filters. A file may override any default;
validated CLI values override the file. `null` category/rule filters select the stable catalog,
whereas explicit empty arrays select no rules. Selection arrays are deduplicated and normalized to
stable order. Output directories must be portable relative paths without dot segments, backslashes,
control/bidirectional characters, or Windows-reserved components. M05-T02 exposes this loader;
full Commander integration remains M06.

## Reports

- Terminal: concise immediate summary, complete category/severity/error-stage buckets, canonically
  ordered readable findings at or above the inclusive display threshold, one-based display
  columns, optional normalized error detail, and explicit color/no-color modes. Summary totals
  always describe the complete result even when finding detail is filtered.
- JSON: complete stable machine-readable result.
- HTML: standalone, escaped, readable report requiring no external service.

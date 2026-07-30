[Español](es/02_PRODUCT_SPEC.md) | **English**

# Product Specification

## Command

The primary interface is:

```bash
ux-audit scan <project-path> [options]
```

### Implemented discovery and analysis foundation

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

### Implemented rule domain

- Immutable rule metadata, normalized self-contained findings, stable rule-execution errors, and
  report-independent evaluation counters.
- Explicit validated registry plus fail-closed category/rule-ID filtering.
- Exact-once deterministic evaluation with per-rule isolation, transactional output validation,
  canonical source-location provenance, and runtime model immutability.
- Eight stable rules within documented static scopes: three accessibility checks, image
  lazy-loading/dimension advisories, component-local multiple-H1 review, exact ambiguous-link text,
  and literal inline small-text review.

### Implemented configuration and reporting contracts

- Configuration schema version `1` with explicit category/rule filters, report formats, output
  directory, minimum display severity, color, and verbosity.
- Immutable defaults: stable catalog (`null` filters), terminal output, `info` threshold, color,
  non-verbose detail, and the portable relative `uxaudit-reports` directory.
- Fixed local report names `audit-report.json` and `audit-report.html`.
- `AuditResult` schema `1.0.0` with configuration/tool/timing metadata, discovered/selected/parsed/
  failed counters, complete rule counters/findings, normalized discovery/source/rule errors,
  zero-filled category/severity/stage summaries, and nullable project-relative report paths.
- One pure reporter contract that consumes exactly one completed result.
- A lossless deterministic JSON reporter that preserves the complete result and stored coordinates
  as canonical two-space JSON with one final LF.
- One shared JSON/HTML file writer that accepts only fixed configured relative targets, creates them
  exclusively inside the authorized canonical root, and returns a path only after successful
  write, sync, close, and final authorization.

The boundary defensively copies, validates, canonically orders, and freezes result data.

### Implemented M06 CLI integration

The production `scan` command composes canonical root validation, configuration loading, the
existing analysis facade, rule loading/evaluation, one immutable `AuditResult`, terminal rendering,
and selected JSON/HTML persistence. Configuration is loaded after the root is authorized but before
source traversal/parsing. The analysis facade runs once; rules consume that one normalized model and
reporters consume that one completed result.

Configuration `null` filters become omitted rule-engine filters, while `[]` remains an intentional
zero-rule selection. Only values whose Commander source is the command line form the override layer,
so absent option defaults do not replace file settings.

Implemented options:

- `--config <path>`: configuration file; default search is `uxaudit.config.json` at project root.
- `--format <terminal|json|html|all>`: selected reporters; repeatable and deduplicated. `all` is a
  CLI convenience and is not a configuration-file value.
- `--output <directory>`: report output directory.
- `--category <ux|accessibility|seo|performance>`: repeatable category filter.
- `--rule <rule-id>`: repeatable explicit rule filter.
- `--severity <info|low|medium|high|critical>`: minimum displayed severity where supported.
- `--no-color`: terminal output without ANSI color.
- `--verbose`: processing detail and recoverable errors.

## Integrated scan result

The completed `scanProject` contract continues to return the canonical project root, full discovery
result, normalized inventory, classified source candidates, and discovery counts. The separate
`analyzeProject` facade adds:

- one normalized `AnalysisModel`;
- one ordered list of recoverable per-file parser errors;
- parsed-file, failed-file, component, and JSX-node counts.

The production CLI preserves these progress lines before the selected terminal report and confirmed
file-report claims:

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

The terminal report is already sanitized per dynamic value and may add fixed trusted ANSI badges.
The CLI writes it directly rather than applying the earlier whole-output sanitizer a second time.
Progress, Commander diagnostics, typed errors, and generated-path claims remain sanitized.

## Successful execution

A successful audit returns an `AuditResult` containing:

- project root;
- start/end or duration metadata;
- files discovered, selected, parsed, and failed;
- enabled and executed rule counts;
- normalized findings;
- recoverable execution errors;
- summary by category and severity;
- configured JSON/HTML target paths.

Those target paths describe selected output, not successful persistence. Only returned
`WrittenReport` records are announced by the CLI as generated.

## Exit codes

Implemented M06 policy:

- `0`: help/version or a completed audit, including when findings or recoverable
  discovery/source/rule errors were retained.
- `1`: reserved for a future configured finding-failure policy. The current configuration has no
  such field, and `minimumSeverity` controls terminal presentation only.
- `2`: command, argument, project-path/access, or configuration input error.
- `3`: fatal validation, discovery, inventory, classification, root authorization, source-batch,
  model, rule/result orchestration, report-write, or unexpected application failure.

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
control/bidirectional characters, or Windows-reserved components. An explicitly selected
configuration is separate user authority and may be outside the project root.

## Reports

- Terminal: concise immediate summary, complete category/severity/error-stage buckets, canonically
  ordered readable findings at or above the inclusive display threshold, one-based display
  columns, optional normalized error detail, and explicit color/no-color modes. Summary totals
  always describe the complete result even when finding detail is filtered.
- JSON: the complete stable machine-readable result, including timing metadata and stored zero-based
  UTF-16 columns, serialized with two-space indentation and one final LF.
- HTML: a complete standalone escaped report requiring no external service. It shows all findings
  and normalized errors regardless of terminal severity/verbosity settings, groups them in fixed
  severity/stage order, displays one-based columns plus UTF-16 offsets and end-exclusive ranges, and
  keeps unsafe references inert.

JSON and HTML targets use only the configured portable output directory and fixed filenames. The
shared writer refuses existing targets and observed links, escapes, or identity changes, and reports
stable failures without claiming a generated path. A failure after exclusive creation can leave a
partial target for manual review/removal; automatically unlinking after a pathname race would be
unsafe.

Audit timing ends when the immutable `AuditResult` is built and excludes subsequent persistence.
When multiple file formats are selected, JSON is written before HTML. A later failure can therefore
leave a completed sibling or partial target; the CLI returns `3`, announces no completed report set,
and performs no unsafe rollback.

The HTML document contains constant inline CSS, no script or external asset, and an early
no-script/no-object/no-base/no-form CSP. Every dynamic value is neutralized for hostile controls,
directional formatting, BOM, and malformed UTF-16 before HTML escaping. Only a separately reparsed,
control-free, credential-free HTTP(S) reference becomes an anchor.

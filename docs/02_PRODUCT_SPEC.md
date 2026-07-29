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
- Stable `accessibility/img-alt`, `accessibility/input-label`, and
  `accessibility/button-name` rules within their documented static scopes.

The CLI remains intentionally unchanged during M04: `scan` still stops after model construction and
does not yet claim an audit result. Application integration, configuration, finding policy, and
terminal/JSON/HTML reporting remain M05/M06 responsibilities.

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
clear error. Defaults must be documented and versioned.

## Reports

- Terminal: concise immediate summary and readable findings.
- JSON: complete stable machine-readable result.
- HTML: standalone, escaped, readable report requiring no external service.

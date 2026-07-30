# M05 ExecPlan — Configuration and reporting

## Purpose and observable outcome

A user can configure enabled rules/categories and output behavior. UXAudit presents one normalized
audit result through terminal, deterministic JSON, and escaped standalone HTML reports.

## Prerequisites

M04 is complete. Read product CLI behavior, persistence, reporter architecture, security HTML
controls, and M05 acceptance criteria.

## Scope

- configuration defaults, loading, validation, and CLI precedence;
- complete `AuditResult`;
- terminal reporter;
- JSON reporter and versioned schema;
- standalone HTML reporter;
- safe output paths and write errors;
- cross-reporter consistency.

## Out of scope

- hosted dashboards;
- external assets required at report-view time;
- database storage;
- rerunning rules separately per reporter.

## Requirements and traceability

RF-13 through RF-15, RNF-04 through RNF-06, RNF-09, RNF-10.

## Architecture and contracts

Reporters receive exactly one `AuditResult`. Configuration is parsed at a boundary and passed as typed
data. Project-controlled strings are escaped in HTML.

## Milestone tasks

### M05-T01 — Define configuration and result

Define defaults, overrides, validation errors, audit counters, findings, processing errors, summary,
and version metadata.

Objective: establish report-independent, immutable configuration and `AuditResult` contracts before
adding filesystem or presentation behavior. The result must defensively retain the complete M04
finding/error data, M02/M03 file counters, rule counters, category/severity totals, tool/schema
versions, timing metadata, and configured report paths. The initial permissive planning schema must
be replaced by the exact versioned result shape.

Planned verification: focused contract/schema tests, strict typecheck, lint, formatting, and a
reporting-to-domain dependency review.

Status: completed. Configuration schema/default/error/override contracts, the exact `AuditResult`
schema and invariant builder, normalized processing-error union, pure reporter interface, and
shared prepared-result fixture are implemented. Review found and corrected a non-local schema
reference plus a missing failed-file/parser-error invariant. The final Node.js 24 task gate passed
372 tests across 41 files, build/type/lint/format, exact local schema validation, and 95.88%
statement / 90.76% branch / 99.19% function / 95.84% line coverage.

### M05-T02 — Implement configuration

Load local JSON, validate unknown/invalid fields, merge CLI precedence, and document defaults.

Objective: read only bounded UTF-8 JSON, use `uxaudit.config.json` at the canonical project root by
default, distinguish an absent default file from an explicitly missing file, reject unknown keys,
invalid values, duplicate/conflicting selections, unsafe output directories, and malformed JSON
through stable errors, then apply validated CLI overrides over documented immutable defaults.
Configuration loading must not import or execute target modules.

Planned verification: a configuration/default/file/override matrix covering absence, valid partial
configuration, precedence, explicit empty filters, hostile objects/JSON, unsafe paths, read/size
failures, and deterministic defensive output.

Status: completed. The default canonical-root file and an explicitly selected regular file are read
through a bounded descriptor, validated as strict UTF-8 JSON, and normalized without importing
project code. Closed schema-versioned values and plain CLI data merge in
`defaults < file < CLI` order, with canonical filter/format order, stable errors, portable output
paths, copied/frozen results, and explicit absent/null/empty semantics. The final Node.js 24 task
gate passed 435 tests across 43 files plus build/type/lint/format, with 95.77% statement / 91.08%
branch / 99.29% function / 95.72% line coverage.

### M05-T03 — Implement terminal reporter

Provide concise summary and readable findings with no-color support and stable order.

Objective: render one supplied `AuditResult` without discovering, parsing, or evaluating anything.
The reporter must preserve canonical finding order, group priority visibly, convert stored
zero-based columns only at display time, sanitize every project-controlled terminal value, support
color and no-color modes, apply the configured display-severity threshold, and optionally expose
recoverable processing detail.

Planned verification: exact color/no-color output, hostile-control rendering, empty/error/finding
cases, threshold behavior, source display coordinates, deterministic reruns, and input immutability.

Status: completed. A pure frozen terminal reporter presents complete file/rule/category/severity/
error-stage summaries, filters only finding detail through an inclusive configured threshold,
preserves canonical finding/error order, converts start columns only for display, and exposes
normalized processing detail only in verbose mode. Every untrusted value is sanitized through the
shared terminal boundary before trusted badge-only ANSI is added. The final Node.js 24 task gate
passed 449 tests across 44 files plus build/type/lint/format, with 95.94% statement / 91.42% branch /
99.31% function / 95.90% line coverage.

### M05-T04 — Implement JSON reporter

Serialize complete stable data, document schema/version, and test repeated output.

Objective: serialize the complete supplied result with canonical two-space/LF JSON and no lossy
projection. Volatile timing metadata remains explicit data rather than being silently removed.
Writing uses a validated in-root report target, refuses symlink/path escape and unintended
overwrite, reports stable write errors, and never claims a failed output.

Planned verification: exact schema-shaped data, two byte-identical serializations, hostile-string
round trips, safe-path and existing-target rejection, controlled write success/failure, and input
immutability.

Status: completed. The frozen JSON reporter emits the supplied result through canonical two-space
`JSON.stringify` plus one LF, preserving schema, timing, zero-based columns, hostile text, and every
empty bucket without projection or mutation. The shared JSON/HTML writer accepts only the configured
portable directory plus its fixed report filename, authorizes the canonical root and each directory
segment, creates with `O_EXCL` and POSIX `O_NOFOLLOW`, writes bounded positional chunks, syncs,
closes, and performs final path/handle identity checks before returning a frozen relative path.
Stable detail-free errors cover invalid input, unsafe paths, existing targets, and write failures.
The final Node.js 24 task gate passed 490 tests across 46 files plus build/type/lint/format, with
95.66% statement / 91.19% branch / 99.36% function / 95.62% line coverage.

### M05-T05 — Implement HTML reporter

Create one standalone readable file, escape hostile strings, show summary and grouped findings, and
test write failures.

Objective: render the same complete result as one UTF-8 standalone document with inline styling,
semantic summary tables, grouped findings/errors, source locations, recommendations, limitations,
and references. Every untrusted text/attribute value must be escaped, unsafe reference URLs must
remain inert, output must be deterministic, and the JSON writer's path/write guarantees must be
shared rather than reimplemented inconsistently.

Planned verification: cross-reporter identity assertions, deterministic HTML, no external assets,
hostile filename/message/reference payloads, XSS non-execution shape, empty/error/finding cases,
safe write and write-failure behavior, plus the complete M05 scenario/evidence gate.

## Validation and acceptance

Feed the same prepared `AuditResult` to all reporters and verify identity of essential data. Execute
hostile-string tests and deterministic JSON/HTML tests.

## Evidence to retain

Configuration matrix, terminal capture, JSON and HTML samples, consistency comparison, XSS test,
write-failure test, tests and coverage.

## Progress

- [x] Milestone started.
- [x] Repository inspected and plan reconciled with reality.
- [ ] Tasks completed.
- [ ] Quality gate passed.
- [ ] Evidence collected.
- [ ] Documentation and traceability updated.
- [ ] Milestone closed and state advanced.

## Discoveries

Record implementation facts, library behavior, and assumptions discovered during work.

- The verified `main` tree is clean at merge commit `1bc3e07`, contains the completed M04
  rule/catalog layer, and contains no configuration, reporting, or `AuditResult` implementation.
  `state.currentBranch` still names the closed M04 branch, while milestone metadata correctly
  requires `milestone/m05-configuration-reporting`; the M05 branch must be created from this tested
  merge.
- The current 344-test product gate passes, but the invoking shell resolves Node.js `22.14.0` and
  npm `11.2.0`. These are inspection-only results; task completion and retained evidence must use
  the repository-pinned Node.js `24.18.0` and npm `11.16.0` contract.
- M04 already supplies self-contained, deterministic findings, recoverable rule errors, and exact
  evaluation counters. M05 can compose and defensively copy those records without changing or
  rerunning the completed engine.
- M02/M03 application results already expose discovered, selected, parsed, and failed-file facts,
  but no normalized processing-error union exists. M05 needs one reporter-facing error contract
  that retains only stable portable parser/rule details.
- `.github/harness/schemas/audit-result.schema.json` is an intentionally permissive planning
  placeholder. It allows unspecified summary/error content and extra properties, so T01 must make
  it exact and versioned before JSON output can claim conformance.
- `src/cli/run-cli.ts` intentionally stops after analysis-model construction. M06 owns the final
  path-to-rules-to-reporters orchestration; M05 will expose independently testable configuration
  and reporter boundaries without prematurely changing CLI audit claims.
- No new production dependency is required. Node filesystem/path APIs, standard JSON encoding, and
  explicit HTML/terminal escaping cover the documented M05 behavior.
- The existing terminal sanitizer is a reusable output boundary for reporter text, while HTML needs
  context-appropriate escaping and local-file writing needs canonical containment, symlink, and
  overwrite controls separate from project discovery.
- Independent T01 review found that an absolute `$id` changed the base of the local
  `finding.schema.json` reference and that failed-file counters could diverge from parser errors.
  Removing the remote base, resolving/validating both local schemas in tests, and requiring exact
  `files.failed === parserErrors.length` closed both gaps without changing M02-M04 contracts.
- Product requirements define the normalized file counters as discovered, selected, parsed, and
  failed. Inventory/exclusion counts remain stage-level discovery data; recoverable discovery
  issues are preserved individually in `AuditResult.errors` rather than duplicated as another file
  counter.
- Configuration loading can reuse the bounded descriptor-authorization pattern established for
  source reads, but its authorization semantics differ deliberately: the conventional file must be
  an exact canonical child of the already canonical project root, while an explicit path is a
  separate user-authorized regular file and may be outside that root.
- JSON parsing alone does not make programmatic CLI overrides trustworthy. T02 therefore validates
  both layers as closed own-data records, rejects accessors, proxies, sparse/exotic arrays,
  duplicates, unknown rules, nonportable output paths, and oversized collections, then copies and
  freezes the canonical merged value.
- Independent T02 review found that the missing-default branch did not reauthorize the root,
  transparent proxies could reach reflection traps, hostile native-error shapes could escape
  normalization, and the portable path policy omitted Windows superscript device names and UTF-8
  byte/well-formedness limits. The fixes add fail-closed regression matrices plus explicit
  duplicate top-level JSON-key rejection; final independent re-review found no remaining defect.
- `AuditResult.findings` is already frozen and ordered by rule/path/location/message rather than
  severity. T03 will preserve that canonical order with an inclusive filter and make priority
  visible through fixed badges plus critical-to-info summary buckets; it will not regroup or sort
  the result.
- The existing terminal sanitizer is CLI-owned even though reporting will become a CLI dependency
  in M06. T03 should move the implementation to a neutral shared module, preserve the CLI import as
  a compatibility re-export, sanitize every untrusted value before adding trusted ANSI, and keep
  structural LF separators outside sanitized values.
- Independent T03 review exercised the shared sanitizer, ANSI/no-color equivalence, threshold/order,
  summary/detail semantics, coordinates, empty/null/error cases, determinism, and immutability and
  found no remaining defect.
- T04 can keep serialization and persistence independent: JSON is exactly
  `JSON.stringify(result, null, 2)` plus LF, while one format-aware writer accepts only the fixed
  JSON/HTML report name under a validated configured directory and returns a path only after
  successful exclusive creation, write, sync, close, and reauthorization.
- Node's portable API has no `openat`/`openat2` relative-to-directory-handle primitive. The shared
  writer will create directories segment by segment, reject static links/escapes and observable
  identity changes, use `O_EXCL`/POSIX `O_NOFOLLOW`, and document the residual ancestor-swap and
  network-filesystem limitations rather than claiming atomic pathname authorization.
- T04 tests exercise exact JSON round trips and schema shape plus real and injected filesystem
  success, partial writes, existing targets, symlinks/escapes, root/ancestor/target replacement,
  invalid byte counts, sync/close failures, proxy/accessor inputs, and hostile native errors. A
  failed operation after exclusive creation can deliberately leave a partial target: automatically
  unlinking a pathname after an identity race could delete an attacker replacement.

## Decision log

Record decisions made within the authority allowed by `AGENTS.md`.

- Contract, configuration, terminal, JSON/output, HTML, and evidence decisions will be recorded in
  `.github/harness/DECISIONS.md` as the corresponding tasks are completed.
- The stored source contract remains one-based lines with zero-based UTF-16 columns/offsets. Only
  human-facing terminal/HTML location labels convert columns to one-based display values; JSON
  preserves the domain coordinates exactly.
- Reporter rendering functions will remain pure and consume exactly one `AuditResult`. Optional
  file writers are boundary adapters over the rendered representation and never discover, parse, or
  reevaluate rules.
- D-029 fixes the schema/version vocabulary, null-versus-empty filter semantics, immutable defaults,
  complete frozen result shape, derived summaries, normalized error union, controlled report names,
  pre-resolved relative report paths, pure reporter boundary, and M06 integration boundary.
- D-030 fixes JSON-only bounded loading, default-versus-explicit path authorization, closed
  schema-versioned validation, stable errors, canonical ordering, and
  `defaults < file < CLI` precedence for the configuration boundary.
- D-031 fixes the terminal structure, inclusive display threshold, canonical ordering, one-based
  display columns, optional error detail, shared per-value sanitization, and trusted badge-only ANSI
  behavior without consulting process/TTY state.
- D-032 fixes lossless canonical JSON plus the shared exclusive, reauthorized file-writer boundary,
  stable write errors, success-path claims, and explicit portable-filesystem residual limits.

## Risks and recovery

Maintain task-specific risks, rollback steps, and any remaining debt.

- Configuration JSON and every finding field are untrusted. Boundary validation, bounded reads,
  terminal sanitization, standard JSON encoding, HTML escaping, safe URL handling, and hostile
  fixtures are mandatory.
- Output-path containment checked only lexically can be bypassed with symlinks or races. The shared
  writer must authorize the canonical root/directory, reject link targets, create only controlled
  directories, and use exclusive file creation so an unrelated existing file is never overwritten.
- Absolute timing values make otherwise identical full results vary. Determinism tests will use one
  prepared result; documentation and evidence will distinguish volatile metadata from canonical
  rendering/order.
- Each task remains recoverable through its conventional task commit. No production dependency,
  completed public-contract change, source modification, or history rewrite is planned.

## Outcomes and retrospective

At closure, describe what now works, what was actually verified, remaining limitations, commits, and
the next milestone.

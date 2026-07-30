# M04 ExecPlan — Rule engine and initial validation catalog

## Purpose and observable outcome

UXAudit loads enabled rules, evaluates them independently over the analysis model, and returns
deterministically ordered normalized findings for required rules in all four categories.

## Prerequisites

M03 is complete. Read `docs/08_RULE_CATALOG.md`, finding requirements, architecture contracts,
security rules, and M04 acceptance criteria.

## Scope

- rule metadata and evaluation contract;
- category and severity types;
- finding and rule-execution error contracts;
- registry, filtering, loader, evaluator;
- required stable rules;
- positive, negative, boundary, and limitation fixtures;
- rule-level traceability and evidence.

## Out of scope

- terminal/JSON/HTML formatting;
- claims beyond each rule's documented static scope;
- promoting experimental rules without measured evidence.

## Requirements and traceability

RF-09 through RF-14, RNF-02 through RNF-07, RNF-10.

## Architecture and contracts

Rules use only domain models. Rule evaluation order and findings are deterministic. A failing rule is
isolated when model integrity remains valid. A rule explains its limitations.

## Milestone tasks

### M04-T01 — Define contracts

Implement metadata, context, result, finding, category, severity, reference, confidence/limitations,
and execution errors.

Objective: establish immutable, report-independent domain contracts that preserve the M03
half-open source location, provide complete developer-facing guidance, and distinguish a rule
finding from a recoverable rule-execution error. Verify discriminants, allowed values, metadata
completeness, finding construction, and defensive normalization with focused domain tests.

Status: completed. The contracts and aligned schemas retain complete metadata, structured
references, confidence, nullable defensive source locations, stable isolated errors, and explicit
evaluation counters. Seven focused tests, strict typecheck, and lint pass.

### M04-T02 — Implement engine

Create explicit registry, configuration filters, deterministic loader, isolated evaluator, counters, and
error aggregation.

Objective: load an explicit registry through validated category/rule filters, then evaluate a
trusted analysis model exactly once per enabled rule. Rule and finding order must be canonical,
duplicate identities and malformed outputs must fail closed at their boundary, and one thrown rule
must produce a stable execution error without discarding safe sibling findings.

Status: completed. The registry validates, copies, freezes, deduplicates, and ordinally orders
rules; filters fail closed and intersect; experimental rules require exact opt-in; the evaluator
deep-freezes the model, validates complete per-rule batches, requires canonical model locations,
isolates failures, sorts normalized output, and reports all counters. Fifty-three focused tests and
the 261-test coverage gate pass.

### M04-T03 — Accessibility rules

Implement A11Y-001 through A11Y-003 with comprehensive fixtures.

Objective: implement the three required intrinsic-element checks using only exact facts represented
by the analysis model. Cover zero, one, and multiple findings plus supported, dynamic, wrapper,
association, and abstraction limitations without inferring custom components.

Status: implementation and verification complete; independent semantic re-review found no
remaining blocker. A11Y-001 through A11Y-003 are stable intrinsic-only rules with right-to-left spread
handling, conservative unknown suppression, exact locations, complete metadata, and committed TSX
integration coverage. Review-driven fixtures cover uncertain external labels, exact ID equality,
recognized-component isolation, explicit/null nested-label targets, known-null ARIA values, and the
documented multi-control limit. Twenty-five focused and 286 full tests pass; the full coverage gate
records 96.85% statements, 92.01% branches, 99.65% functions, and 96.85% lines.

### M04-T04 — SEO, performance, and UX rules

Implement required stable rules from the catalog. Keep advisory wording conservative.

Objective: implement the two required performance rules, two required SEO rules, and required UX
rule with explicit initial scopes. Advisory findings must describe reviewable risk rather than
runtime certainty, and every rule must include positive, negative, boundary, and unsupported cases.

Status: completed and independently re-reviewed without remaining blockers. Two performance, two
SEO, and one UX rule are stable category modules assembled with the accessibility rules in one
explicit canonical eight-rule registry. PERF rules reason only about effective intrinsic-image
attributes; SEO-001 groups recognized component ownership; SEO-002 matches exact normalized static
anchor text through a hostile-input-safe phrase factory; and UX-001 inspects exact literal
`style.fontSize` evidence with validated threshold/CSS-number syntax and exact-versus-partial text
confidence. Review regressions cover proved-invalid/unknown dimensions, zero-by-zero, unsafe
numbers, sparse/accessor/proxy configuration, inert text containers, invalid CSS whitespace, and
advisory limits. Fifty-four focused T04 tests and all 340 repository tests pass; final coverage is
97.14% statements, 92.79% branches, 99.70% functions, and 97.14% lines.

### M04-T05 — Validate catalog behavior

Verify zero/one/multiple findings, rule failure isolation, deterministic order, filtering, metadata,
traceability, and expected limitations.

Objective: exercise the complete eight-rule registry twice over a controlled mixed model, compare
byte-stable normalized results, retain expected/actual findings and an isolated-failure scenario,
and close documentation, traceability, security review, coverage, and evidence.

Status: completed and independently reviewed without remaining blockers. The compiled runner
retains reviewed expected/actual eight-rule results, a positive/safe/unsupported matrix,
metadata/limitations, two-run byte comparison, category/ID filter projections, and one injected
thrown-rule isolation result. Its complete expected JSON matches twice, with eight rules, eight
findings, and no target-code execution. Three integration tests make those criteria part of the
344-test product gate. The Node.js 24.18.0 collector reproduced that gate inside an allowlisted
credential-free source snapshot, published the initial 20-artifact package, and preserved it on a
second execution after matching the source digest and stable results.

## Validation and acceptance

Each stable rule must pass positive, negative, and boundary/unsupported cases. Execute the full
catalog twice on the same model and compare stable results.

## Evidence to retain

Rule-by-rule test matrix, expected/actual finding samples, deterministic comparison, isolated failure
scenario, limitations, tests, and coverage.

## Progress

- [x] Milestone started.
- [x] Repository inspected and plan reconciled with reality.
- [x] Tasks completed.
- [x] Quality gate passed.
- [x] Evidence collected.
- [x] Documentation and traceability updated.
- [ ] Milestone closed and state advanced.

## Discoveries

Record implementation facts, library behavior, and assumptions discovered during work.

- The prior milestone was merged to `main` as `2625bf6`; the repository was clean and contained no
  M04 product implementation. The M04 branch was therefore created from that verified merge rather
  than from the pre-merge commit retained in `state.json`.
- M03 already supplies canonical, deterministic `AnalysisModel` arrays with AST-free JSX nodes,
  exact/partial/dynamic value confidence, reciprocal component relationships, and half-open
  one-based-line/zero-based-column locations. M04 can consume these arrays directly and needs no
  parser import or speculative model query layer.
- The repository schemas are planning artifacts whose current finding shape flattens a one-based
  display column, while the implemented source contract uses zero-based columns. M04 will keep one
  domain `SourceLocation` without lossy coordinate conversion; reporter-facing display conversion
  remains M05 work.
- The required M04 catalog contains exactly eight stable rules: three accessibility, two
  performance, two SEO, and one UX rule. Experimental UX-002 and deferred/experimental UX-003
  remain out of scope.
- No new dependency is necessary. Registry, filtering, evaluation, normalization, and every rule
  can be implemented with the existing TypeScript domain model.
- The normalized finding must be self-contained because M05 reporters consume one result and cannot
  rely on a live rule registry. Copying metadata and the complete location also prevents later rule
  mutation from altering an already accepted result.
- Model locations form an inexpensive provenance allowlist for rule outputs. This prevents an
  invalid extension result from adding an absolute path or invented range without cloning or
  reparsing the model per rule.
- A single recursive freeze is sufficient to enforce M03's readonly graph during rule execution;
  it avoids the much larger cost of cloning or serializing the complete model once per rule.
- JSX spreads cannot be treated as ordinary missing attributes: resolving from right to left
  distinguishes an explicit value that overrides an earlier spread from an earlier value that a
  later spread may replace.
- The model can justify component-local H1 counts but not page-level counts: JSX without recognized
  component ownership and separate components must not be combined into a project-wide SEO claim.
- Exact text confidence plus deterministic NFKC/case/whitespace normalization supports a narrow
  configurable ambiguous-link rule without inferring surrounding or dynamic accessible context.
- Literal object properties retain their own canonical source locations, so UX-001 can point to the
  effective `fontSize` declaration instead of inventing a range; unknown object properties and
  non-pixel units remain outside its static scope.
- M03's isolated evidence collector/finalizer already provides the required source-copy allowlist,
  credential-free child environment, path/token sanitization, atomic initial publication,
  reproducibility comparison, and SHA-256 lifecycle. M04 can retain those controls while replacing
  parser-specific artifacts with the complete rule matrix, findings, filters, limitations, and
  failure-isolation scenario.
- The invoking shell may resolve a different installed Node.js version even when npm 11 is
  available. The evidence collector rejects that mismatch before product commands or publication;
  the official package was therefore executed explicitly with the repository-pinned Node.js
  24.18.0 and npm 11.16.0 runtimes.
- A valid JSON artifact can still violate the repository formatting gate. Final self-review caught
  that gap before closure; the runner and collector now share explicit canonical JSON formatting,
  while publication additionally reauthorizes the destination and verifies the copied source
  snapshot remains unchanged across the isolated gates.
- Enumerated input-type matching is ASCII case-insensitive but does not strip surrounding
  whitespace. Final product review caught the distinction: invalid padded values default to the
  label-required text state, while exact `hidden`, `button`, `submit`, `reset`, and `image` values
  remain excluded.

## Decision log

Record decisions made within the authority allowed by `AGENTS.md`.

- Contract, engine, per-category scope, and ordering decisions will be recorded in
  `.github/harness/DECISIONS.md` as each corresponding task is completed.
- D-024 fixes the model-only synchronous rule boundary, self-contained finding shape, preserved M03
  coordinates, independent confidence/severity/status, stable execution error, and counters.
- D-025 fixes validated explicit registration, filter intersection, exact-once transactional
  evaluation, source-location provenance, stable isolation, canonical ordering, and counters.
- D-026 fixes the stable intrinsic accessibility scopes, ordered-spread semantics, supported label
  associations/input types, conservative unknown suppression, and planning-status distinction.
- D-027 fixes conservative performance/SEO/UX scopes, advisory confidence, component-local H1
  ownership, validated rule factories, the 12px default, and the explicit eight-rule registry.
- D-028 fixes the reviewed full-catalog expected result, deterministic/filter/failure projections,
  and isolated, sanitized, reproducible evidence lifecycle.

## Risks and recovery

Maintain task-specific risks, rollback steps, and any remaining debt.

- Dynamic JSX and component abstractions can create unjustified certainty; rules must trigger only
  on documented static evidence and retain limitation cases.
- A malformed third-party rule result must not contaminate normalized findings. Boundary validation
  and stable execution errors will isolate safe rule failures, while an invalid analysis model
  remains fatal before this layer.
- Each task remains independently recoverable through its conventional task commit. No production
  dependency, public M03 contract change, automatic source modification, or history rewrite is
  planned.

## Outcomes and retrospective

M04 now provides parser-independent rule and finding contracts, an explicit validated registry,
deterministic filtering/evaluation, recoverable per-rule isolation, and eight documented stable
rules across accessibility, performance, SEO, and UX. The controlled TSX scenario exercises every
rule through the production analysis-model boundary and retains exactly one canonical finding per
rule, complete metadata/limitations, filter projections, and a throwing-rule result that preserves
all safe siblings.

Node.js 24.18.0/npm 11.16.0 verification passed formatting, strict lint, typecheck, build, all 344
tests in 38 files with zero skips/todos, six CLI smokes, the compiled catalog scenario, harness
validation, and a moderate-threshold audit with zero known vulnerabilities. Coverage measured
97.14% statements, 92.79% branches, 99.70% functions, and 97.14% lines. The isolated evidence
package was collected twice; the second execution preserved the original package after matching its
source digest and stable results.

The remaining limitations are deliberate static-analysis boundaries: dynamic JSX, custom component
abstractions, external CSS, routes, viewport priority, and complete accessible-name context are not
inferred. Hosted Windows/macOS execution and remote publication remain unclaimed without repository
credentials. M05 will define configuration and one normalized `AuditResult`, then add consistent
terminal, JSON, and escaped standalone HTML reporting without changing the completed M04 contracts.

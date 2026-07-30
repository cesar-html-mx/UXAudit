# Activity 3 — Testing Summary

## Objective, environment, and tools

The objective is to verify the complete local CLI against reviewed inputs, expected outputs, error
boundaries, security controls, detection ground truth, and documented limitations. The isolated
evidence run performs a locked clean install under the pinned Node.js/npm runtime. Exact source,
runtime, platform, kernel, CPU-count, memory, commands, and result summaries are retained in
[`environment.json`](../environment.json); raw installation and gate output remain under
[`raw/`](../raw/).

Vitest is used because it exercises TypeScript units and integration boundaries with deterministic
fixtures and produces V8 coverage plus a machine-readable zero-skip/todo result. Shell-free Node.js
runners execute the compiled CLI for behavior that unit adapters cannot establish. `npm audit`
checks the exact lockfile at the moderate threshold, and the harness scripts validate delivery
state.

## Unit and integration tests

The isolated evidence run performs a locked clean install, the complete quality gate, coverage,
machine-readable zero-skip/todo tests, compiled CLI smoke tests, five controlled-project scans,
instance-level rule accuracy, robustness/security/performance cases, an expert heuristic review,
harness validation, and a moderate-threshold dependency audit.

- Unit/integration tests: 619 passed across 56 files; zero failed, skipped, or todo.
- Coverage: statements 95.84%, branches 91.5%, functions 99.82%, lines 95.79%.
- Selected units include configuration, traversal/source authorization, Babel parsing/model
  construction, eight rules, rule isolation, result normalization, three reporters, CLI/application
  composition, quantitative validation helpers, and terminal harness lifecycle.
- Inputs include positive, negative, boundary, hostile, malformed, filtered, permission, symlink,
  overwrite, and final-state fixtures. Expected values are versioned independently and compared
  against normalized domain results rather than incidental AST structures.
- Integration tests cover configuration → scan/analyze, model → rule engine, rule engine →
  `AuditResult`, result → three reporters/writer, Commander → application facade, and
  task-completion → final harness advance.

The machine-readable totals are in [`test-summary.json`](../measurements/test-summary.json), and
coverage percentages are in
[`coverage-summary.json`](../measurements/coverage-summary.json).

## System and end-to-end tests

- System scenario: 5 projects with byte-stable normalized reruns. Findings were 0/8/3/1/0 for
  valid/invalid/mixed/hostile/large; only the mixed project retained one recoverable parser error.
- Every project ran through the built CLI with terminal, JSON, and HTML output. Target-code
  sentinels remained absent, generated report claims matched actual writes, and expected versus
  actual artifacts are retained under [`scenario/`](../scenario/).

## Validation and detection behavior

- Accuracy: 8 rules, 11 TP, 0 FP, 8 TN, 0 FN, and 8 unsupported cases outside denominators on the controlled corpus.
- The reviewed ground truth, case identities, expected/actual comparison, per-rule matrices, and CSV
  projections are retained under [`accuracy/`](../accuracy/). Precision/recall apply only to this
  small synthetic corpus and are not generalized to arbitrary projects.

## Robustness, security, and performance

- Robustness/security: 15 exact cases with no failed case, covering invalid input/configuration, malformed isolation,
  canonical/path/symlink/output boundaries, permissions where executable, deterministic hostile
  reports, CSP/escaping, non-execution sentinels, and exclusive writes.
- Performance: 5 complete built-CLI runs over 240 generated files. Durations and sampled child RSS are observations, not portable pass
  thresholds or exact lifetime peaks.
- Dependency audit: 0 known vulnerabilities, including zero moderate,
  high, or critical vulnerabilities. Hosted CodeQL was not executed locally.

Raw observations and concise machine-readable results are retained under
[`robustness/`](../robustness/) and [`raw/`](../raw/).

## Usability

- Usability: 6 protocol tasks completed by expert heuristic review; participant testing was not executed and
  SUS is not applicable.
- Five observations had no issue and one recorded a low-severity prioritization ambiguity. Script
  durations, errors, backtracking, and help use describe the expert procedure only, not people.
  Detailed JSON/CSV and status are retained under [`usability/`](../usability/).

## Defects, corrective actions, and remaining work

Thirteen M06 defects, their corrective actions, and their exact verification statuses are listed in
[`defects-and-corrections.json`](../defects/defects-and-corrections.json). Remaining unsupported,
unexecuted, or not-applicable work is explicit in
[`unexecuted-checks.json`](../unsupported/unexecuted-checks.json).

These results describe the retained synthetic corpus and local execution environment. They do not
claim runtime browser coverage, real-world accuracy, participant usability, or hosted CodeQL.

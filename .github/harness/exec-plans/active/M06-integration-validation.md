# M06 ExecPlan — End-to-end integration, validation, usability, and security evidence

## Purpose and observable outcome

UXAudit performs the complete scan from CLI input to reports. Controlled projects demonstrate the
behavior and accuracy of every stable rule. System, robustness, usability, performance, and security
evidence is assembled for the TFM testing delivery.

## Prerequisites

M01 through M05 are complete. Read all product acceptance criteria, test strategy, security plan,
academic alignment, and the complete traceability matrix.

## Repository context

The clean baseline is the merged M05 commit `bd22ef5` on `main`. The harness correctly identifies
M06/M06-T01, but `state.json` still names the merged M05 branch and task commit. The milestone branch
must be created as `milestone/m06-integration-validation` and the state synchronized before product
implementation.

The production CLI currently composes only `scanProject` and `analyzeProject`, ending after the
normalized analysis model and three established progress lines. M05 independently completed
configuration loading, the rule/result contracts, the three pure reporters, and exclusive JSON/HTML
file persistence. M06 must compose these existing boundaries without changing their completed public
contracts.

The repository shell initially resolves Node.js 22.14.0/npm 11.2.0, outside the enforced engines.
Node.js 24.18.0/npm 11.16.0 is installed through nvm and must be activated for every product gate,
commit hook, scenario, and evidence run.

## Scope

- complete CLI orchestration;
- controlled valid, invalid, mixed, hostile, and large projects;
- end-to-end and acceptance tests;
- expected versus actual rule results;
- precision and recall by rule;
- exit codes and error scenarios;
- performance baseline;
- security verification;
- developer usability protocol and SUS/heuristic evidence;
- implementation and test documentation.

## Out of scope

- falsifying user-test results when participants are unavailable;
- browser/runtime analysis;
- claims of complete WCAG/SEO/UX/Core Web Vitals validation;
- hosted deployment.

## Requirements and traceability

All RF and RNF requirements. Every requirement must map to implemented code, test/evidence, or a
truthfully documented limitation.

## Architecture and contracts

- Add one application-level audit facade that canonicalizes the selected root, loads configuration
  before traversal/parsing, invokes the existing analysis facade exactly once, loads/evaluates the
  stable rules over the normalized model, builds one `AuditResult`, and writes selected JSON/HTML
  reports through the M05 writer.
- Preserve the completed scan/parsing progress contract alongside the final audit result so the CLI
  can retain the established validation, discovery, and parsing lines.
- Map configuration `null` filters to omitted rule-engine filters and preserve explicit empty arrays
  as an intentional zero-rule selection.
- Map file counters exactly as discovered files, selected source candidates, parsed files, and
  parser failures. Configured report targets are non-null in `AuditResult` exactly when selected;
  only returned `WrittenReport` values may be announced as generated.
- Expose `--config`, `--format`, `--output`, `--category`, `--rule`, `--severity`, `--no-color`, and
  `--verbose`. Build CLI overrides only from values whose Commander source is the command line so
  defaults do not override configuration-file values.
- Render progress and diagnostics with per-value sanitization. Write the already safe terminal
  reporter output directly so its fixed ANSI badges are not neutralized by a second sanitizer.
- Keep successful completed audits, findings, and recoverable discovery/source/rule errors at exit
  code `0`; command/path/configuration input errors use `2`; fatal pipeline or report-write failures
  use `3`. Exit code `1` remains reserved because the completed M05 configuration has no
  finding-failure policy and `minimumSeverity` is presentation-only.
- Use an injected clock in application tests. Audit timing ends when the immutable result is built;
  report persistence occurs afterward and may leave an already completed sibling/partial target on
  failure, consistent with the documented no-rollback security boundary.
- Repair terminal harness validation before closure: the ready state must have one coherent active
  milestone, while the completed final state must have zero active milestones, null active IDs, and
  all milestones in the completed set. State display and generated documentation must also represent
  final completion truthfully.

## Milestone tasks

### M06-T01 — Complete end-to-end pipeline

Implement and verify the complete `ux-audit scan` flow, exit codes, progress/verbose behavior, report
paths, and recoverable errors.

Concrete work:

- add the application audit facade and focused application integration tests;
- wire every documented option and stable error boundary into Commander while preserving injected
  scan/analyze compatibility tests;
- exercise the compiled CLI with default terminal output, all formats, configuration precedence,
  empty filters, recoverable syntax errors, existing report targets, and hostile terminal values;
- update README, product specification, architecture, security boundaries, and traceability.

Focused gate: format, lint, typecheck, application/CLI/reporting tests, build, and compiled smoke.

### M06-T02 — Build controlled projects

Create valid, invalid, mixed, hostile, and large fixtures with versioned expected results.

Use committed `valid-project`, `invalid-project`, and `mixed-project` sources. Construct portable
security links/hostile names and the repeated large project at scenario runtime from versioned
parameters. Store one closed manifest that states each project's purpose, expected rules/errors, and
volatile fields. Reuse reviewed M02-M05 cases only after projecting them through the complete built
CLI.

Focused gate: fixture-contract tests plus the built M06 scenario over all five controlled projects.

### M06-T03 — Measure detection behavior

Execute each stable rule, classify TP/FP/FN/TN where meaningful, calculate precision/recall, inspect
failures, and correct justified defects without hiding limitations.

Version instance-level ground truth for positive, negative, and unsupported cases. Positive cases
become TP/FN; negative cases become TN/FP; unmatched findings become FP. Unsupported cases remain
outside denominators and are reported separately. Retain per-rule JSON and CSV with exact counts,
precision, recall, notes, expected-versus-actual finding identities, and any corrective action.

Focused gate: accuracy-calculation tests and exact scenario comparison for all eight stable rules.

### M06-T04 — System, robustness, performance, and security

Run invalid inputs, malformed files, permissions where portable, deterministic reruns, dependency
audit, symlink/path/HTML injection scenarios, and a documented performance baseline.

Measure the complete built CLI on the generated large project across repeated runs and retain
scale, environment, individual durations, min/median/max, memory observations, and conclusions
without a machine-dependent pass threshold. Execute the security checklist against the real CLI and
reuse focused injected-adapter evidence only where a portable real-filesystem operation is not
available. Record CodeQL as unexecuted unless a hosted result is actually retrieved.

Focused gate: system/robustness/security scenario, dependency audit, deterministic projections, and
performance record validation.

### M06-T05 — Usability and TFM evidence

Run defined developer tasks with real participants when available; otherwise perform and label an
expert heuristic review. Use the SUS template only with actual responses. Assemble the evidence
index and draft factual implementation/testing summaries.

No participant data is available in the repository, so execute an expert heuristic review and label
participant testing and SUS as unexecuted/N/A. Record each protocol task, completion, time, errors,
backtracking, help, observation, severity, and corrective action. Assemble the Activity 3 evidence,
defect/correction list, unsupported/unexecuted checks, implementation/testing summaries, exact
environment, raw commands, manifest, and milestone report.

Repair and test final-state harness handling before transition. Run the full gate, coverage,
zero-skip/todo test record, smoke, M06 scenario, harness, dependency audit, evidence collection twice,
self-review, finalization, and milestone advance.

## Validation and acceptance

Run the complete repository verification and all controlled projects from the built CLI. Compare
actual output to versioned expected results. Review every item in `docs/09_ACCEPTANCE_CRITERIA.md`
and `docs/14_ACADEMIC_ALIGNMENT.md`.

Required commands under Node.js 24.18.0/npm 11.16.0:

```bash
npm run verify
npm run test:coverage
npm run test:smoke
npm run test:scenario:m06
npm audit --audit-level=moderate
node .github/harness/scripts/validate-harness.mjs
npm run evidence:m06
npm run evidence:m06
```

No required Vitest test may be skipped or marked todo. JSON/HTML reruns use fresh project copies
because the report writer intentionally refuses overwrite; deterministic comparison removes only the
documented canonical root, timestamp, and duration volatility.

## Evidence to retain

All items required by `docs/14_ACADEMIC_ALIGNMENT.md`, including raw machine outputs and concise
human conclusions.

The final package under `evidence/m06-validation/` must include:

- environment/source digest and raw command records;
- quality, coverage, zero-skip/todo, smoke, scenario, harness, and dependency-audit results;
- controlled-project manifest plus expected/actual stable projections;
- terminal, JSON, and HTML samples;
- per-rule ground truth, confusion matrix, precision/recall, and unsupported cases;
- security checklist and raw scenario observations;
- repeated performance measurements and summary;
- expert heuristic review, explicit participant/SUS status, and usability observations;
- defects/corrections plus unsupported, unexecuted, or not-applicable checks;
- factual Activity 3 implementation/testing summaries;
- SHA-256 manifest finalized with the milestone report.

## Progress

- [x] Milestone started.
- [x] Repository inspected and plan reconciled with reality.
- [x] M06-T01 complete audit pipeline implemented and verified.
- [ ] Tasks completed.
- [ ] Quality gate passed.
- [ ] Evidence collected.
- [ ] Documentation and traceability updated.
- [ ] Milestone closed and state advanced.

## Discoveries

- The merged M05 tree is clean on `main`, while branch and last-commit fields retain pre-merge M05
  values that the current harness validator does not detect.
- Commander 15 supplies `color=true` as the default source for `--no-color`; copying all parsed
  options would incorrectly override a file's `color=false`.
- JSON has a pure renderer plus the shared writer but no format-specific write helper; HTML has both.
- The exclusive report writer rejects reruns into an existing target and deliberately performs no
  unsafe rollback after a partial/post-create failure.
- M02-M05 contain reusable discovery, parser, rule, hostile-report, writer, and evidence patterns,
  but none is complete M06 end-to-end or rule-accuracy evidence.
- Only M06 CSV/security/usability templates exist; fixture projects, scenario, evidence lifecycle,
  performance baseline, and heuristic observations remain to be implemented.
- The final milestone transition currently produces a semantically correct `status=complete` state
  that `validate-harness.mjs`, `show-status.mjs`, and `sync-state-doc.mjs` do not yet support.
- `gh` is unavailable and prior non-interactive HTTPS pushes lacked credentials. Publication remains
  best-effort and is not a product blocker.
- M06-T01's final Node.js 24 gate passed 548 tests across 50 files, all 11 compiled CLI scenarios,
  95.88% statement / 91.46% branch / 99.80% function / 95.84% line coverage, and harness
  validation. Independent implementation and test reviews found no blocking defect.
- Separating renderer and writer error boundaries prevents an injected renderer from masquerading
  as a stable persistence failure; only the actual writer may propagate `ReportWriteError`.

## Decision log

- Preserve completed M01-M03 progress output through an additive audit result rather than replacing
  those public lines.
- Treat `minimumSeverity` only as terminal presentation. Do not introduce an unapproved M05 contract
  change merely to emit exit code `1`.
- Treat the hostile project required by this plan and the `security-project` required by the test
  strategy as one controlled project with both names documented.
- Generate the large fixture from committed parameters instead of versioning thousands of repeated
  files.
- Use expert heuristic review because no real participant responses are available; do not populate
  SUS.

## Risks and recovery

- A JSON write can succeed before a later HTML write fails. Do not delete or claim the partial set;
  surface one stable failure and use a fresh controlled copy for recovery.
- Volatile roots/timing can create false determinism failures. Compare a documented stable projection
  while retaining the raw result.
- Dynamic JSX/custom abstractions can distort accuracy. Keep unsupported instances outside the
  confusion-matrix denominator and publish limitations.
- Permission and symlink behavior varies by OS. Execute when portable and label N/A truthfully while
  retaining injected boundary tests.
- Default Node.js 22 can invalidate evidence and hooks. Activate the pinned Node.js 24 runtime before
  every gate.
- Missing GitHub tooling/credentials may prevent push, PR, CodeQL, or hosted CI inspection. Record
  those as unavailable without blocking locally verified closure.

## Outcomes and retrospective

At closure, describe what now works, what was actually verified, remaining limitations, commits, and
the next milestone.

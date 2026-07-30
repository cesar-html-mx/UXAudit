# M06 Milestone Report

- Milestone: `M06`
- Result: **PASS**
- Branch: `milestone/m06-integration-validation`
- Task commit: `691a4ea`
- Evidence ID: `M06-VALIDATION`
- Evidence observed at: `2026-07-30T08:09:32.690Z`
- Evidence source digest:
  `sha256:92bd1c57cf85126082270c9111b03cd00fe28491d77a8c9cba7aa0b4d8ad404b`

## Delivered

UXAudit now executes the complete local static-analysis flow from `ux-audit scan <path>` through
configuration, secure discovery/read, JSX/TSX/JS/TS parsing, normalized model construction, eight
isolated stable rules, one immutable audit result, and consistent terminal, JSON, and standalone
HTML reports.

M06 added the integrated CLI, five controlled projects, instance-level rule ground truth, exact
accuracy metrics, robustness/security/performance execution, an expert heuristic review, Activity 3
summaries, a strict terminal harness lifecycle, and a bounded reproducible evidence collector.

## Verification

- Product gate: 619/619 tests passed across 56 files; zero failed, skipped, or todo.
- Coverage: 95.84% statements, 91.50% branches, 99.82% functions, and 95.79% lines.
- Compiled smoke: all 11 scenarios passed.
- Controlled projects: findings 0/8/3/1/0 for valid/invalid/mixed/hostile/large; only mixed retained
  one recoverable parser error; normalized reruns were deterministic.
- Accuracy: eight stable rules, 11 TP, 0 FP, 8 TN, 0 FN, no unmatched finding, and eight unsupported
  cases excluded from denominators.
- Robustness/security: all 15 executable cases passed, including real permissions and three runtime
  symlinks on this Linux host. Structural hostile-HTML/CSP and target-code non-execution checks
  passed.
- Performance: five complete runs over 240 generated files/components. Durations were
  389.581–413.343 ms with median 403.432 ms; maximum sampled child `VmRSS` was 162,377,728 bytes.
  These are descriptive observations without a portable threshold or exact lifetime-peak claim.
- Usability: six expert-review tasks completed; five observations had no issue and one was low
  severity. Participant testing was unexecuted, participant count was zero, and SUS was N/A with no
  responses or score.
- Dependency audit: zero known vulnerabilities; hosted CodeQL remained unexecuted.
- Harness: normal, all-tasks-complete transitional, terminal, and adversarial lifecycle tests
  passed; the live transitional state validated before closure.

## Evidence integrity

The collector executed from an allowlisted source snapshot with empty npm user/global
configuration, a bounded executable path, no credential variables, lockfile credential checks, and
source-mutation detection. It retained exactly 42 base artifacts plus `MANIFEST.sha256`.

Two definitive collections used the same source digest. The second matched all byte-stable
artifacts and the documented timing/RSS projections, then preserved the first package. The
milestone finalizer validates the unchanged base package and adds this report to
`MANIFEST.sha256`.

## Acceptance review

The final self-review covered all twelve product acceptance criteria and every M06 gate in
`docs/09_ACCEPTANCE_CRITERIA.md`, plus dependency direction, public model/result/reporter contracts,
hostile input, documentation, traceability, and academic evidence. No remaining in-scope blocker
was found.

M06 commits are:

- `c5eb8bc` — complete end-to-end CLI pipeline;
- `79454e4` — controlled project corpus;
- `e7ea7b5` — per-rule detection accuracy;
- `709ddc5` — robustness, security, and performance;
- `691a4ea` — usability, terminal lifecycle, and Activity 3 evidence.

## Limitations

- Results are static and do not execute React, resolve arbitrary custom abstractions, render a
  browser, or measure runtime UX/Core Web Vitals.
- Precision and recall describe only the small reviewed synthetic corpus.
- The heuristic review is not participant research and establishes no satisfaction, population, or
  SUS result.
- HTML security validation is structural/CSP-based, not a browser exploit execution.
- Hosted CodeQL/CI and remote publication were not executed. The local non-interactive HTTPS push
  lacked credentials and `gh` was unavailable; this does not change the local product result.
- Performance values describe one Node.js 24/Linux x64 host and have no machine-dependent pass
  threshold.

The harness transitioned the final configured milestone to terminal `complete`; no next milestone
is configured.

# M06 ExecPlan — End-to-end integration, validation, usability, and security evidence

## Purpose and observable outcome

UXAudit performs the complete scan from CLI input to reports. Controlled projects demonstrate the
behavior and accuracy of every stable rule. System, robustness, usability, performance, and security
evidence is assembled for the TFM testing delivery.

## Prerequisites

M01 through M05 are complete. Read all product acceptance criteria, test strategy, security plan,
academic alignment, and the complete traceability matrix.

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

## Milestone tasks

### M06-T01 — Complete end-to-end pipeline
Implement and verify the complete `ux-audit scan` flow, exit codes, progress/verbose behavior, report
paths, and recoverable errors.

### M06-T02 — Build controlled projects
Create valid, invalid, mixed, hostile, and large fixtures with versioned expected results.

### M06-T03 — Measure detection behavior
Execute each stable rule, classify TP/FP/FN/TN where meaningful, calculate precision/recall, inspect
failures, and correct justified defects without hiding limitations.

### M06-T04 — System, robustness, performance, and security
Run invalid inputs, malformed files, permissions where portable, deterministic reruns, dependency
audit, symlink/path/HTML injection scenarios, and a documented performance baseline.

### M06-T05 — Usability and TFM evidence
Run defined developer tasks with real participants when available; otherwise perform and label an
expert heuristic review. Use the SUS template only with actual responses. Assemble the evidence
index and draft factual implementation/testing summaries.

## Validation and acceptance

Run the complete repository verification and all controlled projects from the built CLI. Compare
actual output to versioned expected results. Review every item in `docs/09_ACCEPTANCE_CRITERIA.md`
and `docs/14_ACADEMIC_ALIGNMENT.md`.

## Evidence to retain

All items required by `docs/14_ACADEMIC_ALIGNMENT.md`, including raw machine outputs and concise
human conclusions.


## Progress

- [ ] Milestone started.
- [ ] Repository inspected and plan reconciled with reality.
- [ ] Tasks completed.
- [ ] Quality gate passed.
- [ ] Evidence collected.
- [ ] Documentation and traceability updated.
- [ ] Milestone closed and state advanced.

## Discoveries

Record implementation facts, library behavior, and assumptions discovered during work.

## Decision log

Record decisions made within the authority allowed by `AGENTS.md`.

## Risks and recovery

Maintain task-specific risks, rollback steps, and any remaining debt.

## Outcomes and retrospective

At closure, describe what now works, what was actually verified, remaining limitations, commits, and
the next milestone.


# UXAudit Executable Plans

An ExecPlan is a self-contained, living implementation specification for one milestone. A new Codex
session must be able to continue using only the repository and the active plan.

## Required properties

Every ExecPlan must:

- explain the user-visible outcome;
- identify the requirements and architecture involved;
- define concrete file and module changes without prescribing unnecessary line-level details;
- list acceptance criteria that can be demonstrated;
- contain commands to build, test, and verify;
- define required evidence;
- maintain progress, discoveries, decisions, and outcomes as work proceeds;
- remain accurate after every task and stopping point.

## Required sections

1. Purpose and observable outcome
2. Repository context and prerequisites
3. Scope
4. Out of scope
5. Requirements and traceability
6. Architecture and contracts
7. Milestone tasks
8. Validation and acceptance
9. Evidence to retain
10. Progress
11. Discoveries
12. Decision log
13. Risks and recovery
14. Outcomes and retrospective

## Execution behavior

When implementing an ExecPlan:

- proceed through all milestone tasks without asking for next steps;
- inspect existing code before modifying it;
- keep the plan updated while working;
- use prototypes only when they reduce a documented technical risk;
- run focused tests after each task and the full gate at closure;
- commit completed tasks;
- never mark a criterion complete without reproducible evidence;
- stop only for a blocker defined by `AGENTS.md`.

The plan is not complete when code is written. It is complete when the observable outcome works, the
quality gate passes, the repository is documented, and another agent can understand what changed.

## Post-v0.1 continuation

M01-M06 remain closed historical evidence. M07 and M08 are a prospective continuation approved on
2026-07-31. They must not rewrite completed plans, finalized evidence, the published `v0.1.0` tag,
or the existing external demo. M07 is a six-hour go/no-go milestone; M08 may activate only after M07
demonstrates the bounded component graph without product regressions.

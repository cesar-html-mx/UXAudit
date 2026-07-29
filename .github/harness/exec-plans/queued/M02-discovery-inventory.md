# M02 ExecPlan — Project discovery, inventory, and classification

## Purpose and observable outcome

Given a validated project root, UXAudit safely returns a deterministic inventory and a controlled list
of source candidates. Dependencies, generated output, and configured exclusions are not analyzed.

## Prerequisites

M01 is complete. Read requirements RF-03 through RF-06, architecture project-processing contracts,
security path controls, and M02 acceptance criteria.

## Scope

- discovery configuration and defaults;
- safe recursive traversal;
- excluded directories/files;
- symlink policy and loop prevention;
- normalized inventory records;
- deduplication and deterministic ordering;
- conservative source-candidate classification;
- CLI/application integration and summaries.

## Out of scope

- parsing source content;
- identifying full React component semantics;
- rules and final reports.

## Requirements and traceability

RF-03, RF-04, RF-05, RF-06, RNF-04, RNF-07, RNF-08, RNF-09.

## Architecture and contracts

Project processing must not depend on Babel, rules, or reporters. Separate discovery, inventory, and
classification responsibilities even if they collaborate closely.

## Milestone tasks

### M02-T01 — Define contracts and defaults
Define discovered file, inventory entry, source candidate, exclusions, supported extensions, and
symlink behavior.

### M02-T02 — Implement safe discovery
Traverse with Node APIs, preserve the authorized root, avoid cycles, return typed recoverable errors,
and sort directory entries deterministically.

### M02-T03 — Build the inventory
Normalize, deduplicate, retain project-relative paths, file type, extension, and other justified
metadata.

### M02-T04 — Classify candidates
Select supported source files conservatively. Do not label every `.ts` file a React component.

### M02-T05 — Integrate and collect evidence
Connect the application flow to discovery and expose a tested summary suitable for later reporters.

## Validation and acceptance

Use temporary directory unit tests plus a controlled fixture containing nested source, `node_modules`,
`dist`, duplicate/symlink scenarios, unsupported files, and mixed extensions. Run the full repository
verify command and M02 scenario.

## Evidence to retain

Inventory expected/actual JSON, exclusion proof, symlink behavior, deterministic rerun comparison,
test and coverage summaries.


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


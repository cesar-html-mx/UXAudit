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

Completed with separate immutable discovery, inventory, and classification contracts; exact
directory/file-name defaults; four supported source extensions; stable issue/exclusion records; and
the secure-by-default `skip | follow-within-root` symlink policy.

### M02-T02 — Implement safe discovery

Traverse with Node APIs, preserve the authorized root, avoid cycles, return typed recoverable errors,
and sort directory entries deterministically.

Completed with an iterative Node filesystem traversal that revalidates the canonical root and each
queued directory, uses path-relative containment rather than string prefixes, applies exclusions to
both observed and canonical targets, tracks visited canonical directories, and deterministically
sorts files, exclusions, and recoverable issues. A root operation failure is fatal and typed; a
descendant failure is retained without discarding siblings.

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

- [x] Milestone started.
- [x] Repository inspected and plan reconciled with reality.
- [ ] Tasks completed.
- [ ] Quality gate passed.
- [ ] Evidence collected.
- [ ] Documentation and traceability updated.
- [ ] Milestone closed and state advanced.

## Discoveries

- M01 closed at `bd6e0fe` with the Node.js 24 baseline and all quality gates passing; that
  verified commit is the starting point for M02.
- The harness had activated M02 but `state.json` still named the M01 branch. The repository was
  clean, so `milestone/m02-discovery-inventory` was created directly from the verified M01 closure
  commit and the state branch is reconciled in M02-T01.
- The implemented product currently stops after canonical root validation. No discovery,
  inventory, or classification module exists, so all five M02 tasks remain substantive work.
- M01's `ScanProjectResult` exposes only the canonical project path. M02-T05 must extend that
  application result with a discovery summary while preserving the established CLI input and
  internal-error boundaries.
- Node's directory enumeration order is not a product contract, so T02 performs explicit ordinal
  sorting. The traversal queue is iterative and grows safely while `for...of` consumes it, avoiding
  recursive call-stack growth.
- Stable filesystem operation failures can be classified from native error codes without retaining
  native messages or absolute host paths in the normalized issue contract.

## Decision log

- Keep discovery, inventory, and classification as separate project-layer modules with explicit
  immutable contracts; the application layer composes them and the CLI consumes only a normalized
  summary.
- D-015 selects `skip` as the default symlink policy and retains an explicit
  `follow-within-root` opt-in whose containment, cycle, and duplicate behavior must be proven in
  M02-T02/M02-T03.

## Risks and recovery

- Symlink behavior and canonical containment differ subtly across operating systems. T02 will use
  Node filesystem APIs only, tests the default policy through controlled temporary trees (using a
  Windows junction where needed), and verifies the complete follow policy through an injected
  portable filesystem adapter.
- Portable path APIs and repeated revalidation narrow but cannot eliminate filesystem TOCTOU races.
  The inventory is not a permanent authorization: M03 must revalidate containment when opening each
  candidate for parsing.
- Each task remains independently recoverable by reverting only its conventional task commit; no
  published history will be rewritten.

## Outcomes and retrospective

At closure, describe what now works, what was actually verified, remaining limitations, commits, and
the next milestone.

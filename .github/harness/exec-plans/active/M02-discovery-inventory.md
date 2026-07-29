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

Completed with a pure inventory builder that accepts only absolute descendants, normalizes
project-relative paths to `/`, lowercases extensions, assigns the explicit `file` type, deduplicates
canonical paths, and returns ordinal relative-path order without mutating discovery input.

### M02-T04 — Classify candidates

Select supported source files conservatively. Do not label every `.ts` file a React component.

Completed with a pure classifier that derives the normalized extension from each portable relative
path, accepts `.js`, `.jsx`, `.ts`, and `.tsx` case-insensitively, rejects declaration and
configuration paths, assigns only a parser-oriented source kind, and returns deterministic order
without reading source content or claiming React component semantics.

### M02-T05 — Integrate and collect evidence

Connect the application flow to discovery and expose a tested summary suitable for later reporters.

Implemented as an injected application composition of
`validation → discovery → inventory → classification`. The result retains all four stage outputs
plus five stable counts for M03. The CLI preserves M01's canonical-root line, appends a fixed-order
discovery summary, maps invalid roots to exit 2 and fatal stage failures to stable exit 3 messages,
and leaves recoverable descendant issues in the successful result. The controlled scenario compares
reviewed expected/actual JSON, exercises both symbolic-link policies and exclusions, proves
byte-identical reruns, and includes executable source/package sentinels that remain untouched.

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
- At M02 start, the implemented product stopped after canonical root validation. The milestone now
  adds separate discovery, inventory, and classification modules and composes them only in the
  application layer.
- M01's `ScanProjectResult` exposes only the canonical project path. M02-T05 must extend that
  application result with a discovery summary while preserving the established CLI input and
  internal-error boundaries.
- Node's directory enumeration order is not a product contract, so T02 performs explicit ordinal
  sorting. The traversal queue is iterative and grows safely while `for...of` consumes it, avoiding
  recursive call-stack growth.
- Stable filesystem operation failures can be classified from native error codes without retaining
  native messages or absolute host paths in the normalized issue contract.
- `path.extname` returns the final suffix only; lowercasing that value creates a stable classifier
  boundary while preserving the original case and spelling in `relativePath`.
- Classification recomputes the suffix from `relativePath` rather than trusting incidental
  inventory metadata. This preserves the normalized boundary if a test adapter or future producer
  supplies inconsistent extension data.
- Independent T05 review found that an injected discovery adapter could redefine the validated root.
  The application now treats any discovery or inventory root mismatch as a typed fatal stage error,
  always builds against and returns the canonical root established by validation, and covers both
  invariant failures.
- Independent security review found two fail-open ordering edges: an unknown runtime link policy
  entered the follow branch, and a retargeted queued directory could be inspected before its
  containment check. Both now fail closed and have regressions proving default-equivalent link
  skipping and no metadata query outside the root.
- The controlled source fixture contains executable side effects as well as a package-script
  sentinel, and the scenario checks the sentinel after direct application reruns and compiled CLI
  execution. Discovery never imports or executes either path.
- Evidence review required stronger isolation and closure integrity. The collector now rejects
  included source symlinks, forces the pinned Node executable onto child `PATH`, validates npm/Git
  metadata and active M02-T05 state, proves zero skipped/todo tests from Vitest JSON, publishes the
  initial package through a same-filesystem staging directory, and finalizes the SHA-256 manifest
  after adding the milestone report.

## Decision log

- Keep discovery, inventory, and classification as separate project-layer modules with explicit
  immutable contracts; the application layer composes them and the CLI consumes only a normalized
  summary.
- D-015 selects `skip` as the default symlink policy and retains an explicit
  `follow-within-root` opt-in whose containment, cycle, and duplicate behavior must be proven in
  M02-T02/M02-T03.
- D-016 defines inventory identity as canonical absolute path and ordering as normalized relative
  path. Observed aliases collapse; distinct hard-link paths remain distinct because they are
  separately addressable project locations.
- D-017 keeps classification syntactic and parser-oriented: supported extensions become language
  and JSX source kinds, while `.d.ts`, `config.*`, and `*.config.*` remain non-candidates without
  reading or interpreting code.
- D-018 retains normalized stage outputs behind one application boundary, preserves M01's first CLI
  line and exit meanings, and adds only a discovery summary rather than constructing a premature
  `AuditResult`.

## Risks and recovery

- Symlink behavior and canonical containment differ subtly across operating systems. T02 uses Node
  filesystem APIs only, tests the default policy through controlled temporary trees (using a
  Windows junction where needed), and verifies the complete follow policy through an injected
  portable filesystem adapter.
- Portable path APIs and repeated revalidation narrow but cannot eliminate filesystem TOCTOU races.
  The inventory is not a permanent authorization: M03 must revalidate containment when opening each
  candidate for parsing.
- Canonical-path deduplication does not infer physical identity for hard links. Adding device/inode
  metadata would require extra platform-sensitive filesystem state and is not justified for the M02
  contract; this limitation remains explicit.
- Name-based configuration rejection can conservatively omit an unusually named runtime source
  such as `config.ts`; this trade-off is deliberate for RF-04 and can be revisited only with a
  documented configuration contract in M05.
- Each task remains independently recoverable by reverting only its conventional task commit; no
  published history will be rewritten.

## Outcomes and retrospective

At closure, describe what now works, what was actually verified, remaining limitations, commits, and
the next milestone.

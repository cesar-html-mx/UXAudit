# M07 ExecPlan — Bounded module and component graph

## Purpose and observable outcome

Prove within six hours that UXAudit can connect direct local React component imports to their
definitions and use that graph for one composition-sensitive rule without weakening the published
v0.1.0 behavior. A supported page that imports `Header` and `Hero`, each with one intrinsic `h1`,
must produce the documented composed-heading finding. Unresolved, ambiguous, cyclic, or unsupported
syntax must remain safe and deterministic.

This is a go/no-go milestone. Passing M07 authorizes the separately queued M08 work. Failure leaves
v0.1.0, `main`, historical evidence, and the existing external demo unchanged.

## Repository context and prerequisites

- Public baseline: `de540f0ec3d3a7d198905eccd06eae46bc3ac3e7` on `main`.
- Historical evidence branch: `448dae9f341c48fed3019dbb72e5314b9ca5f506`.
- Rollback tags: `safeguard/pre-v0.2-main-20260731` and
  `safeguard/post-harness-evidence-20260731`.
- Milestone branch: `milestone/m07-component-graph`.
- Required runtime: Node.js 24.18.0 and npm 11.16.0.
- Baseline verification: `npm run verify` passed 621 tests before M07 product changes.
- Deadline: 2026-07-31T15:38:04-06:00.
- The sibling `uxaudit-demo-mercado-raiz` directory is frozen and outside this milestone.

## Scope

- Define parser-independent facts for component exports and component uses.
- Recognize direct `default` and named imports, including named import aliases, when the local JSX
  binding is unambiguous.
- Recognize direct component exports supported by the existing syntactic component recognizer.
- Resolve only relative modules with explicit supported extensions, extensionless supported files,
  or supported `index` files.
- Link a custom JSX node to exactly one local component definition.
- Preserve unresolved and ambiguous references without guessing.
- Store cycles safely and traverse composition with an explicit visited path and depth bound.
- Make `seo/multiple-h1` aware of supported transitive composition while retaining source-local
  behavior and deterministic finding locations.
- Add focused, integration, regression, security, and bilingual contract evidence.

## Out of scope

- TypeScript/Vite path aliases, package imports, namespace JSX members, complex barrels, `export *`,
  dynamic imports, CommonJS resolution, and runtime aliases.
- Higher-order components, `memo`, `forwardRef`, render props, router semantics, hooks, state, and
  conditional runtime evaluation.
- General propagation of props, JSX spreads, or `children`; those are gated behind M08.
- Changing finding/result schemas, CLI options, reporters, the npm package, or the external demo.
- Merging to `main`, publishing a release, or deleting/revising historical evidence.

## Requirements and traceability

- RF-07: Babel extracts supported syntax without executing target modules.
- RF-08: the normalized model gains explicit module/component relationships required by rules.
- RF-10: composition-aware rules consume only the normalized model.
- RF-12 and RNF-05: findings retain deterministic source locations.
- RNF-03, RNF-04, RNF-07, and RNF-08: the implementation remains typed, testable, deterministic,
  single-pass per source, and compatible with `.js`, `.jsx`, `.ts`, and `.tsx`.
- Product constraints: no target import/execution, no AST leakage to rules, no network, and no source
  modification.
- Traceability updates must name the new contracts, implementation modules, and exact tests.

## Architecture and contracts

The Babel adapter may inspect bindings while parsing one file, but it emits only normalized facts.
`AnalyzedSourceFile` will describe exported component bindings and custom JSX uses as local or direct
relative-import references. It must not resolve the target file.

`buildAnalysisModel` remains the project aggregation boundary. A focused pure resolver indexes
analyzed file paths and exported component names, resolves one exact safe target, and emits a
separate `ComponentLink` collection. `JsxElement` remains a syntax observation and does not gain a
parser-dependent field.

Rules receive only `AnalysisModel`. Composition traversal follows `ComponentLink` records, uses a
path-local visited set and a documented maximum depth, and never executes or imports target code.
Ambiguity and unsupported syntax yield no link rather than a speculative edge.

## Milestone tasks

### M07-T01 — Define the bounded component-graph contract and acceptance corpus

- Update requirements, architecture, testing, rule limitations, acceptance, and traceability in
  paired English and Latin American Spanish.
- Add normalized model contracts and invariant-focused tests before implementation.
- Fix exact positive, negative, ambiguous, cyclic, and non-execution scenarios.

Verification: focused model/contract tests, `npm run docs:check`, typecheck, and harness validation.

### M07-T02 — Extract normalized component import, export, and use facts

- Extend Babel extraction using binding identity, not text-only matching.
- Cover default, named, aliased named, local, shadowed, type-only, namespace, package, and unsupported
  reexport cases.
- Preserve AST/source confinement and deterministic extraction order.

Verification: focused Babel extraction/parser tests, lint, typecheck, and harness validation.

### M07-T03 — Resolve direct relative component links deterministically

- Implement a pure project-level resolver with exact-one-candidate semantics.
- Validate normalized paths, file ownership, IDs, uniqueness, ordering, unresolved references, and
  ambiguous candidates.
- Prove cycles are stored without recursive expansion and input file ordering cannot change links.

Verification: focused resolver/model/integration tests and complete existing tests.

### M07-T04 — Evaluate multiple H1 headings across bounded component composition

- Traverse supported component links with cycle/depth controls.
- Define source versus composed finding ownership and prevent duplicate reports.
- Cover sibling composition, repeated child use, cycles, unresolved children, and existing local H1
  behavior.

Verification: focused SEO/rule/integration tests plus exact multi-file CLI scenario.

### M07-T05 — Execute the six-hour viability gate and retain evidence

- Run the full product gate, coverage, parser/rule/system scenarios, package consumer check, harness,
  and independent self-review.
- Retain commands, environment, exact expected/actual links and findings, regression counts, known
  unsupported cases, deadline status, and a milestone report.
- Close M07 only when every acceptance criterion passes; otherwise record no-go and do not activate
  product integration beyond the branch.

## Validation and acceptance

M07 is viable only if all of the following are demonstrated before the deadline:

1. Direct relative default, named, and aliased named imports link to exactly one recognized component.
2. Local component uses link without relying on string coincidence or crossing a shadowed binding.
3. Missing, package, namespace, out-of-root, reexport, and ambiguous references remain unresolved.
4. A `Page -> Header + Hero` fixture reports composed multiple H1 headings at an exact documented
   location while each child alone remains locally valid.
5. Repeated component use has explicitly tested multiplicity semantics and no accidental duplicate
   cause reports.
6. A cycle terminates safely and produces deterministic output.
7. Target sentinel modules are never imported or executed.
8. Reversing analyzed-file input order produces the same sorted links and findings.
9. Existing 621-test behavior has no regression; all new required tests pass with none skipped/todo.
10. `npm run verify`, coverage at or above 90% in every dimension, package installation, and harness
    validation pass on Node.js 24.18.0.

No-go if the supported links remain ambiguous, cycles can hang or explode, composed H1 requires AST
access in the rule, existing findings change unintentionally, or any required gate is red at the
deadline.

## Evidence to retain

Create `evidence/m07-component-graph/` containing at minimum:

- `BASELINE.md` with exact commits, tags, branch, runtime, deadline, and frozen-demo statement;
- focused and full command transcripts or concise machine-readable summaries;
- a reviewed scenario manifest with expected links/findings and unsupported controls;
- deterministic rerun comparison;
- coverage and package-consumer results;
- `MILESTONE_REPORT.md` with explicit GO or NO-GO;
- `MANIFEST.sha256` covering the final evidence set.

No prior evidence directory may be changed or copied into M07 as if freshly executed.

## Progress

- [x] 2026-07-31 09:38 - Recorded rollback anchors and created the isolated M07 branch from `main`.
- [x] 2026-07-31 09:36 - Baseline `npm run verify` passed on Node.js 24.18.0 with 621 tests.
- [x] 2026-07-31 09:38 - Restored the internal harness only on the isolated milestone branch.
- [x] 2026-07-31 10:04 - M07-T01 contract and corpus; 31 model tests, strict types, paired
      documentation, and harness validation passed.
- [x] 2026-07-31 10:07 - M07-T02 normalized parser facts; 26 focused extraction tests, lint,
      strict types, and harness validation passed.
- [x] 2026-07-31 10:13 - M07-T03 deterministic component links; 44 focused resolver/model/project
      tests and all 643 repository tests passed.
- [ ] M07-T04 bounded composed H1 behavior.
- [ ] M07-T05 viability evidence and decision.

## Discoveries

- Public `main` intentionally contains no internal harness; the continuation therefore restores it
  only on the milestone branch and must later produce a clean public release diff.
- The existing model already records custom JSX names, ownership, parents, and locations, but no
  imports, exports, bindings, target component IDs, or module graph.
- Existing hardcoded intrinsic defects in a reusable component are already reported once at the
  definition; M07 targets genuinely composition-dependent behavior rather than duplicating causes
  at every use.
- The first local verification used unsupported Node.js 22 and failed only the tests relying on
  Node.js 24 `import.meta.main`; the pinned environment passed the complete gate.
- A six-file controlled corpus fixes the gate at 7 components, 17 JSX nodes, 10 custom uses, 8
  resolved uses, 2 unresolved uses, and exactly 2 expected findings without executing its sentinel.
- Keeping per-file component-use facts separate from project-level `ComponentLink` records lets the
  parser retain binding identity without leaking Babel values or guessing target files.
- Babel scope bindings distinguish imported, local, aliased, shadowed, namespace, and type-only JSX
  references before only normalized strings and IDs cross the parser boundary.
- The committed multi-file project produces 8 exact links and 2 unresolved uses in stable source
  order; reversing input and repeating the complete analysis produces byte-identical model JSON.

## Decision log

- D-043 isolates M07 from public and historical baselines and fixes the six-hour deadline.
- D-044 fixes parser-independent export/use/link contracts and the exact reviewed acceptance corpus.
- D-045 uses Babel binding identity only inside extraction and records unresolved import facts for
  the project resolver instead of filtering them by filesystem or package syntax in the parser.
- D-046 resolves supported relative modules only when one analyzed candidate and one named export
  exist; cycles are stored as ordinary links and never expanded during model construction.
- Direct relative one-candidate resolution is the maximum M07 module surface; unsupported cases
  remain unresolved rather than guessed.
- M07 proves the graph with `seo/multiple-h1`; transparent props/children wrappers remain M08 work.

## Risks and recovery

- R-026: binding or module ambiguity could create false links. Recovery is fail-closed unresolved
  output with exact ambiguity tests.
- R-027: cycles or repeated uses could create recursive expansion. Recovery is graph storage without
  expansion plus bounded path-aware traversal.
- R-028: the experiment could regress v0.1.0. Recovery is to abandon the milestone branch and use
  the two safeguard tags; no change is made to `main`, npm, or the demo.
- R-029: the timebox could consume delivery capacity without proof. Recovery is an explicit NO-GO
  report at the deadline and immediate return to the v0.1.0 academic delivery.

## Outcomes and retrospective

Pending. This section must state GO or NO-GO and may not describe partial implementation as viable.

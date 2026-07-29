# M03 ExecPlan — Source parser and analysis model

## Purpose and observable outcome

UXAudit parses selected JS/JSX/TS/TSX files, retains locations, identifies the JSX/component
information required by the initial catalog, and exposes a parser-independent analysis model.

## Prerequisites

M02 is complete. Read RF-07, RF-08, parser/model architecture, rule catalog information needs, and
security constraints against executing target code.

## Scope

- parser and model contracts;
- Babel parser setup;
- AST traversal inside the parsing boundary;
- source locations;
- JSX elements and attributes;
- justified component/file relationships;
- normalized project model;
- recoverable per-file errors.

## Out of scope

- rule decisions;
- report formatting;
- importing or executing the analyzed project.

## Requirements and traceability

RF-07, RF-08, RF-12, RNF-02, RNF-03, RNF-04, RNF-07, RNF-08.

## Architecture and contracts

Babel node types do not appear in the public rule contract. Keep the AST adapter internal and
transform only information justified by stable rules.

### Reconciled implementation map

- `src/parsing/` owns source opening, Babel configuration, AST traversal, per-file parser results,
  and stable parser errors. Babel AST values never leave this package.
- `src/domain/models/` owns source coordinates and the serializable project/file/component/JSX
  model consumed by later rules.
- The per-file parser result is the model-builder input. It retains intrinsic/custom/fragment
  elements, parent/component relationships, named/spread attributes, static primitive/object
  values, dynamic-value confidence, static/dynamic child text, and locations required by M04.
- Source positions use one-based lines, zero-based UTF-16 columns and offsets, and end-exclusive
  ranges, matching Babel and JavaScript string indexing while documenting the convention.
- The source-opening boundary reauthorizes the canonical root and file, opens through a file
  descriptor without following a final symlink where the platform supports it, verifies regular
  file identity before reading, enforces a byte limit, decodes UTF-8 strictly, and records stable
  recoverable errors without native messages or absolute-path disclosure.
- `src/application/analyze-project.ts` composes the existing M02 `scanProject` contract with
  parser/model output and a separate parsing summary. The completed `scanProject` public contract,
  canonical-root result, and discovery summary remain unchanged.

## Milestone tasks

### M03-T01 — Define contracts

Define parser result/error, source locations, analyzed files, components, JSX elements, attributes,
literal/dynamic values, and model builder input/output.

Status: completed. UXAudit now owns readonly, AST-free per-file and project contracts with portable
half-open locations, flat deterministic relationships, intrinsic/custom/fragment nodes,
named/spread attributes, literal/object/dynamic values, text confidence, and stable recoverable
read/parse/extract errors. Node.js 24 verification passed eight focused contract tests and all 74
repository tests.

### M03-T02 — Implement Babel parser adapter

Support JS, JSX, TS, and TSX with source type behavior and plugins verified by fixtures.

Status: completed. Exact Babel `8.0.4` runtime packages are locked, Babel imports are forbidden from
domain/rule modules, and the internal adapter uses per-kind plugins, unambiguous source type,
relative filenames, locations, and no partial recovery. Ten focused tests cover the four-kind
matrix, plugin mismatches, normalized malformed syntax, CRLF/astral UTF-16 offsets, deterministic
AST output, direct dependency boundaries, and inert target text. All 84 repository tests, build,
dependency tree, and a zero-vulnerability audit passed on Node.js 24.

### M03-T03 — Extract JSX and components

Traverse without evaluating code. Preserve intrinsic versus custom element distinction and attribute
value confidence.

Status: completed. The internal Babel boundary now performs one bounded AST traversal and emits only
UXAudit-owned records. It recognizes PascalCase function declarations, arrow/function expressions,
supported React class components, and anonymous default exports; extracts intrinsic, custom,
member, namespaced, shorthand-fragment, and `React.Fragment` JSX; and retains deterministic
component, parent, child, and root relationships. Attribute and nested-function boundaries prevent
non-rendered or independently executed JSX from being attached to a rendered child tree. Named and
spread attributes, exact primitive/structured-object values, conservative dynamic/partial values,
static-text confidence, and half-open UTF-16 locations are retained without evaluating expressions.
Extraction is limited to 100,000 visited Babel nodes and 256 UTF-16 code units of static text per JSX
node; internal invariant failures stop through one stable fatal error. Node.js `24.18.0` verification
passed 22 focused tests and all 106 repository tests, with format, lint, typecheck, build, and global
coverage gates passing.

### M03-T04 — Build the normalized model

Aggregate deterministic project data and expose query helpers only when justified.

Status: completed. `buildAnalysisModel` now defensively projects per-file parser output into a fresh,
flat, AST-free project model. It validates portable paths, canonical IDs, safe and mutually
consistent UTF-16 coordinates, containment, exact file/component membership, component ownership,
root sets, reciprocal parent/child relationships, source order, and acyclic JSX graphs. Literal,
dynamic, object, text-confidence, finite-number, depth, and object-cycle invariants are checked
before data enters the model. Files sort ordinally by portable path; components and JSX sort by
source offset and canonical ID, while source-meaningful attribute/property order is preserved.
Hostile control characters remain untrusted data rather than being interpreted or silently changed.
Any malformed builder input stops with one generic fatal `AnalysisModelInvariantError`; no query
helper was added because the normalized arrays already satisfy the documented M04 consumers.
Node.js `24.18.0` verification passed 26 focused tests and all 132 repository tests across 16 files,
with format, lint, typecheck, build, and global coverage gates passing.

### M03-T05 — Integrate and isolate errors

Continue after a malformed file when safe and report parse failures separately from findings.

Status: completed. Retained evidence and harness closure follow the task commit.
`analyzeProject` now composes the unchanged M02 scan with an authorized bounded reader, Babel
composite, sequential candidate batch, and normalized model builder. Recoverable per-file errors
remain separate and safe siblings continue; non-portable candidate declarations, root loss,
parser/result bookkeeping, extraction invariants, and model invariants fail through stable generic
boundaries. The production CLI appends one parsing-summary line while injected scan-only callers
retain the established two-line behavior. Node.js `24.18.0` verification passes all 208 tests across
21 files with 97.63% statements, 91.86% branches, 100% functions, and 97.59% lines covered. The
controlled scenario parses seven siblings, isolates one malformed TSX file, retains seven
components and 15 JSX nodes across all four source kinds, reproduces byte-identically, and does not
execute its target-code sentinel.

## Validation and acceptance

Test multiple component styles, fragments, spreads, string/expression/boolean attributes, location
accuracy, malformed files, and mixed projects. Verify that rule-facing types contain no Babel nodes.

## Evidence to retain

Parser matrix, model samples, location assertions, malformed-file run, memory/time baseline, tests
and coverage.

## Progress

- [x] Milestone started.
- [x] Repository inspected and plan reconciled with reality.
- [x] Tasks completed.
- [x] Quality gate passed.
- [x] Evidence collected.
- [x] Documentation and traceability updated.
- [ ] Milestone closed and state advanced.

## Discoveries

- M02 is complete and the repository contains the verified
  `validation → discovery → inventory → classification` pipeline, but no parser, analysis-model, or
  M03 fixture implementation. The starting suite has 66 passing tests across nine files.
- The harness had correctly activated M03, while machine state still named the M02 branch. The new
  `milestone/m03-parser-analysis-model` branch was created from the verified M02 tree and
  `state.currentBranch` was reconciled before product work.
- The owner squash-merged M02 after this workspace last fetched `origin/main`. The local M03 branch
  therefore preserved the correct M02 tree. Commit `0e32080` merged the fetched main squash as an
  ancestor without rewriting M03 history.
- Registry metadata on 2026-07-29 identifies Babel `8.0.4` as the current stable parser, traverse,
  and types release. Its Node engine (`^22.18.0 || >=24.11.0`) is compatible with the required
  Node.js `24.18.0`. Existing Babel packages are only incidental development transitive
  dependencies and cannot satisfy the runtime contract.
- The initial rule catalog requires more than tag names: M04 needs literal accessibility/image
  attributes, structured literal `style.fontSize`, static versus dynamic descendant text, element
  hierarchy, and component/file relationships. M03 will retain exactly those facts without
  evaluating expressions.
- M02 documents the remaining file-open TOCTOU boundary. M03 owns its mitigation and will test
  containment-before-read, identity changes, non-regular/oversized/invalid-UTF-8 inputs, sibling
  continuation, and target-code non-execution.
- M03-T01 added only UXAudit-owned contracts; a boundary scan found no Babel reference in
  `src/domain/` or the public parser contract. The source corpus for T02/T03 uses inert `.fixture`
  suffixes so TypeScript, Node, and test discovery cannot execute or compile target samples.
- Babel 8 locations expose `line`, `column`, and zero-based `index`; syntax failures also carry this
  position. The adapter copies only those numeric coordinates and replaces native messages,
  filenames, reason codes, and code frames with one stable UXAudit error.
- Babel's direct parser API does not load `.babelrc` or execute imports. The controlled
  no-execution fixture contains a top-level filesystem write and throw, yet parsing it as supplied
  text leaves the sentinel absent.
- M03-T03 uses one linear AST traversal for discovery and relationship bookkeeping, followed by
  explicit source-offset/ordinal ordering of extracted components and JSX records. Stable IDs derive
  only from portable file paths and UTF-16 start offsets.
- JSX in a named or spread attribute starts an independent relationship root, while nested
  functions, class fields, and non-render class members cannot inherit the surrounding component's
  ownership. A supported class owns only JSX reached through its instance `render` method.
- Literal extraction is deliberately narrow: finite primitives and static templates are exact;
  object properties remain ordered and prototype-safe; computed, spread, non-finite, or deeper than
  the bounded object scope are partial or dynamic. Static descendant text is whitespace-normalized,
  confidence-tagged, and truncated conservatively after 256 UTF-16 code units.
- The T03 extraction gate passed 22 focused cases and all 106 repository tests on Node.js
  `24.18.0`. Global V8 coverage measured 97.17% statements, 90.71% branches, 100% functions, and
  97.13% lines; formatting, lint, typecheck, and build also passed.
- M03-T04 treats per-file parser output as an internal trust boundary rather than concatenating its
  arrays. It recursively copies only documented fields, strips parser/source extras, and retains no
  mutable input array or object reference.
- Project normalization sorts portable file paths ordinally and rebuilds canonical per-file/global
  arrays. Stable component and JSX IDs must match their file path and UTF-16 start offset; duplicate,
  missing, extra, cross-file, or out-of-order membership fails closed.
- Coordinate, containment, ownership, root, parent/child reciprocity, cycle, value-discriminant,
  confidence, finite-number, object-depth, and `usesJsx` inconsistencies all converge on the same
  fatal invariant error without leaking the invalid value. Control and bidirectional characters in
  an otherwise portable relative path remain data for later output-boundary escaping.
- The T04 builder gate passed 26 focused cases and all 132 repository tests across 16 files on
  Node.js `24.18.0`. Global V8 coverage measured 97.00% statements (973/1003), 90.31% branches
  (634/702), 100% functions, and 96.95% lines; formatting, lint, typecheck, and build also passed.
- M03-T05 inspection found that `scanProject` is already an exported, tested M02 application
  contract and the harness forbids changing completed public contracts. The integration will use a
  new facade and an additive CLI dependency so existing injected callers retain their behavior.
- The secure source boundary must consume the canonical root and exact classified candidate paths,
  reauthorize both before and after bounded descriptor reads, and collapse native filesystem detail
  into the stable recoverable parser error taxonomy. Syntax/extraction failures remain local to one
  file; root authorization and model-invariant failures remain fatal.
- The production reader now checks native absolute/canonical containment, regular-file identity and
  size/time snapshots before and after an opened handle, reads at most 1 MiB plus one growth byte in
  64 KiB requests, decodes UTF-8 fatally while retaining a BOM, and closes exactly once. POSIX uses
  no-follow/non-blocking flags; Windows uses its portable read-only flag plus the same post-open
  identity checks.
- Independent review found and the implementation corrected two defense-in-depth portability gaps:
  non-portable relative paths now fail through a detail-free reader invariant instead of entering a
  recoverable record, and drive-prefixed paths are rejected consistently on every host. Reader
  tests use native path construction so the hosted Windows/macOS matrix does not inherit a POSIX
  assumption.
- Candidate processing clones and sorts input ordinally, executes exactly one parser pipeline at a
  time, continues after typed read/parse/extract failures, and rejects duplicates or result-path
  mismatches fatally. The separate `analyzeProject` facade preserves the completed `scanProject`
  contract and makes parsing counts/errors explicit without claiming rules or findings.
- The M03 controlled scenario exercises JavaScript, JSX, TypeScript, and TSX fixtures, exact model
  and location projections, a malformed sibling, CLI output, and a target-code sentinel. Two runs
  are byte-identical; seven files are modeled, one fails locally, and no target code executes.
- The final pre-evidence T05 gate passes 208 tests across 21 files on Node.js `24.18.0`. Global V8
  coverage is 97.63% statements (1195/1224), 91.86% branches (768/836), 100% functions (220/220),
  and 97.59% lines (1175/1204); format, lint, typecheck, build, compiled CLI smoke, scenario, and
  harness validation pass.
- The isolated evidence collector repeated locked installation, product gate, coverage, a
  zero-skip/todo test run, compiled CLI smoke, the controlled scenario, harness validation,
  dependency audit, and the direct Babel dependency check. All nine passed; the audit reported zero
  known vulnerabilities and a second collection preserved the package after stable-result
  comparison. The source snapshot digest is
  `sha256:e6f315a35a130dc394009ada75cf9658bfd6bcaefa66c772e1b9183c62190b40`
  and the normalized scenario digest is
  `sha256:48501cab384bb28885899c3646ddc4521470c777339ff15c951cc2789d1b3225`.

## Decision log

- Record the exact Babel 8 runtime dependencies, AST-free contracts, coordinate convention,
  bounded secure-reader policy, component heuristics, and model invariants in `DECISIONS.md` as
  their tasks are implemented.
- D-019 fixes the exact Babel 8 dependency/configuration boundary; D-020 fixes the AST-free model
  and confidence semantics.
- D-021 fixes bounded AST extraction, component/relationship barriers, conservative retained text
  and values, and the stable fatal invariant boundary.
- D-022 fixes defensive project-model projection and graph/value/location invariants; D-023 fixes
  the additive facade, sequential error-isolated batch, compatibility, and parsing-summary boundary.

## Risks and recovery

- Parser syntax gaps are isolated per file and covered by the four-kind fixture matrix.
- Dynamic JSX is represented explicitly rather than promoted to a literal fact, limiting false
  confidence in M04.
- File replacement cannot be made mathematically race-free with portable filesystem APIs. Read
  through the verified handle, compare path/handle identity, fail closed on change, and document
  the residual platform limit.
- Source size and extracted-node limits prevent one candidate from monopolizing memory. Thresholds
  are product constants with boundary tests, not machine-dependent timing assertions.
- Sequential parsing bounds simultaneous source/AST retention but does not cap the number of project
  candidates. The M03 measurement is a factual controlled baseline; project-scale thresholds remain
  an M06 validation responsibility.
- The component recognizer is intentionally syntactic: it does not resolve aliases, higher-order
  components, computed React superclasses, or runtime rendering. Nested-function and custom-child
  text is therefore represented conservatively instead of inheriting unjustified ownership or exact
  confidence.
- The M02 squash ancestry is reconciled through merge commit `0e32080`, which preserves the M03 tree;
  rebase and force-push remain prohibited.

## Outcomes and retrospective

At closure, describe what now works, what was actually verified, remaining limitations, commits, and
the next milestone.

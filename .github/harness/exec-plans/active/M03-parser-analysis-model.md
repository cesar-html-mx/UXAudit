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
- `src/application/scan-project.ts` extends the existing M02 pipeline additively with parser/model
  output and a separate parsing summary. The established canonical-root and discovery summary
  output remain unchanged.

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

### M03-T03 — Extract JSX and components

Traverse without evaluating code. Preserve intrinsic versus custom element distinction and attribute
value confidence.

### M03-T04 — Build the normalized model

Aggregate deterministic project data and expose query helpers only when justified.

### M03-T05 — Integrate and isolate errors

Continue after a malformed file when safe and report parse failures separately from findings.

## Validation and acceptance

Test multiple component styles, fragments, spreads, string/expression/boolean attributes, location
accuracy, malformed files, and mixed projects. Verify that rule-facing types contain no Babel nodes.

## Evidence to retain

Parser matrix, model samples, location assertions, malformed-file run, memory/time baseline, tests
and coverage.

## Progress

- [x] Milestone started.
- [x] Repository inspected and plan reconciled with reality.
- [ ] Tasks completed.
- [ ] Quality gate passed.
- [ ] Evidence collected.
- [ ] Documentation and traceability updated.
- [ ] Milestone closed and state advanced.

## Discoveries

- M02 is complete and the repository contains the verified
  `validation → discovery → inventory → classification` pipeline, but no parser, analysis-model, or
  M03 fixture implementation. The starting suite has 66 passing tests across nine files.
- The harness had correctly activated M03, while machine state still named the M02 branch. The new
  `milestone/m03-parser-analysis-model` branch was created from the verified M02 tree and
  `state.currentBranch` was reconciled before product work.
- The owner squash-merged M02 after this workspace last fetched `origin/main`. The local M03 branch
  therefore preserves the correct M02 tree, and the new main squash must be fetched and recorded as
  an ancestor before M03 publication; no history rewrite is required.
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

## Decision log

- Record the exact Babel 8 runtime dependencies, AST-free contracts, coordinate convention,
  bounded secure-reader policy, component heuristics, and model invariants in `DECISIONS.md` as
  their tasks are implemented.

## Risks and recovery

- Parser syntax gaps are isolated per file and covered by the four-kind fixture matrix.
- Dynamic JSX is represented explicitly rather than promoted to a literal fact, limiting false
  confidence in M04.
- File replacement cannot be made mathematically race-free with portable filesystem APIs. Read
  through the verified handle, compare path/handle identity, fail closed on change, and document
  the residual platform limit.
- Source size and extracted-node limits prevent one candidate from monopolizing memory. Thresholds
  are product constants with boundary tests, not machine-dependent timing assertions.
- The M02 squash ancestry will be reconciled before the first push. Recovery is a normal merge that
  preserves the M03 tree; rebase and force-push remain prohibited.

## Outcomes and retrospective

At closure, describe what now works, what was actually verified, remaining limitations, commits, and
the next milestone.

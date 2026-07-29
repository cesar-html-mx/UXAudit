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

## Milestone tasks

### M03-T01 — Define contracts
Define parser result/error, source locations, analyzed files, components, JSX elements, attributes,
literal/dynamic values, and model builder input/output.

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


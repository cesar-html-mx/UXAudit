# M08 ExecPlan — Bounded contextual component analysis and realistic validation

## Purpose and observable outcome

If and only if M07 closes with GO, extend the proven component graph with conservative transparent
wrapper projections for selected static props and children, then validate UXAudit as an installed
dependency in a realistic multi-file React consumer.

## Repository context and prerequisites

- M01-M06 must remain immutable.
- M07 must be completed with every viability criterion passing.
- Start from the accepted M07 product commit on `milestone/m08-contextual-component-analysis`.
- Preserve public `main`, v0.1.0, historical branches, rollback tags, and the frozen external demo.

## Scope

- Define one-intrinsic-root transparent wrappers with direct `...props` and direct `children`
  forwarding.
- Project only statically supported use-site props and children.
- Adapt prioritized accessibility, image, link, and heading checks when evidence is conclusive.
- Distinguish definition-owned causes from use-dependent findings and prevent duplication.
- Build a new committed realistic consumer fixture with a design system, layouts, pages, composites,
  healthy controls, supported defects, and explicit unsupported controls.
- Validate packed-package installation and exact expected-versus-actual output.

## Out of scope

General React execution semantics, arbitrary expressions, aliases, complex barrels, HOCs,
`memo`/`forwardRef`, render props, router/runtime branches, CSS cascade, and modification of the
existing sibling demo.

## Requirements and traceability

RF-08, RF-10, RF-12, RNF-03 through RNF-08, the static-analysis constraints, and all updated M07
public contracts apply. M08 must add explicit traceability for every promoted contextual scenario.

## Architecture and contracts

Extend normalized parser facts and project-level projections without exposing Babel nodes to rules.
Use conservative three-valued evidence: supported true/false facts may drive rules; unresolved facts
remain unknown. Bound depth, fan-out, and cycle traversal.

## Milestone tasks

1. M08-T01 defines wrapper and source-versus-usage semantics.
2. M08-T02 implements bounded static props/children projection.
3. M08-T03 adapts prioritized rules with exact positive/negative/unknown tests.
4. M08-T04 creates and runs the realistic installed-consumer validation.
5. M08-T05 completes regression, security, package, bilingual documentation, and evidence gates.

## Validation and acceptance

All existing tests remain green. Every promoted scenario belongs to the supported accuracy
denominator and may not be relabeled unsupported to make the score pass. The new consumer must be
installed from the packed product, execute without network access, produce exact deterministic
findings, leave target sentinels absent, and preserve safe cycle/depth limits.

## Evidence to retain

Use `evidence/m08-contextual-analysis/` for the support matrix, expected/actual inventory, commands,
coverage, package consumer run, deterministic comparison, limitations, and milestone report.

## Progress

- [ ] Waiting for M07 GO.

## Discoveries

None yet.

## Decision log

M08 cannot activate from partial M07 work.

## Risks and recovery

If contextual projection produces speculative findings or cannot preserve v0.1.0 behavior, stop the
affected rule promotion and retain it as unsupported. Do not merge or publish a red candidate.

## Outcomes and retrospective

Pending M07.

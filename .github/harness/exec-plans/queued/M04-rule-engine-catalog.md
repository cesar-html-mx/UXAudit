# M04 ExecPlan — Rule engine and initial validation catalog

## Purpose and observable outcome

UXAudit loads enabled rules, evaluates them independently over the analysis model, and returns
deterministically ordered normalized findings for required rules in all four categories.

## Prerequisites

M03 is complete. Read `docs/08_RULE_CATALOG.md`, finding requirements, architecture contracts,
security rules, and M04 acceptance criteria.

## Scope

- rule metadata and evaluation contract;
- category and severity types;
- finding and rule-execution error contracts;
- registry, filtering, loader, evaluator;
- required stable rules;
- positive, negative, boundary, and limitation fixtures;
- rule-level traceability and evidence.

## Out of scope

- terminal/JSON/HTML formatting;
- claims beyond each rule's documented static scope;
- promoting experimental rules without measured evidence.

## Requirements and traceability

RF-09 through RF-14, RNF-02 through RNF-07, RNF-10.

## Architecture and contracts

Rules use only domain models. Rule evaluation order and findings are deterministic. A failing rule is
isolated when model integrity remains valid. A rule explains its limitations.

## Milestone tasks

### M04-T01 — Define contracts

Implement metadata, context, result, finding, category, severity, reference, confidence/limitations,
and execution errors.

### M04-T02 — Implement engine

Create explicit registry, configuration filters, deterministic loader, isolated evaluator, counters, and
error aggregation.

### M04-T03 — Accessibility rules

Implement A11Y-001 through A11Y-003 with comprehensive fixtures.

### M04-T04 — SEO, performance, and UX rules

Implement required stable rules from the catalog. Keep advisory wording conservative.

### M04-T05 — Validate catalog behavior

Verify zero/one/multiple findings, rule failure isolation, deterministic order, filtering, metadata,
traceability, and expected limitations.

## Validation and acceptance

Each stable rule must pass positive, negative, and boundary/unsupported cases. Execute the full
catalog twice on the same model and compare stable results.

## Evidence to retain

Rule-by-rule test matrix, expected/actual finding samples, deterministic comparison, isolated failure
scenario, limitations, tests, and coverage.

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

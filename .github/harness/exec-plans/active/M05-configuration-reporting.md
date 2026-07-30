# M05 ExecPlan — Configuration and reporting

## Purpose and observable outcome

A user can configure enabled rules/categories and output behavior. UXAudit presents one normalized
audit result through terminal, deterministic JSON, and escaped standalone HTML reports.

## Prerequisites

M04 is complete. Read product CLI behavior, persistence, reporter architecture, security HTML
controls, and M05 acceptance criteria.

## Scope

- configuration defaults, loading, validation, and CLI precedence;
- complete `AuditResult`;
- terminal reporter;
- JSON reporter and versioned schema;
- standalone HTML reporter;
- safe output paths and write errors;
- cross-reporter consistency.

## Out of scope

- hosted dashboards;
- external assets required at report-view time;
- database storage;
- rerunning rules separately per reporter.

## Requirements and traceability

RF-13 through RF-15, RNF-04 through RNF-06, RNF-09, RNF-10.

## Architecture and contracts

Reporters receive exactly one `AuditResult`. Configuration is parsed at a boundary and passed as typed
data. Project-controlled strings are escaped in HTML.

## Milestone tasks

### M05-T01 — Define configuration and result

Define defaults, overrides, validation errors, audit counters, findings, processing errors, summary,
and version metadata.

### M05-T02 — Implement configuration

Load local JSON, validate unknown/invalid fields, merge CLI precedence, and document defaults.

### M05-T03 — Implement terminal reporter

Provide concise summary and readable findings with no-color support and stable order.

### M05-T04 — Implement JSON reporter

Serialize complete stable data, document schema/version, and test repeated output.

### M05-T05 — Implement HTML reporter

Create one standalone readable file, escape hostile strings, show summary and grouped findings, and
test write failures.

## Validation and acceptance

Feed the same prepared `AuditResult` to all reporters and verify identity of essential data. Execute
hostile-string tests and deterministic JSON/HTML tests.

## Evidence to retain

Configuration matrix, terminal capture, JSON and HTML samples, consistency comparison, XSS test,
write-failure test, tests and coverage.

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

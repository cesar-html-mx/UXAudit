# Decision Log

## D-001 — Local command-line product

UXAudit will be a local CLI. A server, account system, database, and hosted UI are outside the initial
scope.

## D-002 — Static analysis boundary

The initial version analyzes source code without executing the target application. Dynamic usability,
browser behavior, runtime performance, and complete rendered-page SEO remain explicit limitations.

## D-003 — React and TypeScript focus

The initial ecosystem is React with TypeScript, while `.js` and `.jsx` remain accepted for mixed
projects. Other frameworks require a future parser/model adapter decision.

## D-004 — Normalized analysis model

Babel AST structures remain inside the parsing boundary. Rules consume UXAudit domain models so
that the rule catalog is not coupled directly to parser internals.

## D-005 — File-based persistence

Configuration and outputs use local JSON, HTML, and optional log files. Transient analysis state stays
in memory. No database is required.

## D-006 — Independent rules and reporters

Rules are independently executable and return normalized findings. Reporters consume one
`AuditResult` and do not rerun analysis.

## D-007 — Incremental delivery

The project follows the six increments already defined in the TFM. Each milestone must leave a
verifiable working capability.

## D-008 — Agent harness location

The root `AGENTS.md` is the entry point. Orchestration lives under `.github/harness`, reusable Codex
skills under `.agents/skills`, and durable product knowledge under `docs/`.

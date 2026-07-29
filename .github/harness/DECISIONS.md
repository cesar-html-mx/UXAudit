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

## D-009 — Node.js 24 and current compatible toolchain

- Date: 2026-07-29
- Status: accepted
- Context: The owner explicitly requested a clean M01 restart using Node.js 24 and the best current
  stable industry tooling. Node.js 20 is end-of-life, while Node.js 24 is the current LTS line.
- Decision: Require Node.js `>=24` and npm `>=11.16.0`, pin local development to Node.js `24.18.0`,
  compile ESM for ES2024, and pin direct dependencies exactly. Use the latest stable package version
  only when its declared engine and peer contracts are satisfied.
- Alternatives considered: Retaining Node.js 20 compatibility; using the shell-default Node.js 22;
  or forcing TypeScript 7 despite TypeScript ESLint's `<6.1.0` peer range.
- Consequences: The project intentionally drops Node.js 20/22 support. TypeScript remains on 6.0.3
  until stable TypeScript ESLint supports 7. npm install scripts are explicitly reviewed and pinned.
- Requirements/contracts affected: RNF-03, RNF-09, and the M01 runtime contract.
- Evidence: `.nvmrc`, `.npmrc`, `package.json`, `package-lock.json`, registry metadata, and passing
  Node.js 24 typecheck/build commands.

## D-010 — Unified strict quality gate

- Date: 2026-07-29
- Status: accepted
- Context: M01 needs one reproducible developer and CI gate while keeping each underlying check
  independently runnable and diagnosable.
- Decision: Use ESLint 10 flat configuration with typed strict/stylistic rules, Prettier as the
  repository formatter, Vitest with V8 coverage and 90% global thresholds, strict TypeScript
  compiler checks, and Husky 9 to invoke `npm run verify` before commits. Treat warnings as
  failures and enforce npm engine, exact-version, peer-dependency, and install-script policies.
- Alternatives considered: Legacy `.eslintrc`; untyped linting; floating dependency ranges; forcing
  incompatible peer versions; or duplicating gate commands inside the Git hook.
- Consequences: Local commits perform the same product gate later used by CI. The minimal
  process-boundary entry point is excluded from unit coverage and must be exercised by portable
  smoke tests in M01-T05.
- Requirements/contracts affected: RNF-03, RNF-09, and M01 quality acceptance.
- Evidence: `eslint.config.mjs`, `vitest.config.ts`, `.prettierrc.json`, `.husky/pre-commit`,
  `tests/product.test.ts`, and passing Node.js 24 `npm run verify`/coverage output.

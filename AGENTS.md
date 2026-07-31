# UXAudit Contributor Guide

## Mission

Build UXAudit as a production-quality local CLI for static analysis of React, JavaScript, and
TypeScript projects. The product discovers relevant source files, parses JSX/TSX, constructs an
internal analysis model, executes independent UX, accessibility, SEO, and performance rules, and
generates terminal, JSON, and HTML reports.

This repository is the source of truth for product behavior.

## Before changing files

Read:

1. `README.md` and the appropriate language-specific README.
2. `docs/00_INDEX.md`.
3. The product specification, architecture, engineering, testing, and security documents relevant to
   the change.
4. The nearest nested `AGENTS.md` for the directory being changed.

Inspect the current implementation and tests before assuming work is missing.

When `.github/harness/state/state.json` exists with `status: ready`, also read the harness
configuration, state, generated current-state document, active ExecPlan, and every document linked
by that plan. Follow `.github/harness/EXECUTION_PROTOCOL.md` for the active milestone. On the M07/M08
continuation branches, M01-M06, `harness-complete-v1`, the public v0.1.0 baseline, and the existing
external demo are immutable historical safeguards.

## Development workflow

1. Make the smallest reversible change that satisfies the documented product contract.
2. Keep public behavior covered by focused tests.
3. Run the focused checks for the changed area.
4. Run the complete quality gate before merging:

   ```bash
   npm run verify
   ```

5. Update public documentation in English and neutral Latin American Spanish in the same change.
6. Use conventional commits, for example:

   ```text
   feat(discovery): add excluded-directory traversal
   ```

Do not weaken tests, quality gates, or security boundaries to make a change pass.

## Product boundaries

- Local CLI first.
- Static analysis only.
- React, JavaScript, and TypeScript ecosystem; `.ts`, `.tsx`, `.js`, and `.jsx`.
- No database, telemetry, or production network dependency.
- No automatic modification of analyzed source code.
- Rule failures are isolated when safe.
- Rules consume the UXAudit analysis model, not Babel AST nodes directly.
- Reporters consume one normalized `AuditResult`.
- Generated HTML escapes untrusted project content.
- File traversal prevents symlink loops and path escape.

Changing these boundaries or a published contract requires explicit maintainer approval.

## Engineering rules

- TypeScript strict mode; avoid `any`.
- Prefer arrow functions.
- Prefer `async`/`await` over direct promise chains.
- Use ESM.
- Keep modules focused and contracts explicit.
- Validate data at boundaries.
- Do not invoke a shell for core product behavior.
- Use deterministic ordering for files, rules, findings, and reports.
- Preserve user data and existing project files.

## Verification

Relevant changes should pass formatting, bilingual-document validation, lint, typecheck, tests, and
build. Add integration, smoke, security, or system validation when the affected boundary warrants it.
Coverage supports review but does not replace meaningful assertions.

## Source-of-truth precedence

When sources conflict, use this order:

1. This file and nested `AGENTS.md` files.
2. Public product contracts and architecture in `docs/`.
3. Existing tested behavior.
4. Other repository notes.

Do not silently reconcile a conflict. Document it and use the higher-precedence source.

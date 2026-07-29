# UXAudit Agent Harness

## Mission

Build UXAudit as a production-quality, local CLI for static analysis of React and TypeScript projects.
The tool must discover relevant source files, parse JSX/TSX, construct an internal analysis model,
execute independent rules for UX, accessibility, SEO, and performance, and generate terminal, JSON,
and HTML reports.

This repository is the system of record. Do not rely on prior chat history.

## Required reading order

Before changing any file, read:

1. `.github/harness/HARNESS_CONFIG.yml`
2. `.github/harness/state/state.json`
3. `.github/harness/CURRENT_STATE.md`
4. `docs/00_INDEX.md`
5. The active ExecPlan under `.github/harness/exec-plans/active/`
6. Any document linked by that ExecPlan
7. The nearest nested `AGENTS.md` for the directory being changed

Run:

```bash
node .github/harness/scripts/validate-harness.mjs
node .github/harness/scripts/show-status.mjs
```

Resolve harness integrity failures before product work.

## Execution protocol

The default run mode is one complete milestone per Codex session.

When told to execute the harness:

1. Load the required sources above.
2. Confirm the active milestone and task from `state.json`.
3. Inspect the current repository; never assume a task is incomplete only because the state says so.
4. Update the active ExecPlan with discoveries before implementation.
5. Implement every remaining task in the active milestone in dependency order.
6. After each task:
   - run the task-level checks;
   - update the ExecPlan, traceability, decisions, risks, and session log;
   - create a conventional commit;
   - push the milestone branch when a remote and credentials are available.
7. After all tasks:
   - run the full milestone quality gate;
   - collect evidence under `evidence/`;
   - update all required documentation;
   - perform a self-review against the acceptance criteria;
   - close and advance the milestone with the harness script;
   - push the final milestone state and create a pull request when possible.
8. Stop after the milestone report. A new chat can continue from the repository state by using the same instruction.

Do not ask for “next steps” during a milestone. Continue autonomously until the milestone passes or a real blocker is reached.

## Allowed autonomous decisions

Choose the smallest reversible solution that satisfies the documented contracts.
Record meaningful decisions in `.github/harness/DECISIONS.md`.

You may:

- add development dependencies already authorized by `docs/05_ENGINEERING_STANDARDS.md`;
- refactor within the active milestone when behavior remains covered by tests;
- improve documentation and tests;
- repair harness drift before continuing.

You must stop and record a blocker before:

- expanding beyond static analysis, React, or TypeScript;
- changing a public contract used by completed milestones;
- adding a production service, database, telemetry, or network dependency;
- modifying analyzed source code automatically;
- weakening a quality gate;
- deleting user data or rewriting published Git history;
- introducing a production dependency not already approved.

## Non-negotiable product boundaries

- Local CLI first.
- Static analysis only.
- React and TypeScript ecosystem; `.ts`, `.tsx`, `.js`, and `.jsx`.
- No database in the initial version.
- No automatic source-code modification.
- Rule failures should be isolated when safe.
- Rules consume the UXAudit analysis model, not Babel AST nodes directly.
- Reporters consume one normalized `AuditResult`.
- Generated HTML must escape untrusted project content.
- File traversal must prevent symlink loops and path-escape behavior.

## Engineering rules

- TypeScript strict mode; avoid `any`.
- Prefer arrow functions.
- Prefer `async`/`await` over direct promise chains.
- Use ESM.
- Keep modules focused and contracts explicit.
- Validate data at boundaries.
- Do not invoke a shell to perform core product behavior.
- Use deterministic ordering for files, rules, findings, and reports.
- Public behavior requires tests and documentation.
- Use conventional commits, for example: `feat(discovery-0201): add excluded-directory traversal`.

## Quality gates

A milestone is complete only when:

- its acceptance criteria pass;
- build, typecheck, lint, formatting, and tests pass when available;
- no required test is skipped;
- documentation and traceability are current;
- evidence is stored;
- the working tree is clean after the milestone commit.

Coverage is evidence, not a substitute for meaningful assertions.

## Source-of-truth precedence

When sources conflict, use this order:

1. `AGENTS.md` and nested overrides
2. Active ExecPlan
3. `state.json` and harness configuration
4. Product requirements and architecture in `docs/`
5. Existing tested behavior
6. Other repository notes

Do not silently reconcile a conflict. Record it and use the higher-precedence source.

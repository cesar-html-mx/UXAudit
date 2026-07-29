# UXAudit

UXAudit is a planned command-line static-analysis tool for React and TypeScript projects. It will
identify selected UX, accessibility, SEO, and performance findings and produce terminal, JSON, and
HTML reports.

This repository starts with an agent execution harness. Codex can build the application milestone by
milestone while the repository retains the complete state, plans, evidence, and decisions.

## Start

1. Extract these files into the root of an empty Git repository.
2. Configure the GitHub remote and authenticate `git`/`gh`.
3. Open the repository root in VS Code with Codex.
4. Use this instruction:

> Ejecuta el harness definido en AGENTS.md y completa el hito activo de principio a fin.

Codex will read the active state, implement the current milestone, verify it, document it, commit it,
push it when possible, and stop at the milestone boundary. Start a new chat with the same instruction
for the next milestone.

## Initial harness checks

```bash
node .github/harness/scripts/validate-harness.mjs
node .github/harness/scripts/show-status.mjs
```

## Repository map

- `AGENTS.md`: concise entry point and execution contract.
- `.github/harness/`: orchestration, state, plans, scripts, and templates.
- `.agents/skills/`: reusable Codex workflows.
- `docs/`: product and engineering system of record.
- `evidence/`: test, security, usability, and TFM evidence.
- `.github/workflows/`: continuous verification.

The initial active milestone is **M01 — Repository bootstrap and CLI foundation**.

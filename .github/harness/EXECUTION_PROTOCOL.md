# Execution Protocol

## Session boundary

A session completes exactly one milestone by default. All tasks inside that milestone are executed
without requesting another prompt. At the end, repository state is sufficient for a fresh chat to
continue without prior conversation context.

## Start sequence

1. Validate the harness.
2. Read `state/state.json`.
3. Inspect Git status, branch, remote, tool versions, and existing product files.
4. Reconcile state with tested reality.
5. Read and update the active ExecPlan.
6. Create or switch to the milestone branch.
7. Begin the first incomplete task.

## Task loop

For each task:

1. Restate the task objective inside the ExecPlan.
2. Identify requirements, contracts, tests, and evidence affected.
3. Implement the smallest complete vertical change.
4. Run focused checks.
5. Review the diff for unrelated changes, security issues, and contract drift.
6. Update documentation, traceability, evidence, risks, and progress.
7. Commit using the task ID in the scope.
8. Push when configured and possible.
9. Continue to the next task automatically.

## Milestone closure

1. Run all quality scripts.
2. Run the milestone-specific acceptance scenario.
3. Confirm no required tests are skipped.
4. Confirm requirements and evidence are traceable.
5. Review architecture conformance and security boundaries.
6. Update the ExecPlan's progress, decisions, discoveries, and outcomes.
7. Run `advance-milestone.mjs`.
8. Commit and push the state transition.
9. Create a pull request if `gh` is available.
10. Produce a concise milestone report and stop.

## Blocker protocol

A blocker must be written to `BLOCKERS.md` and `state/state.json` with:

- the exact blocked task;
- observed behavior;
- commands and outputs;
- why autonomous resolution is unsafe;
- available options;
- recommended option;
- whether completed work is committed and pushed.

Missing GitHub credentials do not invalidate completed product work. Commit locally, record the push
failure, and finish the milestone report without pretending that the push succeeded.

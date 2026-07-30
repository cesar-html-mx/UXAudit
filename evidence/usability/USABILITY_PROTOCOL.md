# UXAudit Usability Protocol

## Participant profile

Frontend developers or students familiar with basic React/TypeScript and terminal use. Record actual
experience level without collecting unnecessary personal data.

## Tasks

1. Find how to execute a scan.
2. Analyze the provided controlled project.
3. Identify the highest-severity finding.
4. Locate the related source file and line.
5. Explain the finding and proposed correction.
6. Locate and open the JSON and HTML reports.

## Measures

- task completion;
- time;
- errors;
- backtracking;
- help requested;
- comments and confusion;
- post-task satisfaction;
- SUS only with real responses.

## Ethics and truthfulness

Participation is voluntary. Do not identify participants in the repository. If no participant test is
performed, label the work as heuristic review, not user testing.

## M06 expert-review execution

No participant observations or responses are available for M06. The executed substitute is an
expert heuristic review over the six tasks above, versioned in
`fixtures/m06-validation/heuristic-review.json` and reproduced by
`npm run test:usability:m06`.

The runner invokes the compiled CLI without a shell and records, per task:

- completion;
- wall-clock duration of the scripted expert-review procedure;
- procedure errors and backtracking;
- whether CLI help was used;
- the reviewed observation, severity, and corrective action.

Those durations are not participant task times. Zero procedure errors, zero backtracking, and help
usage describe the executed review script only; they must not be generalized to users.

When `--output <directory>` is supplied directly to `scripts/run-m06-usability.mjs`, it writes
`heuristic-review.json`, `usability-status.json`, and `heuristic-review.csv`. The first two are the
machine-readable inputs expected by the final M06 evidence collector.

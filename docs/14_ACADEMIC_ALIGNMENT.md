[Español](es/14_ACADEMIC_ALIGNMENT.md) | **English**

# Academic Alignment for Activity 3

The testing delivery must be based on executed evidence from the real UXAudit implementation.

## Expected content

1. Test objectives and environment.
2. Unit testing:
   - selected units;
   - inputs and expected results;
   - tools and justification;
   - executed results.
3. Integration testing:
   - component boundaries;
   - interactions and data contracts;
   - executed results.
4. System/end-to-end testing:
   - complete CLI flow;
   - normal and error scenarios;
   - controlled projects.
5. Validation:
   - expected versus obtained findings;
   - true/false positives and false negatives;
   - limitations.
6. Usability:
   - defined developer tasks;
   - time, error, and backtracking observations;
   - heuristic review and/or SUS with real participants.
7. Security:
   - actual local-CLI threat model;
   - hostile project input;
   - path, symlink, output, dependency, and HTML safety.
8. Corrective actions and remaining work.

## Required evidence

- test command outputs;
- tool and environment versions;
- coverage summary with interpretation;
- expected and actual fixture results;
- terminal, JSON, and HTML report samples;
- security checklist and observed results;
- usability protocol and raw/aggregated responses;
- list of defects found and corrections;
- honest list of unexecuted or unsupported tests.

Plans must not be reported as completed tests.

## M06-T03 executed validation evidence

The validation runner executes the built CLI against reviewed committed projects, maps observed
finding locations to explicit ground-truth instances, and retains JSON/CSV per-rule confusion
matrices. The current corpus contains 11 positive, eight negative, and eight unsupported instances.
Observed supported outcomes were 11 TP, zero FP, eight TN, and zero FN; unsupported detections were
zero. Precision and recall are reported per rule and explicitly bounded to this synthetic corpus.

## M06-T04 executed system, robustness, performance, and security evidence

The shell-free robustness runner exercised 15 built-CLI cases on Linux and all passed. The executed
set includes normal and invalid roots/configuration, a missing scan argument, real project/output
permission denial, output escape and overwrite protection, malformed-source isolation, a source
below 32 nested directories, three created-and-excluded symbolic links, non-execution sentinels,
structural HTML escaping/CSP inspection, and deterministic fresh-root reruns.

Performance evidence consists of five complete scans over the generated 240-file project. It records
each elapsed sample, minimum/median/maximum summaries, and the maximum child `VmRSS` observed by
5 ms Linux `/proc` sampling without defining a machine-dependent acceptance threshold. The sampled
memory value is not claimed as an exact lifetime peak. The moderate-threshold npm audit reported zero
vulnerabilities. Hosted CodeQL remains explicitly unexecuted because no hosted result was retrieved;
inspection of its workflow is not represented as an executed analysis.

## M06-T05 executed usability substitute and limits

No participant session or SUS questionnaire was executed. The repository truthfully records
participant testing as unexecuted, participant count as zero, SUS as not applicable, response count
as zero, and score as null.

The available substitute is an expert heuristic review with six versioned tasks. Its shell-free
runner uses the compiled CLI to inspect command discovery, complete audit execution, severity
prioritization, source location, recommendation guidance, and generated JSON/HTML paths. Per-task
records include completion, actual scripted-procedure duration, procedure errors, backtracking,
help use, observation, severity, and corrective action. The timings and interaction counts are not
participant measurements.

All six controlled procedures completed. The review records one low-severity prioritization
observation about tied high-severity findings and no medium/high observation. These results support
an expert inspection of the current local CLI; they do not establish user satisfaction, learnability
across a population, or a SUS score.

## M06-T05 Activity 3 evidence package

The isolated Activity 3 package retains the exact environment/source digest, raw commands,
machine-readable test and coverage totals, expected and actual controlled-project results, terminal/
JSON/HTML samples, per-rule ground truth and confusion matrices, robustness/security observations,
five performance measurements, expert-review JSON/CSV, defects and corrections, explicit
unsupported/unexecuted statuses, and factual implementation/testing summaries.

The definitive run passed 619 tests across 56 files with zero failed/skipped/todo, all coverage
thresholds, 11 compiled smokes, five controlled projects, 11 TP/0 FP/8 TN/0 FN on the reviewed
corpus, 15 robustness cases, five 240-file performance runs, six expert tasks, and zero dependency
vulnerabilities. A second isolated execution matched the stable results and preserved the first
42-artifact base package. Its source digest is
`sha256:92bd1c57cf85126082270c9111b03cd00fe28491d77a8c9cba7aa0b4d8ad404b`.

The package does not convert unexecuted participant testing, SUS, hosted CodeQL/CI, browser-runtime
behavior, or remote publication into completed evidence. The milestone report is added only by the
separate finalizer after task completion and self-review. Finalization passed, and the resulting
SHA-256 manifest covers the 42 base artifacts plus `MILESTONE_REPORT.md`.

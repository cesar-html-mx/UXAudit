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

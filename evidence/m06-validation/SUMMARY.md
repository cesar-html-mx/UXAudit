# M06 End-to-end Validation Evidence

- Evidence ID: M06-VALIDATION
- Observed at: 2026-07-30T08:09:32.690Z
- Source: branch `milestone/m06-integration-validation`, base commit `709ddc5fde5059e3e3ae728bc46ad048389e4a78`, plus the M06-T05 working tree
- Source tree: `sha256:92bd1c57cf85126082270c9111b03cd00fe28491d77a8c9cba7aa0b4d8ad404b`
- Integrity: SHA-256 manifest in `MANIFEST.sha256`
- Environment: Node.js `v24.18.0`, npm `11.16.0`, `linux`/`x64`
- Objective: verify the complete local CLI, controlled expected results, per-rule detection behavior, robustness, security, performance, usability, and Activity 3 records
- Expected result: every executable gate passes; no required test is skipped or todo; stable scenario, accuracy, security, and usability projections reproduce; unsupported or unexecuted work remains explicit

## Executed checks

| Check                                              | Exit | Status | Raw record                                               |
| -------------------------------------------------- | ---: | ------ | -------------------------------------------------------- |
| Locked clean installation                          |    0 | PASS   | [raw/npm-ci.txt](raw/npm-ci.txt)                         |
| Product quality gate                               |    0 | PASS   | [raw/verify.txt](raw/verify.txt)                         |
| Coverage thresholds                                |    0 | PASS   | [raw/coverage.txt](raw/coverage.txt)                     |
| No skipped or todo tests                           |    0 | PASS   | [raw/test-results.txt](raw/test-results.txt)             |
| Compiled CLI smoke tests                           |    0 | PASS   | [raw/cli-smoke.txt](raw/cli-smoke.txt)                   |
| Controlled M06 end-to-end scenario                 |    0 | PASS   | [raw/m06-scenario.txt](raw/m06-scenario.txt)             |
| M06 per-rule accuracy scenario                     |    0 | PASS   | [raw/m06-accuracy.txt](raw/m06-accuracy.txt)             |
| M06 robustness, security, and performance scenario |    0 | PASS   | [raw/m06-robustness.txt](raw/m06-robustness.txt)         |
| M06 expert heuristic usability review              |    0 | PASS   | [raw/m06-usability.txt](raw/m06-usability.txt)           |
| Harness integrity                                  |    0 | PASS   | [raw/harness-validation.txt](raw/harness-validation.txt) |
| Dependency audit                                   |    0 | PASS   | [raw/npm-audit.json.txt](raw/npm-audit.json.txt)         |

## Measurements and validation

- Tests: 619 passed across 56 files; zero skipped or todo tests.
- Coverage: statements 95.84%, branches 91.5%, functions 99.82%, lines 95.79%.
- Controlled projects: 5 complete built-CLI projects with deterministic stable projections.
- Accuracy: 8 stable rules; 11 TP, 0 FP, 8 TN, 0 FN, and 8 unsupported observations outside denominators.
- Robustness/security: 15 cases, zero failed cases, structural hostile-HTML/CSP checks, explicit CodeQL status, and target-code non-execution.
- Performance: 5 complete built-CLI runs over 240 files; descriptive elapsed and memory observations with no machine-dependent pass threshold.
- Usability: 6 protocol tasks completed through an expert heuristic review; participant testing was not executed and SUS is not applicable.
- Dependency audit: 0 known vulnerabilities; moderate 0, high 0, critical 0.

## Conclusion

PASS. UXAudit completed the local static-analysis flow across controlled normal, invalid, mixed,
hostile, and generated-large projects. Retained evidence distinguishes executed checks from
unsupported runtime behavior, unavailable participant/SUS data, and unexecuted hosted CodeQL. The
isolated child environment uses an explicit allowlist and inherits no credential variables.

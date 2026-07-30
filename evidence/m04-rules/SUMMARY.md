# M04 Rule Engine Evidence

- Evidence ID: M04-RULES
- Observed at: 2026-07-29T23:59:04.419Z
- Source: branch `milestone/m04-rule-engine-catalog`, base commit `a426e7920bf81b7088cc96bdaac59ed2a96f5020`, plus the M04-T05 working tree
- Source tree: `sha256:2db86840585dfc1622c0abcad7ff00fea1bccdcd895b291b5d3c6b482f9edfb2`
- Integrity: SHA-256 manifest in `MANIFEST.sha256`
- Environment: Node.js `v24.18.0`, npm `11.16.0`, `linux`/`x64`
- Objective: verify the complete eight-rule catalog, normalized findings, deterministic ordering, category/rule filters, metadata and limitations, and safe rule-failure isolation
- Expected result: every gate passes; each stable rule emits one reviewed finding; repeated normalized results are byte-identical; one thrown rule does not discard sibling findings

## Executed checks

| Check                                | Exit | Status | Raw record                                               |
| ------------------------------------ | ---: | ------ | -------------------------------------------------------- |
| Locked clean installation            |    0 | PASS   | [raw/npm-ci.txt](raw/npm-ci.txt)                         |
| Product quality gate                 |    0 | PASS   | [raw/verify.txt](raw/verify.txt)                         |
| Coverage thresholds                  |    0 | PASS   | [raw/coverage.txt](raw/coverage.txt)                     |
| No skipped or todo tests             |    0 | PASS   | [raw/test-results.txt](raw/test-results.txt)             |
| Compiled CLI smoke tests             |    0 | PASS   | [raw/cli-smoke.txt](raw/cli-smoke.txt)                   |
| Controlled M04 rule catalog scenario |    0 | PASS   | [raw/m04-scenario.txt](raw/m04-scenario.txt)             |
| Harness integrity                    |    0 | PASS   | [raw/harness-validation.txt](raw/harness-validation.txt) |
| Dependency audit                     |    0 | PASS   | [raw/npm-audit.json.txt](raw/npm-audit.json.txt)         |

## Measurements

- Tests: 344 passed across 38 files; zero skipped or todo tests.
- Coverage: statements 97.14%, branches 92.79%, functions 99.7%, lines 97.14%.
- Dependency audit: 0 known vulnerabilities; moderate 0, high 0, critical 0.
- Catalog: 8 stable rules enabled and executed across accessibility, performance, SEO, and UX; exactly 8 reviewed findings, one per rule.
- Determinism: PASS; both normalized scenario runs have digest `sha256:addd44ef69132d3f2954274444cf622657f0e51ed466ec260b0a409553ec73a6` and match the reviewed expectation.
- Filters and metadata: PASS; default, category, rule-ID, intersection, empty, and unknown-ID behavior validated with complete developer-facing metadata.
- Rule isolation: PASS; one controlled thrown rule produced one stable recoverable error while all eight safe findings were preserved.
- Limitations: PASS; every stable rule retains one or more explicit static-analysis limitations.
- Controlled analysis: 1 source file parsed, 0 parser failures, 2 components, and 25 JSX nodes. Target project code executed: no.

## Conclusion

PASS. M04 loads and evaluates the explicit stable catalog over the normalized analysis model,
returns one complete and canonically ordered finding for each controlled violation, preserves
source locations and rule guidance, and reproduces the reviewed result byte for byte. Validated
filters select only their documented intersection, and a thrown rule remains isolated from safe
sibling findings. The isolated child environment uses an explicit allowlist and does not inherit
credential variables.

## Current limitation

The controlled scenario validates the documented static scope rather than rendered runtime
behavior. Dynamic JSX, custom component abstractions, external CSS, routes, viewport priority, and
complete accessible-name context remain conservative non-findings or explicit advisory limits.

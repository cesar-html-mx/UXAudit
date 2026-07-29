# M03 Parsing Evidence

- Evidence ID: M03-PARSING
- Observed at: 2026-07-29T21:17:43.463Z
- Source: branch `milestone/m03-parser-analysis-model`, base commit `3a1c5fb58b997a561c418c3a053fc9e4f80c0854`, plus the M03-T05 working tree
- Source tree: `sha256:e6f315a35a130dc394009ada75cf9658bfd6bcaefa66c772e1b9183c62190b40`
- Integrity: SHA-256 manifest in `MANIFEST.sha256`
- Environment: Node.js `v24.18.0`, npm `11.16.0`, `linux`/`x64`
- Objective: verify bounded source reads, the Babel parser/extractor boundary, normalized model construction, error isolation, deterministic output, and target-code non-execution
- Expected result: every gate passes; reviewed expected/actual analysis matches; malformed syntax remains local; repeated normalized runs are byte-identical

## Executed checks

| Check                                | Exit | Status | Raw record                                                         |
| ------------------------------------ | ---: | ------ | ------------------------------------------------------------------ |
| Locked clean installation            |    0 | PASS   | [raw/npm-ci.txt](raw/npm-ci.txt)                                   |
| Product quality gate                 |    0 | PASS   | [raw/verify.txt](raw/verify.txt)                                   |
| Coverage thresholds                  |    0 | PASS   | [raw/coverage.txt](raw/coverage.txt)                               |
| No skipped or todo tests             |    0 | PASS   | [raw/test-results.txt](raw/test-results.txt)                       |
| Compiled CLI smoke tests             |    0 | PASS   | [raw/cli-smoke.txt](raw/cli-smoke.txt)                             |
| Controlled M03 parser/model scenario |    0 | PASS   | [raw/m03-scenario.txt](raw/m03-scenario.txt)                       |
| Harness integrity                    |    0 | PASS   | [raw/harness-validation.txt](raw/harness-validation.txt)           |
| Dependency audit                     |    0 | PASS   | [raw/npm-audit.json.txt](raw/npm-audit.json.txt)                   |
| Direct locked Babel dependencies     |    0 | PASS   | [raw/babel-dependencies.json.txt](raw/babel-dependencies.json.txt) |

## Measurements

- Tests: 208 passed across 21 files; zero skipped or todo tests.
- Coverage: statements 97.63%, branches 91.86%, functions 100%, lines 97.59%.
- Dependency audit: 0 known vulnerabilities; moderate 0, high 0, critical 0.
- Direct parser dependencies: `@babel/parser`, `@babel/traverse`, and `@babel/types` are installed directly at exact version `8.0.4`.
- Controlled parsing: 7 files parsed, 1 malformed file isolated, 7 components, and 15 JSX nodes.
- Syntax matrix: JavaScript, JavaScript with JSX, TypeScript, and TypeScript with JSX.
- Determinism: PASS; both normalized scenario runs have digest `sha256:48501cab384bb28885899c3646ddc4521470c777339ff15c951cc2789d1b3225` and match the reviewed expectation.
- Source locations retained: yes. Target project code executed: no.
- Performance and process-memory observations: retained in `scenario/performance-baseline.json` as informational measurements without a machine-dependent threshold.

## Conclusion

PASS. M03 reauthorizes and reads bounded source candidates, parses the four supported source kinds
without importing target modules, projects Babel data into the UXAudit-owned model, preserves
locations and deterministic relationships, and safely continues after the controlled malformed
file. The isolated child environment uses an explicit allowlist and does not inherit credential
variables.

## Current limitation

Portable filesystem APIs reduce but cannot eliminate the final path-replacement race. Component
recognition and retained dynamic values remain deliberately syntactic and conservative; M04 rules
must consume the normalized confidence-bearing model rather than infer runtime behavior.

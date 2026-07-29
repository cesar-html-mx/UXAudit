# M02 Discovery Evidence

- Evidence ID: M02-DISCOVERY
- Observed at: 2026-07-29T17:50:33.207Z
- Source: branch `milestone/m02-discovery-inventory`, base commit `0ac527d2cc33d61d5b1ad03cba634ade7d990e9e`, plus the M02-T05 working tree
- Source tree: `sha256:1ba06a093bc930e68894f198666723916362cd041e7b520d169d0dce7290bda4`
- Integrity: SHA-256 manifest in `MANIFEST.sha256`
- Environment: Node.js `v24.18.0`, npm `11.16.0`, `linux`/`x64`
- Objective: verify safe deterministic discovery, inventory, classification, and CLI integration
- Expected result: every gate passes; reviewed expected/actual inventory matches; repeated runs are byte-identical

## Executed checks

| Check                             | Exit | Status | Raw record                                               |
| --------------------------------- | ---: | ------ | -------------------------------------------------------- |
| Locked clean installation         |    0 | PASS   | [raw/npm-ci.txt](raw/npm-ci.txt)                         |
| Product quality gate              |    0 | PASS   | [raw/verify.txt](raw/verify.txt)                         |
| Coverage thresholds               |    0 | PASS   | [raw/coverage.txt](raw/coverage.txt)                     |
| No skipped or todo tests          |    0 | PASS   | [raw/test-results.txt](raw/test-results.txt)             |
| Compiled CLI smoke tests          |    0 | PASS   | [raw/cli-smoke.txt](raw/cli-smoke.txt)                   |
| Controlled M02 discovery scenario |    0 | PASS   | [raw/m02-scenario.txt](raw/m02-scenario.txt)             |
| Harness integrity                 |    0 | PASS   | [raw/harness-validation.txt](raw/harness-validation.txt) |
| Dependency audit                  |    0 | PASS   | [raw/npm-audit.json.txt](raw/npm-audit.json.txt)         |

## Measurements

- Tests: 66 passed across 9 files; zero skipped or todo tests.
- Coverage: statements 99.64%, branches 94.15%, functions 100%, lines 99.64%.
- Dependency audit: 0 known vulnerabilities reported by npm.
- Controlled inventory: 10 canonical entries, five source candidates, no duplicates, and stable expected/actual output.
- Exclusions: dependency/generated/configuration names plus default and opt-in symbolic-link behavior.
- Determinism: PASS; both normalized scenario runs have digest `sha256:4fc55e4c5f79c04e8a1c4ce623dbc2d84f743d42548b887002759422df89ad44`.
- Target project code executed: no.

## Conclusion

PASS. M02 recursively discovers controlled project trees, enforces canonical containment and
documented symlink policy, retains a normalized deduplicated inventory, classifies only supported
source candidates, exposes a stable CLI summary, and reproduces the reviewed scenario byte for
byte. The isolated process environment does not inherit credential variables.

## Current limitation

Discovery and inventory identify candidates only. M03 must revalidate containment when opening each
file, parse supported syntax, isolate malformed files, and build the normalized analysis model.
Distinct hard-link paths remain separate inventory locations by design.

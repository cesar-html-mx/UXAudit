# M01 Bootstrap Evidence

- Evidence ID: M01-BOOTSTRAP
- Observed at: 2026-07-29T15:39:56.660Z
- Source: branch `milestone/m01-bootstrap-cli`, base commit `9e2159be8e56833645a8022eb472bf34c1777963`, plus the M01-T05 working tree
- Source tree: `sha256:d50949dfc022f096c601f8c1042f710b6e4b1a6b4d5de4831aac360e5f97e0b0`
- Integrity: SHA-256 manifest in `MANIFEST.sha256`
- Environment: Node.js `v24.18.0`, npm `11.16.0`, `linux`/`x64`
- Objective: verify the complete M01 CLI foundation from a clean locked installation
- Expected result: every required gate passes; invalid path scenarios return exit 2

## Executed checks

| Check                     | Exit | Status | Raw record                                               |
| ------------------------- | ---: | ------ | -------------------------------------------------------- |
| Locked clean installation |    0 | PASS   | [raw/npm-ci.txt](raw/npm-ci.txt)                         |
| Product quality gate      |    0 | PASS   | [raw/verify.txt](raw/verify.txt)                         |
| Coverage thresholds       |    0 | PASS   | [raw/coverage.txt](raw/coverage.txt)                     |
| Compiled CLI smoke tests  |    0 | PASS   | [raw/cli-smoke.txt](raw/cli-smoke.txt)                   |
| CLI help                  |    0 | PASS   | [raw/cli-help.txt](raw/cli-help.txt)                     |
| Valid project root        |    0 | PASS   | [raw/cli-valid-path.txt](raw/cli-valid-path.txt)         |
| Missing project root      |    2 | PASS   | [raw/cli-missing-path.txt](raw/cli-missing-path.txt)     |
| Regular-file project root |    2 | PASS   | [raw/cli-file-path.txt](raw/cli-file-path.txt)           |
| Harness integrity         |    0 | PASS   | [raw/harness-validation.txt](raw/harness-validation.txt) |
| Dependency audit          |    0 | PASS   | [raw/npm-audit.json.txt](raw/npm-audit.json.txt)         |

## Measurements

- Tests: 31 passed across 4 files.
- Coverage: statements 100%, branches 100%, functions 100%, lines 100%.
- Dependency audit: 0 known vulnerabilities reported by npm.
- Smoke coverage: help, version, valid directory, missing path, regular file, and missing argument.

## Conclusion

PASS. M01 is buildable and testable on Node.js 24, the compiled CLI validates canonical project
roots with stable exit behavior, the harness is internally consistent, and the clean dependency
audit reports no known vulnerabilities. GitHub Actions configuration was inspected locally but was
not executed remotely as part of this evidence run.

## Current limitation

The command validates only the selected root. Recursive discovery, canonical descendant
confinement, parsing, rules, and reports begin in later milestones.

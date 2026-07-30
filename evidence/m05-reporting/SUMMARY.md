# M05 Configuration and Reporting Evidence

- Evidence ID: M05-REPORTING
- Observed at: 2026-07-30T03:48:38.694Z
- Source: branch `milestone/m05-configuration-reporting`, base commit `44195f4e1327b53927adffe965641a2ae9865558`, plus the M05-T05 working tree
- Source tree: `sha256:1755405d825a726b7eecf8ccbbb492131cd29f353a09340292a746e53df2b0a0`
- Integrity: SHA-256 manifest in `MANIFEST.sha256`
- Environment: Node.js `v24.18.0`, npm `11.16.0`, `linux`/`x64`
- Objective: verify configuration defaults/file/CLI precedence and one controlled AuditResult rendered consistently through terminal, exact JSON, and standalone escaped HTML, including safe exclusive report writes
- Expected result: every gate passes; all three reporters consume the same result; repeat renders are byte-identical; HTML passes structural escaping/CSP checks; terminal color strips exactly to no-color output; unsafe or duplicate writes fail without false success claims

## Executed checks

| Check                                               | Exit | Status | Raw record                                               |
| --------------------------------------------------- | ---: | ------ | -------------------------------------------------------- |
| Locked clean installation                           |    0 | PASS   | [raw/npm-ci.txt](raw/npm-ci.txt)                         |
| Product quality gate                                |    0 | PASS   | [raw/verify.txt](raw/verify.txt)                         |
| Coverage thresholds                                 |    0 | PASS   | [raw/coverage.txt](raw/coverage.txt)                     |
| No skipped or todo tests                            |    0 | PASS   | [raw/test-results.txt](raw/test-results.txt)             |
| Compiled CLI smoke tests                            |    0 | PASS   | [raw/cli-smoke.txt](raw/cli-smoke.txt)                   |
| Controlled M05 configuration and reporting scenario |    0 | PASS   | [raw/m05-scenario.txt](raw/m05-scenario.txt)             |
| Harness integrity                                   |    0 | PASS   | [raw/harness-validation.txt](raw/harness-validation.txt) |
| Dependency audit                                    |    0 | PASS   | [raw/npm-audit.json.txt](raw/npm-audit.json.txt)         |

## Measurements

- Tests: 512 passed across 47 files; zero skipped or todo tests.
- Coverage: statements 95.81%, branches 91.39%, functions 99.39%, lines 95.77%.
- Dependency audit: 0 known vulnerabilities; moderate 0, high 0, critical 0.
- Controlled result: 5 findings span all five severity buckets and 5 normalized errors span discovery, read, parse, extract, and rule stages.
- Configuration: PASS; 5 controlled cases cover defaults, a valid partial file, CLI-over-file precedence, explicit empty filters, and stable unknown-key rejection.
- Cross-reporter records: PASS; JSON deep-equals the complete result, while terminal and HTML retain the fields each human format promises, including one-based display coordinates.
- Determinism: PASS; terminal, JSON, and HTML rerenders are byte-identical. The exact JSON digest is `sha256:79fc3de63ae1f8650a9626609a184e94e45d9af0d92d154ab704a8dd1c905ca5`.
- Terminal color: PASS; only reporter-owned ANSI was observed transiently, stripping it matched the retained no-color report, and no raw ANSI is retained.
- HTML security: PASS by structural string assertions and CSP inspection; hostile markup is escaped, external assets/event handlers/scripts are absent, and secondary Unicode controls render as visible escapes.
- Report writes: PASS; exact JSON/HTML content was written to the fixed relative targets, while existing-target, unsafe-path, and controlled write failures returned stable errors without a success claim.

## Conclusion

PASS. M05 validates and merges configuration, renders one normalized result through three
presentation boundaries without reevaluation, and produces exact repeatable JSON, readable
no-color terminal text, and a CSP-constrained standalone HTML document. The shared writer exposes
only successful fixed relative targets and preserves existing content on overwrite attempts. The
isolated child environment uses an explicit allowlist and does not inherit credential variables.

## Current limitation

The HTML security check is structural and does not claim browser execution. M05 exercises reporter
and writer APIs directly over a controlled completed result; the production CLI remains scan-only
until M06 integrates configuration, rule evaluation, result construction, and output orchestration.

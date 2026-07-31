# M07 full quality gate

Command executed on Node.js 24.18.0:

```bash
npm run release:check
```

Result: PASS before the M07 deadline.

The command completed the following gates without skips or todos:

| Gate                    | Observed result                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| Product verification    | formatting, bilingual docs, lint, typecheck, build, 61 files and 654 tests passed                              |
| CLI smoke               | 11 scenarios passed                                                                                            |
| Discovery scenario      | 10 canonical entries, 5 source candidates, deterministic, target not executed                                  |
| Parser scenario         | 7 parsed, 1 isolated malformed file, 7 components, 15 JSX nodes, deterministic, target not executed            |
| Rule scenario           | 8 rules, 8 findings, expected output matched, failure isolated, deterministic, target not executed             |
| Reporting scenario      | 5 configuration cases, 5 findings, 5 errors, cross-reporter consistency and structural HTML safety passed      |
| System scenario         | 5 controlled projects, expected findings/parser errors, deterministic, target not executed                     |
| Accuracy scenario       | 11 positive, 8 negative, 8 unsupported cases; 0 false positives and 0 false negatives in the controlled corpus |
| Robustness              | 15 cases passed; 5 measured runs over 240 files                                                                |
| Expert usability review | 6 scripted tasks completed; participant testing unexecuted and SUS not applicable                              |
| Package consumer        | clean install and installed CLI version 0.1.0 passed                                                           |
| Dependency audit        | 0 vulnerabilities at `moderate` or above                                                                       |

The hosted CodeQL status remains unexecuted locally. This is recorded rather than represented as a
local pass and does not replace the repository's existing hosted workflow.

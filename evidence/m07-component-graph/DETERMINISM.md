# M07 deterministic and non-execution evidence

The project integration analyzes the committed six-file corpus in normal and reversed
`AnalyzedSourceFile` order. It asserts byte-identical normalized model JSON, the same ordered eight
links, the same complete normalized findings, and equality with the reviewed static manifest.

The application audit runs the corpus twice and compares a projection that normalizes only the
absolute project root and timing. Both runs retain two exact findings, eight component links, zero
parser errors, zero rule errors, and no written report.

The built CLI was then run twice with terminal output, color disabled, and verbose summaries. Both
runs exited 0 as documented for completed audits with findings. Standard output and standard error
were byte-identical. The standard-output SHA-256 for each run was
`4a0c5baacc718e9487a604552e3801ea1026fdbb966a08d9763ee5d20bca5514`.

Both CLI outputs contained:

- 2 displayed findings out of 2 total;
- `accessibility/button-name` at `src/components/Button.tsx:2:10`;
- `seo/multiple-h1` at `src/App.tsx:9:5`;
- 0 processing errors.

The fixture's `TARGET_CODE_EXECUTED` sentinel was absent before and after analysis. UXAudit did not
import or execute target modules.

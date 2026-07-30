# Infrastructure and Tooling

## Runtime

UXAudit runs on the Node.js 24 LTS line (`>=24.18.0 <25`) with npm 11 (`>=11.16.0 <12`); M01 pins
Node.js `24.18.0` and npm `11.16.0` for development and CI. It reads project files and writes
selected JSON/HTML reports locally. No backend, container, database, cloud service, or network
connection is required by the product.

## Development

- Visual Studio Code and Codex
- Git and GitHub
- Node.js and npm
- TypeScript
- Commander.js
- Babel parser and traversal
- Vitest
- ESLint and Prettier
- Husky

## Continuous integration

The M01 GitHub Actions configuration verifies:

- harness integrity on Node.js 24;
- dependency installation from the lockfile on Ubuntu 24.04, Windows 2025, and macOS 15;
- format check;
- lint;
- typecheck;
- focused tests;
- coverage generation and thresholds on Linux;
- build;
- the compiled-CLI smoke suite on every matrix platform;
- npm audit with a moderate-severity failure threshold on Linux;
- CodeQL on pushes/pull requests to `main`, weekly schedule, and manual dispatch where GitHub Code
  Security is available;
- Dependency Review for public repositories or private repositories explicitly marked as having
  GitHub Code Security, failing on moderate-or-higher dependency changes.

Workflows use minimum permissions, concurrency cancellation, bounded timeouts, no persisted checkout
credentials, and immutable action SHAs. Dependabot monitors npm and GitHub Actions releases.
Public repositories enable CodeQL and Dependency Review automatically; eligible private
repositories opt in with `CODEQL_ENABLED=true` and `DEPENDENCY_REVIEW_ENABLED=true`.

## Artifacts

Product build:

- `dist/` executable JavaScript and type declarations if published.

Audit outputs:

- terminal summary;
- `audit-report.json`;
- `audit-report.html`;

The product does not currently generate an execution-log format. Raw command logs belong only to
engineering evidence.

Engineering evidence:

- test result summaries;
- coverage summary;
- controlled-project expected/actual comparison;
- security and usability records.

M02 adds a shell-free controlled discovery scenario and an isolated evidence collector:

- `npm run test:scenario:m02` builds UXAudit, creates a temporary mixed project, compares normalized
  expected/actual discovery results, verifies two byte-identical runs, and proves target scripts are
  not executed.
- `npm run evidence:m02` copies the source snapshot without dependencies, retained evidence, Git
  metadata, credential files, or private keys; performs a clean locked install under Node.js 24;
  rejects included symbolic links; asserts the pinned runtime and active M02 state; executes the
  complete M02 gate with an explicit zero-skip/todo record; and atomically retains only sanitized,
  checksummed records under `evidence/m02-discovery/`.
- `npm run evidence:m02:finalize` runs after the milestone report is written and regenerates the
  manifest atomically so the report is covered by the same integrity contract.

M06-T01 expands the shell-free compiled smoke suite to eleven scenarios. It now covers hostile
terminal diagnostics, the integrated
default audit, all three reporters, recoverable syntax, configuration/CLI precedence, an explicit
empty rule selection, stable input/fatal exit boundaries, and exclusive existing-target refusal.
Each scenario uses Node process APIs rather than a shell, and target source remains inert.

M06-T02 adds `npm run test:scenario:m06`. The script builds the real CLI, copies or generates five
controlled projects in temporary roots, executes each twice with terminal/JSON/HTML output, and
compares stable projections after omitting only canonical-root and timing volatility. It never
reuses an output tree because report persistence is intentionally exclusive. Runtime symbolic-link
creation is capability-aware, and every created link must be reported as excluded by the default
policy.

M06-T04 adds `npm run test:robustness:m06`. It builds the real CLI and executes 15 shell-free Linux
cases covering input/configuration failures, output authorization and overwrite, malformed
isolation, 32-directory-deep traversal, non-execution, hostile HTML, deterministic reruns, symbolic
links, real permission denials, dependency audit, and a five-run 240-file performance baseline. The
maximum observed Linux child `VmRSS` is sampled every 5 ms through `/proc` and is not represented as
an exact lifetime peak; other platforms must record memory measurement as unavailable rather than
substitute a different process. The runner imposes no machine-dependent timing threshold and
records hosted CodeQL as unexecuted unless an actual hosted result is retrieved.

M06-T05 adds `npm run test:usability:m06`, an expert-review runner over six controlled developer
tasks. Its per-task wall-clock values measure the scripted review procedure, not participant task
time. Participant testing remains unexecuted and SUS remains not applicable because no real
responses exist.

`npm run evidence:m06` copies an allowlisted source tree into a credential-free temporary workspace,
performs a locked install, executes the complete product/coverage/no-skip/smoke/system/accuracy/
robustness/usability/harness/audit gate without a shell, and publishes exactly 42 sanitized base
artifacts with SHA-256 integrity. A second execution must match the source and stable projections
while treating only recorded performance and expert-procedure timing as volatile; it preserves the
first package. `npm run evidence:m06:finalize` validates that base manifest and adds only the
milestone report. The collector never treats hosted CodeQL, participant testing, SUS, browser
execution, or unavailable publication as executed work.

## Portability

Avoid operating-system-specific shell behavior in product code. CI should include more than one
operating system for the supported Node.js 24 contract. Add another Node.js line only after it
becomes a supported LTS contract; do not use an unsupported Current release as a quality signal.
Platform-specific differences must be documented and tested when discovered.

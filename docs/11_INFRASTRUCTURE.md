# Infrastructure and Tooling

## Runtime

UXAudit runs on the Node.js 24 LTS line (`>=24.18.0 <25`) with npm 11 (`>=11.16.0 <12`); M01 pins
Node.js `24.18.0` and npm `11.16.0` for development and CI. It reads project files and writes
optional local reports in later milestones. No backend, container, database, cloud service, or
network connection is required by the product.

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
- six compiled-CLI smoke scenarios on every matrix platform;
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
- optional execution log.

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

## Portability

Avoid operating-system-specific shell behavior in product code. CI should include more than one
operating system for the supported Node.js 24 contract. Add another Node.js line only after it
becomes a supported LTS contract; do not use an unsupported Current release as a quality signal.
Platform-specific differences must be documented and tested when discovered.

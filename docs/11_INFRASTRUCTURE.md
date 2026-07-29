# Infrastructure and Tooling

## Runtime

UXAudit runs locally in Node.js. It reads project files and writes optional local reports. No backend,
container, database, cloud service, or network connection is required by the product.

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

GitHub Actions should verify:

- harness integrity;
- dependency installation from the lockfile;
- format check;
- lint;
- typecheck;
- unit and integration tests;
- coverage generation;
- build;
- selected end-to-end smoke test;
- CodeQL and dependency review where available.

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

## Portability

Avoid operating-system-specific shell behavior in product code. CI should include more than one
supported Node version after M01 stabilizes the toolchain. Platform-specific differences must be
documented and tested when discovered.

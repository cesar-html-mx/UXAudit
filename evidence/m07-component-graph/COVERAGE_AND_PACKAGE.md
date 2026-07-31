# M07 coverage and package-consumer results

## V8 coverage

`npm run test:coverage` passed 654 tests across 61 files.

| Dimension  | Covered | Total | Percentage | Required |
| ---------- | ------: | ----: | ---------: | -------: |
| Statements |    3284 |  3447 |     95.27% |      90% |
| Branches   |    2291 |  2538 |     90.26% |      90% |
| Functions  |     604 |   607 |     99.50% |      90% |
| Lines      |    3222 |  3383 |     95.24% |      90% |

The composition rule itself measured 94.66% statements, 85.10% branches, 100% functions, and
94.59% lines. The milestone acceptance threshold applies globally; focused assertions cover the
new conservative branches that define the viability decision.

## Package consumer

`npm run test:package` rebuilt, packed, installed, and invoked the package in a clean temporary
consumer. Result: PASS with 267 packed files, 149378 bytes, and installed CLI version 0.1.0.

`npm audit --audit-level=moderate` reported 0 vulnerabilities.

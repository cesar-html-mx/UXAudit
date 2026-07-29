# Traceability Matrix

This table is updated when implementation and exact test filenames exist.

| Requirement | Primary component                                       | Milestone   | Planned verification                                                                           |
| ----------- | ------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| RF-01       | `src/cli/run-cli.ts`, sanitizer, and `src/cli/index.ts` | M01         | CLI tests: help, version, delegation, safe terminal output, and exit codes                     |
| RF-02       | `src/project/validate-project-path.ts`                  | M01         | `tests/project/validate-project-path.test.ts` and typed CLI error tests                        |
| RF-03       | `src/project/discovery/` contracts and traversal        | M02         | controlled recursive tree and recoverable-operation tests                                      |
| RF-04       | `src/project/discovery/discovery-config.ts`             | M02         | exact defaults plus configured directory/file exclusion tests                                  |
| RF-05       | `src/project/inventory/`                                | M02         | `tests/project/inventory/build-file-inventory.test.ts`: normalization, deduplication, ordering |
| RF-06       | `src/project/classification/`                           | M02         | `tests/project/classification/classify-source-candidates.test.ts`: matrix/order                |
| RF-07       | SourceParser                                            | M03         | JS/JSX/TS/TSX parser fixtures                                                                  |
| RF-08       | AnalysisModelBuilder                                    | M03         | model transformation assertions                                                                |
| RF-09       | RuleLoader                                              | M04         | category/rule filter tests                                                                     |
| RF-10       | RuleEvaluator                                           | M04         | model-driven integration tests                                                                 |
| RF-11       | Rule implementations                                    | M04         | zero/one/multiple finding cases                                                                |
| RF-12       | Finding location                                        | M03/M04     | source location assertions                                                                     |
| RF-13       | Finding metadata                                        | M04         | explanation/recommendation contract tests                                                      |
| RF-14       | AuditResult                                             | M04/M05     | category/severity grouping and ordering                                                        |
| RF-15       | Reporters                                               | M05         | terminal/JSON/HTML consistency test                                                            |
| RNF-01      | `src/cli`, `src/application`, and `src/project` layers  | All         | injected-boundary, terminal-control, and M01 architecture-conformance tests                    |
| RNF-02      | Rule/Reporter interfaces                                | M04/M05     | add test implementation without core modification                                              |
| RNF-03      | `package.json`, strict TypeScript, and focused modules  | All         | `tests/product.test.ts`; Node.js 24 format, lint, typecheck, test, coverage, and build gates   |
| RNF-04      | Pipeline                                                | M02-M06     | repeated-run deterministic comparisons                                                         |
| RNF-05      | Finding/Rule                                            | M04         | rule and source trace assertions                                                               |
| RNF-06      | CLI and reports                                         | M05/M06     | usability tasks and heuristic review                                                           |
| RNF-07      | Discovery/parser                                        | M02/M03/M06 | counters and benchmark evidence                                                                |
| RNF-08      | Parser/classifier                                       | M02/M03     | extension and syntax matrix                                                                    |
| RNF-09      | Node.js 24 package engines, ES2024 build, and CI matrix | M01/M06     | Ubuntu/Windows/macOS Node.js 24 workflow plus local build/smoke evidence                       |
| RNF-10      | Rule engine/reporters                                   | M04/M05     | reporter consistency without reevaluation                                                      |

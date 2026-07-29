# Traceability Matrix

This table is updated when implementation and exact test filenames exist.

| Requirement | Primary component                                       | Milestone   | Verification                                                                                                                   |
| ----------- | ------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| RF-01       | `src/cli/run-cli.ts`, sanitizer, and `src/cli/index.ts` | M01/M02     | CLI tests: help/version/delegation, safe output, exit codes, exact discovery summary; six compiled smokes                      |
| RF-02       | `src/project/validate-project-path.ts`                  | M01         | `tests/project/validate-project-path.test.ts` and typed CLI error tests                                                        |
| RF-03       | `src/project/discovery/` contracts and traversal        | M02         | `tests/project/discovery/discover-project.test.ts`, real integration test, and controlled M02 scenario                         |
| RF-04       | `src/project/discovery/discovery-config.ts`             | M02         | exact default and custom directory/file exclusions plus canonical-target alias-bypass tests                                    |
| RF-05       | `src/project/inventory/`                                | M02         | inventory normalization/invariant/deduplication/order tests and reviewed expected/actual inventory JSON                        |
| RF-06       | `src/project/classification/`                           | M02         | supported/rejected extension matrix, full application integration, and five-candidate controlled scenario                      |
| RF-07       | `src/parsing/babel/parse-babel-source.ts`               | M03         | `tests/parsing/babel/parse-babel-source.test.ts`: JS/JSX/TS/TSX, plugin negatives, source type, errors, locations, determinism |
| RF-08       | `extract-babel-analysis.ts`, `build-analysis-model.ts`  | M03         | extraction tests plus `tests/domain/models/build-analysis-model.test.ts`: projection, ordering, IDs, relationships, values     |
| RF-09       | RuleLoader                                              | M04         | category/rule filter tests                                                                                                     |
| RF-10       | RuleEvaluator                                           | M04         | model-driven integration tests                                                                                                 |
| RF-11       | Rule implementations                                    | M04         | zero/one/multiple finding cases                                                                                                |
| RF-12       | `SourceLocation`, extraction and model validation       | M03/M04     | exact extraction locations plus builder coordinate consistency and file/component/parent/attribute/property containment tests  |
| RF-13       | Finding metadata                                        | M04         | explanation/recommendation contract tests                                                                                      |
| RF-14       | AuditResult                                             | M04/M05     | category/severity grouping and ordering                                                                                        |
| RF-15       | Reporters                                               | M05         | terminal/JSON/HTML consistency test                                                                                            |
| RNF-01      | `src/cli`, `src/application`, and `src/project` layers  | All         | injected stage boundaries, typed/sanitized failures, terminal-control tests, and application integration                       |
| RNF-02      | Rule/Reporter interfaces                                | M04/M05     | add test implementation without core modification                                                                              |
| RNF-03      | `package.json`, strict TypeScript, and focused modules  | All         | `tests/product.test.ts`; Node.js 24 format, lint, typecheck, test, coverage, and build gates                                   |
| RNF-04      | Pipeline and `buildAnalysisModel`                       | M02-M06     | pipeline reruns plus deterministic extraction serialization and reverse-input normalized model equality                        |
| RNF-05      | Finding/Rule                                            | M04         | rule and source trace assertions                                                                                               |
| RNF-06      | CLI and reports                                         | M05/M06     | usability tasks and heuristic review                                                                                           |
| RNF-07      | Discovery/parser                                        | M02/M03/M06 | canonical discovery counters plus one-pass extraction, 100,000-node limit, 256-code-unit text bound, and later benchmarks      |
| RNF-08      | Parser/classifier                                       | M02/M03     | classification and Babel 8 four-kind matrices plus JS/TS no-JSX and TSX extraction fixtures                                    |
| RNF-09      | Node.js 24 package engines, ES2024 build, and CI matrix | M01/M06     | immutable Ubuntu/Windows/macOS workflow plus isolated Node.js 24 build, smoke, scenario, coverage, audit, and harness evidence |
| RNF-10      | Rule engine/reporters                                   | M04/M05     | reporter consistency without reevaluation                                                                                      |

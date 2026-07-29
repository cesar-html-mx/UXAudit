# Traceability Matrix

This table is updated when implementation and exact test filenames exist.

| Requirement | Primary component                                       | Milestone   | Verification                                                                                                                    |
| ----------- | ------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| RF-01       | `src/cli/run-cli.ts`, sanitizer, and `src/cli/index.ts` | M01-M03     | CLI tests: help/version/delegation, safe output, exit codes, preserved discovery and additive parsing summaries                 |
| RF-02       | `src/project/validate-project-path.ts`                  | M01         | `tests/project/validate-project-path.test.ts` and typed CLI error tests                                                         |
| RF-03       | `src/project/discovery/` contracts and traversal        | M02         | `tests/project/discovery/discover-project.test.ts`, real integration test, and controlled M02 scenario                          |
| RF-04       | `src/project/discovery/discovery-config.ts`             | M02         | exact default and custom directory/file exclusions plus canonical-target alias-bypass tests                                     |
| RF-05       | `src/project/inventory/`                                | M02         | inventory normalization/invariant/deduplication/order tests and reviewed expected/actual inventory JSON                         |
| RF-06       | `src/project/classification/`                           | M02         | supported/rejected extension matrix, full application integration, and five-candidate controlled scenario                       |
| RF-07       | secure reader, Babel composite, and candidate batch     | M03         | reader/composite/batch tests: JS/JSX/TS/TSX, bounds, UTF-8/BOM, identity, deterministic isolation, errors, no source/AST escape |
| RF-08       | extraction, model builder, and `analyzeProject`         | M03         | extraction/builder/application integration: projection, order, IDs, relationships, values, malformed sibling continuation       |
| RF-09       | RuleLoader                                              | M04         | category/rule filter tests                                                                                                      |
| RF-10       | RuleEvaluator                                           | M04         | model-driven integration tests                                                                                                  |
| RF-11       | Rule implementations                                    | M04         | zero/one/multiple finding cases                                                                                                 |
| RF-12       | `SourceLocation`, extraction and model validation       | M03/M04     | exact extraction/integration locations plus coordinate consistency and nested containment tests                                 |
| RF-13       | Finding metadata                                        | M04         | explanation/recommendation contract tests                                                                                       |
| RF-14       | AuditResult                                             | M04/M05     | category/severity grouping and ordering                                                                                         |
| RF-15       | Reporters                                               | M05         | terminal/JSON/HTML consistency test                                                                                             |
| RNF-01      | CLI, application, project, parsing, and domain layers   | All         | injected stage boundaries, preserved `scanProject`, additive `analyzeProject`, typed/sanitized failures, integration            |
| RNF-02      | Rule/Reporter interfaces                                | M04/M05     | add test implementation without core modification                                                                               |
| RNF-03      | `package.json`, strict TypeScript, and focused modules  | All         | `tests/product.test.ts`; Node.js 24 format, lint, typecheck, test, coverage, and build gates                                    |
| RNF-04      | scan/analyze pipeline and model builder                 | M02-M06     | deterministic candidate batch, pipeline reruns, extraction serialization, and reverse-input normalized model equality           |
| RNF-05      | Finding/Rule                                            | M04         | rule and source trace assertions                                                                                                |
| RNF-06      | CLI and reports                                         | M05/M06     | usability tasks and heuristic review                                                                                            |
| RNF-07      | Discovery, secure reader, and parser                    | M02/M03/M06 | sequential bounded reads (1 MiB/64 KiB), one-pass extraction, 100,000-node/256-code-unit limits, and later benchmarks           |
| RNF-08      | Classifier, reader, parser, and model facade            | M02/M03     | classification/Babel four-kind matrices and mixed real-filesystem application integration                                       |
| RNF-09      | Node.js 24 package engines, ES2024 build, and CI matrix | M01/M06     | immutable Ubuntu/Windows/macOS workflow plus isolated Node.js 24 build, smoke, scenario, coverage, audit, and harness evidence  |
| RNF-10      | Rule engine/reporters                                   | M04/M05     | reporter consistency without reevaluation                                                                                       |

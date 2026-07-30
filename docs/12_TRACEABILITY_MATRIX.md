# Traceability Matrix

This table is updated when implementation and exact test filenames exist.

| Requirement | Primary component                                       | Milestone | Verification                                                                                                                    |
| ----------- | ------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| RF-01       | CLI, audit facade, sanitizer, and executable boundary   | M01-M06   | CLI tests/smokes: help/version, complete options, source-aware precedence, safe output, exit codes, progress, and full audit    |
| RF-02       | `src/project/validate-project-path.ts`                  | M01       | `tests/project/validate-project-path.test.ts` and typed CLI error tests                                                         |
| RF-03       | `src/project/discovery/` contracts and traversal        | M02       | `tests/project/discovery/discover-project.test.ts`, real integration test, and controlled M02 scenario                          |
| RF-04       | `src/project/discovery/discovery-config.ts`             | M02       | exact default and custom directory/file exclusions plus canonical-target alias-bypass tests                                     |
| RF-05       | `src/project/inventory/`                                | M02       | inventory normalization/invariant/deduplication/order tests and reviewed expected/actual inventory JSON                         |
| RF-06       | `src/project/classification/`                           | M02       | supported/rejected extension matrix, full application integration, and five-candidate controlled scenario                       |
| RF-07       | secure reader, Babel composite, and candidate batch     | M03       | reader/composite/batch tests: JS/JSX/TS/TSX, bounds, UTF-8/BOM, identity, deterministic isolation, errors, no source/AST escape |
| RF-08       | extraction, model builder, and `analyzeProject`         | M03       | extraction/builder/application integration: projection, order, IDs, relationships, values, malformed sibling continuation       |
| RF-09       | Registry, configuration loader, audit facade, and CLI   | M04-M06   | eight-rule catalog; null/empty/category/ID/intersection filters; file/explicit-CLI precedence; integrated zero-rule scan        |
| RF-10       | `Rule`, evaluator, and `audit-project.ts`               | M04-M06   | model-only exact-once tests plus integrated one-analysis/one-model rule evaluation and thrown-rule sibling isolation            |
| RF-11       | `RuleFinding`, `Finding`, and rule implementations      | M04       | all eight rules cover zero/one/multiple and positive/safe/unsupported matrices with one finding each in the scenario            |
| RF-12       | `SourceLocation`, extraction and model validation       | M03/M04   | exact extraction, canonical provenance, and reviewed expected element/property locations for all eight scenario findings        |
| RF-13       | `RuleMetadata` and normalized `Finding`                 | M04       | complete metadata/limitation matrix and self-contained expected/actual finding samples                                          |
| RF-14       | Rule classification, audit facade, and `AuditResult`    | M04-M06   | deterministic findings; exact schema/builder; integrated file/rule/finding/error counters and recoverable-error summaries       |
| RF-15       | Audit facade, CLI, reporters, and shared writer         | M05/M06   | exact reporters plus integrated terminal/all-format scans, configured targets versus writer-confirmed claims, and write failure |
| RNF-01      | CLI, audit/application, project, parsing, domain layers | All       | injected stages, preserved scan/analyze facades, full M06 composition, typed/sanitized errors, and real-filesystem integration  |
| RNF-02      | Rule/Finding/Reporter interfaces                        | M04/M05   | typed model-only rule plus pure `Reporter`/versioned `AuditResult` contracts without core modification                          |
| RNF-03      | `package.json`, strict TypeScript, and focused modules  | All       | `tests/product.test.ts`; Node.js 24 format, lint, typecheck, test, coverage, and build gates                                    |
| RNF-04      | scan/analyze/configuration, engine, result, reporters   | M02-M06   | canonical frozen rebuilds, exact reporter reruns, and integrated stable projections excluding documented root/timing volatility |
| RNF-05      | `Finding`/`Rule`                                        | M04       | full copied `SourceLocation`, exact model-location provenance, rule identity, and classification assertions                     |
| RNF-06      | `RuleMetadata`, normalized findings, and reporters      | M04-M06   | complete guidance in terminal and semantic standalone HTML, null/empty/error cases, plus later usability protocol               |
| RNF-07      | Discovery, parser/model pipeline, rule engine, facade   | M02-M06   | bounded reads, one-pass extraction, one integrated analysis/model/evaluation; M06-T04 retains the complete-project benchmark    |
| RNF-08      | Classifier, reader, parser, and model facade            | M02/M03   | classification/Babel four-kind matrices and mixed real-filesystem application integration                                       |
| RNF-09      | Node.js 24 package engines, portable paths, CI matrix   | M01-M06   | workflow matrix; POSIX/Windows config/report flags; portable paths; real and injected writer tests                              |
| RNF-10      | Rule engine/`AuditResult`/reporters/audit facade        | M04-M06   | one frozen result for terminal/JSON/HTML, cross-format identity, separate persistence, and no analysis/rule reruns              |

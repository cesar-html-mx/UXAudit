# Traceability Matrix

This table is updated when implementation and exact test filenames exist.

| Requirement | Primary component                                       | Milestone | Verification                                                                                                                    |
| ----------- | ------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| RF-01       | CLI, audit facade, sanitizer, and executable boundary   | M01-M06   | CLI tests/smokes: help/version, complete options, source-aware precedence, safe output, exit codes, progress, and full audit    |
| RF-02       | `src/project/validate-project-path.ts`                  | M01       | `tests/project/validate-project-path.test.ts` and typed CLI error tests                                                         |
| RF-03       | `src/project/discovery/` contracts and traversal        | M02/M06   | traversal tests plus complete valid/invalid/mixed/security/large built-CLI project scenario                                     |
| RF-04       | `src/project/discovery/discovery-config.ts`             | M02/M06   | exact exclusions/alias-bypass tests plus versioned mixed-project generated/declaration/config exclusions                        |
| RF-05       | `src/project/inventory/`                                | M02       | inventory normalization/invariant/deduplication/order tests and reviewed expected/actual inventory JSON                         |
| RF-06       | `src/project/classification/`                           | M02/M06   | extension matrix plus exact versioned source/exclusion inventories for five controlled projects                                 |
| RF-07       | secure reader, Babel composite, and candidate batch     | M03/M06   | reader/batch tests plus built-CLI four-kind mixed project, malformed isolation, large corpus, and no-execution sentinels        |
| RF-08       | extraction, model builder, and `analyzeProject`         | M03/M06   | model tests plus five twice-executed controlled projects with exact parsing/model summaries                                     |
| RF-09       | Registry, configuration loader, audit facade, and CLI   | M04-M06   | eight-rule catalog; null/empty/category/ID/intersection filters; file/explicit-CLI precedence; integrated zero-rule scan        |
| RF-10       | `Rule`, evaluator, and `audit-project.ts`               | M04-M06   | model-only exact-once tests plus integrated one-analysis/one-model rule evaluation and thrown-rule sibling isolation            |
| RF-11       | `RuleFinding`, `Finding`, and rule implementations      | M04/M06   | focused rule matrices plus valid zero/invalid one-per-rule/mixed reviewed built-CLI fixture results                             |
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
| RNF-09      | Node.js 24 package engines, portable paths, CI matrix   | M01-M06   | portable committed/runtime fixture paths, capability-aware links, workflow matrix, and real/injected writer tests               |
| RNF-10      | Rule engine/`AuditResult`/reporters/audit facade        | M04-M06   | one frozen result for terminal/JSON/HTML, cross-format identity, separate persistence, and no analysis/rule reruns              |

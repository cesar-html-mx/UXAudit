# Traceability Matrix

This table is updated when implementation and exact test filenames exist.

| Requirement | Primary component                                       | Milestone | Verification                                                                                                                    |
| ----------- | ------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| RF-01       | `src/cli/run-cli.ts`, sanitizer, and `src/cli/index.ts` | M01-M03   | CLI tests: help/version/delegation, safe output, exit codes, preserved discovery and additive parsing summaries                 |
| RF-02       | `src/project/validate-project-path.ts`                  | M01       | `tests/project/validate-project-path.test.ts` and typed CLI error tests                                                         |
| RF-03       | `src/project/discovery/` contracts and traversal        | M02       | `tests/project/discovery/discover-project.test.ts`, real integration test, and controlled M02 scenario                          |
| RF-04       | `src/project/discovery/discovery-config.ts`             | M02       | exact default and custom directory/file exclusions plus canonical-target alias-bypass tests                                     |
| RF-05       | `src/project/inventory/`                                | M02       | inventory normalization/invariant/deduplication/order tests and reviewed expected/actual inventory JSON                         |
| RF-06       | `src/project/classification/`                           | M02       | supported/rejected extension matrix, full application integration, and five-candidate controlled scenario                       |
| RF-07       | secure reader, Babel composite, and candidate batch     | M03       | reader/composite/batch tests: JS/JSX/TS/TSX, bounds, UTF-8/BOM, identity, deterministic isolation, errors, no source/AST escape |
| RF-08       | extraction, model builder, and `analyzeProject`         | M03       | extraction/builder/application integration: projection, order, IDs, relationships, values, malformed sibling continuation       |
| RF-09       | Initial registry, `loadRules`, and configuration loader | M04/M05   | exact eight-rule catalog plus default/category/intersection/ID/empty/unknown filters and closed file/CLI precedence tests       |
| RF-10       | `Rule` and `evaluateRules`                              | M04       | model-only exact-once tests plus controlled full-catalog evaluation and thrown-rule sibling isolation                           |
| RF-11       | `RuleFinding`, `Finding`, and rule implementations      | M04       | all eight rules cover zero/one/multiple and positive/safe/unsupported matrices with one finding each in the scenario            |
| RF-12       | `SourceLocation`, extraction and model validation       | M03/M04   | exact extraction, canonical provenance, and reviewed expected element/property locations for all eight scenario findings        |
| RF-13       | `RuleMetadata` and normalized `Finding`                 | M04       | complete metadata/limitation matrix and self-contained expected/actual finding samples                                          |
| RF-14       | Rule/finding classification and `AuditResult`           | M04/M05   | deterministic M04 findings plus M05 exact result schema, defensive builder, and complete category/severity/error summaries      |
| RF-15       | `Reporter` and terminal/JSON/HTML adapters              | M05       | exact terminal tests; lossless JSON/schema tests; shared exclusive writer tests; escaped HTML and consistency follow in T05     |
| RNF-01      | CLI, application, project, parsing, and domain layers   | All       | injected stage boundaries, preserved `scanProject`, additive `analyzeProject`, typed/sanitized failures, integration            |
| RNF-02      | Rule/Finding/Reporter interfaces                        | M04/M05   | typed model-only rule plus pure `Reporter`/versioned `AuditResult` contracts without core modification                          |
| RNF-03      | `package.json`, strict TypeScript, and focused modules  | All       | `tests/product.test.ts`; Node.js 24 format, lint, typecheck, test, coverage, and build gates                                    |
| RNF-04      | scan/analyze/configuration, engine, result, reporters   | M02-M06   | canonical frozen rebuilds, exact terminal/JSON reruns, complete timing retention, and later integrated reruns                   |
| RNF-05      | `Finding`/`Rule`                                        | M04       | full copied `SourceLocation`, exact model-location provenance, rule identity, and classification assertions                     |
| RNF-06      | `RuleMetadata`, normalized findings, and reporters      | M04-M06   | complete guidance plus readable terminal summary/findings/errors; JSON/HTML and usability verification follow                   |
| RNF-07      | Discovery, parser/model pipeline, and rule engine       | M02-M06   | bounded sequential reads, one-pass extraction, one model freeze, exact-once rule evaluation, and later project benchmarks       |
| RNF-08      | Classifier, reader, parser, and model facade            | M02/M03   | classification/Babel four-kind matrices and mixed real-filesystem application integration                                       |
| RNF-09      | Node.js 24 package engines, portable paths, CI matrix   | M01-M06   | workflow matrix; POSIX/Windows config/report flags; portable paths; real and injected writer tests                              |
| RNF-10      | Rule engine/`AuditResult`/reporters                     | M04/M05   | frozen normalized data plus pure deterministic terminal/JSON rendering and separate shared persistence without reevaluation     |

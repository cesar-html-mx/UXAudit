[Español](es/12_TRACEABILITY_MATRIX.md) | **English**

# Traceability matrix

This map connects durable requirements to their main implementation and verification boundaries. It
is a navigation aid, not a substitute for source-level tests.

## Functional requirements

| Requirement | Main implementation                                                              | Primary verification                                                                                                               |
| ----------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| RF-01       | `src/cli/`, `src/application/audit-project.ts`                                   | CLI audit and application integration tests                                                                                        |
| RF-02       | `src/project/validate-project-path.ts`                                           | project-path unit and real-filesystem tests                                                                                        |
| RF-03       | `src/project/discovery/`                                                         | discovery traversal and controlled discovery scenario                                                                              |
| RF-04       | `src/project/discovery/discovery-config.ts`                                      | exclusion, alias, generated-content, and link cases                                                                                |
| RF-05       | `src/project/inventory/`                                                         | inventory normalization, identity, deduplication, and ordering tests                                                               |
| RF-06       | `src/project/classification/`                                                    | extension matrix and conservative exclusion tests                                                                                  |
| RF-07       | `src/parsing/`, `src/parsing/babel/`                                             | reader, parser, import/export binding, isolation, and four-kind tests                                                              |
| RF-08       | `src/parsing/babel/`, `src/domain/models/`, `src/application/analyze-project.ts` | export/use extraction, model invariants, `ComponentLink` resolution, ambiguity, cycle, location, and composition integration tests |
| RF-09       | `src/rules/`, `src/configuration/`                                               | registry, selection, configuration, and catalog integration tests                                                                  |
| RF-10       | `src/rules/evaluate-rules.ts`, composition-aware rules                           | model-only evaluation, bounded cycle traversal, observations, and isolation tests                                                  |
| RF-11       | `src/domain/findings/`, `src/rules/evaluate-rules.ts`                            | zero, one, multiple, duplicate, and invalid observation cases                                                                      |
| RF-12       | `src/domain/models/source-location.ts`, finding normalization                    | half-open source location and reporter location assertions                                                                         |
| RF-13       | rule metadata and normalized findings                                            | metadata validation and per-rule recommendation/limitation tests                                                                   |
| RF-14       | `src/domain/rules/`, `src/domain/findings/`                                      | category, severity, confidence, identity, and summary tests                                                                        |
| RF-15       | `src/reporting/`, `src/domain/audit/audit-result.ts`                             | reporter contracts, schema validation, cross-format, and writer tests                                                              |

## Non-functional requirements

| Requirement | Main implementation                                        | Primary verification                                                  |
| ----------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| RNF-01      | layered directories below `src/`                           | dependency review, injected facades, and integration tests            |
| RNF-02      | `Rule`, `Reporter`, `Finding`, and `AuditResult` contracts | closed contract validators and extension-focused tests                |
| RNF-03      | strict TypeScript, ESM, focused modules, and documentation | format, docs, lint, typecheck, tests, coverage, and build             |
| RNF-04      | canonical ordering throughout the pipeline                 | repeated runs, reversed analyzed-file input, and stable comparisons   |
| RNF-05      | normalized finding identity and source locations           | exact rule/file/range matching in rule and accuracy tests             |
| RNF-06      | terminal and HTML recommendations plus public rule docs    | reporter assertions and repeatable core-task usability review         |
| RNF-07      | one scan, one linked model, one evaluation, one result     | application spies, component-link corpus, and large-project checks    |
| RNF-08      | source classification and Babel parser adapter             | `.ts`, `.tsx`, `.js`, and `.jsx` parser/model cases                   |
| RNF-09      | package engines, portable paths, and CI platform matrix    | runtime enforcement, platform CI, links, permissions, and depth cases |
| RNF-10      | normalized result and pure reporters                       | exact JSON schema, terminal/JSON/HTML consistency, and no-rerun tests |

## Distribution and documentation

| Requirement | Main implementation                                              | Primary verification                                             |
| ----------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| DIST-01     | `package.json`, `dist/`, `schemas/`, and public README files     | `npm run test:package` and clean temporary consumer installation |
| DOC-I18N    | `README.md`, `README.en.md`, `README.es.md`, `docs/`, `docs/es/` | `npm run docs:check`, formatting, link checks, and human review  |

## Maintenance rule

When a requirement, public option, schema, rule, or report changes, update its implementation, tests,
paired documentation, and this map in the same coherent change.

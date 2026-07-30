[Español](es/03_REQUIREMENTS.md) | **English**

# Requirements

## Functional requirements

| ID    | Requirement                                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------- |
| RF-01 | Allow the user to select a project through the CLI.                                                                    |
| RF-02 | Validate that the path exists, is a directory, and can be accessed.                                                    |
| RF-03 | Recursively discover files within the project.                                                                         |
| RF-04 | Exclude dependencies, generated output, configuration, and irrelevant content according to defined policy.             |
| RF-05 | Create an inventory retaining normalized relative and absolute location information.                                   |
| RF-06 | Classify source candidates that may contain relevant React/TypeScript code.                                            |
| RF-07 | Parse JavaScript, TypeScript, JSX, and TSX source using a compatible parser.                                           |
| RF-08 | Build a normalized model of files, components, JSX elements, properties, relationships, and locations needed by rules. |
| RF-09 | Load available and enabled rules in UX, accessibility, SEO, and performance categories.                                |
| RF-10 | Execute rules over the normalized model rather than rereading files independently.                                     |
| RF-11 | Allow each rule to return zero, one, or multiple normalized findings.                                                  |
| RF-12 | Preserve file and source location for each finding whenever available.                                                 |
| RF-13 | Include an explanation, recommendation, and known limitations.                                                         |
| RF-14 | Classify findings by rule, category, severity, and confidence.                                                         |
| RF-15 | Generate terminal, JSON, and HTML reports from one normalized audit result.                                            |

## Non-functional requirements

| ID     | Requirement                                                                                               |
| ------ | --------------------------------------------------------------------------------------------------------- |
| RNF-01 | Modular responsibilities for CLI, application, project processing, parsing, domain, rules, and reporting. |
| RNF-02 | Extensible, validated rule and reporter contracts.                                                        |
| RNF-03 | Maintainable, typed, documented, and independently testable modules.                                      |
| RNF-04 | Repeatable ordering and results for the same source, configuration, platform, and version.                |
| RNF-05 | Trace every finding to its rule and source location whenever available.                                   |
| RNF-06 | Present actionable results to frontend developers in safe local reports.                                  |
| RNF-07 | Avoid redundant traversal, parsing, rule evaluation, and report-specific analysis.                        |
| RNF-08 | Support `.ts`, `.tsx`, `.js`, and `.jsx` in React projects.                                               |
| RNF-09 | Run on major Node.js-compatible operating systems without a graphical environment.                        |
| RNF-10 | Keep analysis independent from output presentation.                                                       |

## Product constraints

- Local static analysis is the only execution model.
- Analyzed modules are never imported, executed, or changed.
- No production database, telemetry, hosted service, or network dependency is introduced.
- Rules consume the normalized analysis model rather than parser-specific syntax trees.
- Reporters consume one normalized audit result and do not rerun analysis.
- Filesystem traversal and report writing remain inside explicitly authorized roots.
- Dynamic or unsupported cases are described as unknown or limited, not asserted as defects.

## Requirement interpretation

The [product specification](02_PRODUCT_SPEC.md) defines observable CLI behavior. The
[architecture](04_ARCHITECTURE.md) defines implementation boundaries, and the
[traceability matrix](12_TRACEABILITY_MATRIX.md) maps each requirement to code and verification.

A clarification may improve wording without changing observable behavior. Adding, removing, or
weakening a public behavior requires an explicit design decision, tests, and bilingual documentation.

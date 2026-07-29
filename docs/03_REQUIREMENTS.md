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
| RF-13 | Include an explanation and actionable recommendation.                                                                  |
| RF-14 | Classify findings by rule, category, and severity.                                                                     |
| RF-15 | Generate terminal, JSON, and HTML reports from one audit result.                                                       |

## Non-functional requirements

| ID     | Requirement                                                                                               |
| ------ | --------------------------------------------------------------------------------------------------------- |
| RNF-01 | Modular responsibilities for CLI, application, project processing, parsing, domain, rules, and reporting. |
| RNF-02 | Extensible rule and reporter contracts.                                                                   |
| RNF-03 | Maintainable, typed, documented, and independently testable modules.                                      |
| RNF-04 | Repeatable results for the same source, configuration, and version.                                       |
| RNF-05 | Trace every finding to its rule and source location.                                                      |
| RNF-06 | Present results in language useful to a frontend developer.                                               |
| RNF-07 | Avoid redundant traversal, parsing, and processing.                                                       |
| RNF-08 | Support `.ts`, `.tsx`, `.js`, and `.jsx` in React projects.                                               |
| RNF-09 | Run on major Node.js-compatible operating systems without a graphical environment.                        |
| RNF-10 | Keep analysis independent from output presentation.                                                       |

## Requirement change policy

A requirement may be clarified autonomously when its observable behavior does not change. Adding,
removing, or weakening behavior requires a documented decision and owner approval.

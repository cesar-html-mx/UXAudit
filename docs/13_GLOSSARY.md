[Español](es/13_GLOSSARY.md) | **English**

# Glossary

| Term                  | Meaning                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| Analysis model        | Parser-independent, immutable representation of files, components, JSX, values, relationships, and locations. |
| `AnalysisModel`       | Type name for the normalized analysis model consumed by rules.                                                |
| Audit                 | One complete local scan from authorized project path through normalized result and selected reports.          |
| `AuditResult`         | Versioned immutable result consumed by terminal, JSON, and HTML reporters.                                    |
| Canonical root        | Real filesystem identity of the selected project and authorization boundary for traversal and reports.        |
| Category              | Rule grouping: accessibility, performance, SEO, or UX.                                                        |
| Confidence            | Metadata describing the strength of static evidence behind a finding.                                         |
| Finding               | Normalized review observation produced by one rule.                                                           |
| Half-open location    | Source range whose start is included and end is excluded.                                                     |
| Inventory             | Deterministically ordered record of discovered filesystem entries.                                            |
| Processing error      | Normalized recoverable discovery, source, parser, or rule failure retained in the result.                     |
| Reporter              | Pure adapter that renders one `AuditResult` as terminal, JSON, or HTML text.                                  |
| Rule                  | Independent static check with validated metadata and an evaluator over `AnalysisModel`.                       |
| Rule registry         | Validated immutable collection from which enabled rules are selected.                                         |
| Severity              | Default review priority: info, low, medium, high, or critical.                                                |
| Source candidate      | Supported inventory entry eligible for reauthorization, bounded reading, and parsing.                         |
| Stable projection     | Result view excluding documented volatile values such as root, timestamps, or duration.                       |
| Static analysis       | Inspection of source structure without executing the analyzed program.                                        |
| Terminal sanitization | Conversion of untrusted dynamic values into visible well-formed terminal-safe text.                           |
| Unknown               | Dynamic or unsupported state for which static evidence does not justify a conclusion.                         |

These terms describe current product contracts. Rule-specific terms and limitations appear in the
[rule catalog](08_RULE_CATALOG.md).

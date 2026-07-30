# Task Queue

## M01 — Repository bootstrap and CLI foundation

- [x] M01-T01 Initialize Node and TypeScript project.
- [x] M01-T02 Configure ESLint, Prettier, Vitest, coverage, and Husky.
- [x] M01-T03 Create the `ux-audit scan <project>` CLI contract and help output.
- [x] M01-T04 Implement project-path validation and typed errors.
- [x] M01-T05 Establish CI, documentation, and first evidence.

## M02 — Project discovery, inventory, and classification

- [x] M02-T01 Define discovery contracts, exclusions, and supported extensions.
- [x] M02-T02 Implement safe recursive traversal with symlink-loop protection.
- [x] M02-T03 Build a normalized, deduplicated, deterministic inventory.
- [x] M02-T04 Classify `.ts`, `.tsx`, `.js`, and `.jsx` source candidates.
- [x] M02-T05 Integrate discovery with the CLI and record evidence.

## M03 — Source parser and analysis model

- [x] M03-T01 Define parser and normalized model contracts.
- [x] M03-T02 Configure `@babel/parser` for TypeScript and JSX.
- [x] M03-T03 Traverse ASTs and extract components, JSX elements, attributes, and locations.
- [x] M03-T04 Build the UXAudit analysis model without exposing Babel nodes to rules.
- [x] M03-T05 Isolate parser errors and integrate the complete processing path.

## M04 — Rule engine and initial catalog

- [x] M04-T01 Define rule metadata, category, severity, and finding contracts.
- [x] M04-T02 Implement rule registry, loading, filtering, and isolated evaluation.
- [x] M04-T03 Implement the initial accessibility rules.
- [x] M04-T04 Implement the initial SEO, performance, and UX rules.
- [x] M04-T05 Verify deterministic ordering, rule isolation, and catalog traceability.

## M05 — Configuration and reporting

- [x] M05-T01 Define configuration and `AuditResult`.
- [x] M05-T02 Load `uxaudit.config.json`, merge defaults, and validate values.
- [x] M05-T03 Implement terminal summary and finding output.
- [x] M05-T04 Implement deterministic JSON reporting.
- [x] M05-T05 Implement a standalone, escaped HTML report.

## M06 — Integration, validation, usability, and security evidence

- [x] M06-T01 Connect `ux-audit scan` from path input to all reporters.
- [x] M06-T02 Create controlled valid and invalid React/TypeScript projects.
- [x] M06-T03 Calculate true positives, false positives, false negatives, precision, and recall.
- [x] M06-T04 Execute system, robustness, performance, dependency, and security checks.
- [ ] M06-T05 Run the usability protocol and assemble all evidence for Activity 3.

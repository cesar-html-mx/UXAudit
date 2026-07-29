# Acceptance Criteria

## Product-level

UXAudit is acceptable for the initial TFM contribution when:

1. `ux-audit scan <path>` performs the complete static-analysis flow.
2. Invalid input is rejected clearly before traversal.
3. Relevant source files are selected without processing excluded dependency/build folders.
4. JSX/TSX/JS/TS files are parsed into a normalized internal model.
5. Stable rules in all four categories execute independently.
6. Findings include rule, category, severity, explanation, recommendation, file, and location when
   available.
7. Terminal, JSON, and HTML outputs contain consistent finding data.
8. Repeated execution is deterministic.
9. Controlled projects produce versioned expected results.
10. Limitations and false-positive/false-negative evidence are reported honestly.
11. Security boundary tests pass.
12. Documentation and usage instructions allow another developer to run and understand the tool.

## Milestone gates

### M01

- Buildable TypeScript CLI skeleton.
- Help and scan command available.
- Valid and invalid path behavior tested.
- Quality commands and CI exist.
- First evidence package recorded.

### M02

- Safe traversal, exclusions, inventory, and classification work on controlled trees.
- No duplicates; stable ordering; symlink policy tested.
- CLI can display or internally expose discovery summary.

### M03

- Supported syntax parses with locations.
- Malformed file errors are isolated.
- Analysis model exposes required JSX/component information without Babel nodes in rule contracts.

### M04

- Rule registry and evaluator work deterministically.
- All required rules have positive, negative, and limitation tests.
- One rule failure does not discard unrelated rule results when safe.

### M05

- Configuration is validated and merged with defaults.
- Terminal, JSON, and HTML reporters use the same `AuditResult`.
- HTML injection tests pass.
- Generated reports are reproducible aside from documented volatile metadata.

### M06

- End-to-end CLI passes controlled projects.
- Accuracy table exists per stable rule.
- Robustness, performance, and security evidence exists.
- Usability protocol is executed or its unexecuted status is stated truthfully.
- Activity 3 evidence package and implementation documentation are complete.

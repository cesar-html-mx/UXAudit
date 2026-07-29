# Product Specification

## Command

The primary interface is:

```bash
ux-audit scan <project-path> [options]
```

Planned options:

- `--config <path>`: configuration file; default search is `uxaudit.config.json` at project root.
- `--format <terminal|json|html|all>`: selected reporters.
- `--output <directory>`: report output directory.
- `--category <ux|accessibility|seo|performance>`: category filter; repeatable when appropriate.
- `--rule <rule-id>`: explicit rule filter.
- `--severity <info|low|medium|high|critical>`: minimum displayed severity where supported.
- `--no-color`: terminal output without ANSI color.
- `--verbose`: processing detail and recoverable errors.

Final option names may be refined in M01/M05, but documented behavior and compatibility must be
preserved after release.

## Successful execution

A successful audit returns an `AuditResult` containing:

- project root;
- start/end or duration metadata;
- files discovered, selected, parsed, and failed;
- enabled and executed rule counts;
- normalized findings;
- recoverable execution errors;
- summary by category and severity;
- generated report paths.

## Exit codes

Proposed initial policy:

- `0`: audit completed and no finding meets failure policy.
- `1`: audit completed and findings meet configured failure policy.
- `2`: invalid input or configuration.
- `3`: unrecoverable internal execution failure.

The policy must be tested and documented before M06 closure.

## Determinism

Given the same project content, configuration, and UXAudit version, the ordering and content of
results must be stable. Absolute timestamps and durations may vary and must not affect snapshot
comparisons.

## Finding

Each finding contains at least:

- rule ID and title;
- category;
- severity;
- message and explanation;
- recommendation;
- file path relative to the project;
- line and column when available;
- optional evidence snippet or metadata;
- optional standard/reference;
- optional confidence or limitations.

## Configuration

Configuration is local JSON. Unknown keys, invalid values, and conflicting options must produce a
clear error. Defaults must be documented and versioned.

## Reports

- Terminal: concise immediate summary and readable findings.
- JSON: complete stable machine-readable result.
- HTML: standalone, escaped, readable report requiring no external service.

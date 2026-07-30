[Español](es/02_PRODUCT_SPEC.md) | **English**

# Product and CLI specification

## Distribution and invocation

The npm package name is `@cesar-html-mx/uxaudit` and the executable name is `ux-audit`. Consumers
install the package as a development dependency and run the binary from their project:

```bash
npm install --save-dev @cesar-html-mx/uxaudit
npm exec --offline -- ux-audit scan .
```

The offline invocation requires the installed local dependency and prevents npm from resolving
another similarly named package. An installed consumer does not build UXAudit and does not inherit
this repository's npm scripts. Only contributors working from source use the repository build
workflow.

## Observable scan flow

`ux-audit scan <project-path>` performs these stages in order:

1. validates that the selected path is a readable, non-empty directory and resolves its canonical
   root;
2. loads optional inert JSON configuration;
3. discovers filesystem entries in deterministic project-relative order;
4. selects safe `.js`, `.jsx`, `.ts`, and `.tsx` candidates;
5. reads and parses bounded UTF-8 source files without executing them;
6. builds one parser-independent analysis model;
7. loads and evaluates the selected stable rules with failure isolation;
8. builds one normalized immutable audit result;
9. renders terminal output and writes selected JSON or HTML files.

The command prints path validation, discovery, and parsing summaries before the terminal report. A
file report is announced only after its write completes successfully.

## Command options

| Option                  | Contract                                                                     |
| ----------------------- | ---------------------------------------------------------------------------- |
| `--config <path>`       | Select an explicit JSON configuration file.                                  |
| `--format <format>`     | Select `terminal`, `json`, `html`, or `all`; repeatable and deduplicated.    |
| `--output <directory>`  | Select a portable project-relative output directory.                         |
| `--category <category>` | Filter by `accessibility`, `performance`, `seo`, or `ux`; repeatable.        |
| `--rule <rule-id>`      | Filter by exact built-in rule ID; repeatable.                                |
| `--severity <severity>` | Filter terminal details with `info`, `low`, `medium`, `high`, or `critical`. |
| `--no-color`            | Disable fixed ANSI severity badge colors.                                    |
| `--verbose`             | Show normalized recoverable processing errors in terminal output.            |

`--help` and `--version` are available at the root command; `scan --help` describes the subcommand.

## Discovery and source selection

Default traversal skips symbolic links and common dependency, version-control, cache, generated,
coverage, and build directories. It also skips conventional tool configuration names,
`uxaudit.config.json`, TypeScript declaration files ending in `.d.ts`, and supported files whose
portable name matches the conventional `config` pattern.

Discovery produces candidates rather than permanent authorization. Before reading, UXAudit
reauthorizes the canonical root and file identity, requires a regular in-root file, limits content to
1 MiB, reads in chunks no larger than 64 KiB, and decodes UTF-8 strictly.

## Configuration contract

Without `--config`, UXAudit looks for `uxaudit.config.json` at the canonical project root. An
explicit configuration path is treated as a user-selected local file. Both forms are parsed as data,
never imported as code.

```json
{
  "schemaVersion": 1,
  "categories": null,
  "ruleIds": null,
  "formats": ["terminal"],
  "minimumSeverity": "info",
  "outputDirectory": "uxaudit-reports",
  "color": true,
  "verbose": false
}
```

The object is closed: unknown keys and invalid types are errors. Arrays are bounded, dense, unique,
and normalized. `categories: null` and `ruleIds: null` leave those filters open; `[]` intentionally
selects no rules for that filter. When both filters are arrays, their intersection is used.

Only command options explicitly supplied by the user override the file. File values override
defaults. The configuration file is limited to 64 KiB and must be valid UTF-8 JSON with
`schemaVersion: 1`.

## Report contract

All reporters consume the same normalized result:

- Terminal is interactive, may use fixed color badges, and applies `minimumSeverity` only to visible
  finding details. Complete totals remain visible.
- JSON is the lossless machine-readable representation, formatted with two-space indentation and one
  final line feed.
- HTML is standalone, uses embedded constant CSS, has no scripts or external assets, escapes
  untrusted project values, and sets a restrictive Content Security Policy.

The package exposes JSON validation contracts at `schemas/audit-result.schema.json` and
`schemas/finding.schema.json`. In a local installation the first path is
`node_modules/@cesar-html-mx/uxaudit/schemas/audit-result.schema.json`. Schemas support report
consumers; UXAudit remains a CLI and does not expose a public importable API.

JSON and HTML use fixed filenames:

- `audit-report.json`
- `audit-report.html`

The output directory must be a portable relative path below the project root. Report writing refuses
absolute paths, parent traversal, links, path escape, and existing targets. If more than one file
format is selected, an earlier file may already exist when a later write fails; UXAudit does not
perform an unsafe automatic rollback.

## Exit codes

| Code | Contract                                                                                              |
| ---: | ----------------------------------------------------------------------------------------------------- |
|  `0` | Help, version, or completed audit, including findings and recoverable processing errors.              |
|  `1` | Reserved for a future finding-failure policy and not currently emitted because of findings.           |
|  `2` | Invalid command, argument, project path, or configuration input.                                      |
|  `3` | Fatal pipeline failure, invariant violation, unexpected application failure, or report-write failure. |

`minimumSeverity` is a presentation filter and does not change the exit code.

## Recoverable and fatal failures

Unreadable descendants, malformed source files, safe extraction failures, and isolated rule failures
are recorded when possible while unaffected files and rules continue. Invalid root input,
configuration errors, broken global invariants, and report-write failures stop the command with the
appropriate nonzero code.

Native parser and filesystem details, raw source text, absolute source paths, and internal syntax
trees do not leak through public errors. Dynamic terminal values are normalized so control and
bidirectional characters cannot create deceptive records.

## Compatibility and non-goals

The supported runtime is Node.js `>=24.18.0 <25`. UXAudit analyzes React-ecosystem JavaScript and
TypeScript source but does not require the target project to use a particular bundler.

Browser execution, runtime instrumentation, automatic code changes, network crawling, telemetry,
compliance certification, and hosted dashboards are not product features. Rules are conservative
static checks and must publish their own limitations.

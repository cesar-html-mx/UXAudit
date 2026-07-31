# UXAudit

[Español](README.es.md) | **English**

UXAudit is a local static-analysis command-line tool for React, JavaScript, and TypeScript projects.
It turns source structure into reviewable accessibility, SEO, performance, and UX findings without
executing or modifying the analyzed code.

## What it does

One `scan` command:

1. validates and canonicalizes the selected project directory;
2. discovers supported `.js`, `.jsx`, `.ts`, and `.tsx` files in deterministic order;
3. parses safe source candidates and builds a parser-independent analysis model;
4. evaluates the selected rules while isolating recoverable file and rule failures;
5. creates one normalized result and renders terminal, JSON, or HTML reports.

Dependencies, generated output, caches, coverage directories, common configuration files,
declaration files, and symbolic links are skipped by default. Target modules are never imported.

## Requirements

- Node.js `>=24.18.0 <25`
- npm `>=11.16.0 <12` when installing or developing with npm

## Install

### Recommended project dependency

Install UXAudit in the project that you want to analyze:

```bash
npm install --save-dev @cesar-html-mx/uxaudit
npm exec --offline -- ux-audit scan .
```

The npm package is `@cesar-html-mx/uxaudit`; its executable is `ux-audit`. The examples use
`npm exec --offline` so only the already-installed local dependency can provide the command; this
avoids resolving another similarly named package. A local development dependency keeps the version
reproducible for teammates and continuous integration. You can expose it through the project's own
scripts:

```json
{
  "scripts": {
    "audit:ux": "ux-audit scan ."
  }
}
```

Run it with `npm run audit:ux`.

### Optional global installation

For interactive use across several local projects:

```bash
npm install --global @cesar-html-mx/uxaudit
ux-audit scan /path/to/project
```

Prefer a project dependency in automated workflows so the selected version is recorded.

## Quick start

The default audit prints a terminal report:

```bash
npm exec --offline -- ux-audit scan .
```

Generate terminal, JSON, and HTML output together:

```bash
npm exec --offline -- ux-audit scan . --format all --output uxaudit-reports
```

The file reports are:

- `uxaudit-reports/audit-report.json`
- `uxaudit-reports/audit-report.html`

UXAudit creates report files exclusively and does not overwrite an existing target. Choose a new
output directory or deliberately remove the old report before rerunning file output.

## Command reference

```text
ux-audit scan <project-path> [options]
```

Options:

- `--config <path>`: use an explicit JSON configuration file.
- `--format <format>`: select `terminal`, `json`, `html`, or `all`; repeat the option to combine
  formats.
- `--output <directory>`: select a portable project-relative report directory.
- `--category <category>`: select `accessibility`, `performance`, `seo`, or `ux`; repeatable.
- `--rule <rule-id>`: select an exact built-in rule ID; repeatable.
- `--severity <severity>`: set the terminal detail threshold to `info`, `low`, `medium`, `high`, or
  `critical`.
- `--no-color`: disable terminal badge colors.
- `--verbose`: include normalized recoverable processing errors in terminal output.

Use `npm exec --offline -- ux-audit --help`, `npm exec --offline -- ux-audit scan --help`, or
`npm exec --offline -- ux-audit --version` for local command help.

## Configuration

Place `uxaudit.config.json` at the project root or pass a file with `--config`:

```json
{
  "schemaVersion": 1,
  "categories": ["accessibility", "seo"],
  "ruleIds": null,
  "formats": ["terminal", "json", "html"],
  "minimumSeverity": "medium",
  "outputDirectory": "uxaudit-reports",
  "color": true,
  "verbose": false
}
```

Defaults:

- all stable rules through `categories: null` and `ruleIds: null`;
- `formats: ["terminal"]`;
- `minimumSeverity: "info"`;
- `outputDirectory: "uxaudit-reports"`;
- `color: true`;
- `verbose: false`.

### Precedence and filters

Explicit command-line options override file values; file values override defaults. `null` in
`categories` or `ruleIds` means no filter, while `[]` intentionally enables no rules for that
filter. When both lists are present, a rule must match both. Unknown keys, duplicate entries,
unknown rule IDs, invalid values, and unsafe output paths are rejected.

The configuration file is inert JSON: UXAudit reads it as data and never imports or executes it.
It must be valid UTF-8, no larger than 64 KiB, and use `schemaVersion: 1`.

## Reports

- Terminal is the default interactive summary. `minimumSeverity` filters displayed finding details,
  not totals or the audit outcome. `verbose` reveals safe, normalized processing details.
- JSON contains the complete normalized result, including configuration, timing, file and rule
  counters, findings, recoverable errors, and configured report paths.
- HTML is a standalone report with embedded CSS, no scripts or external assets, escaped project
  content, and a restrictive Content Security Policy.

Consumers can validate JSON with the packaged
`node_modules/@cesar-html-mx/uxaudit/schemas/audit-result.schema.json`; the supporting schema is
`node_modules/@cesar-html-mx/uxaudit/schemas/finding.schema.json`. These files define report
validation contracts and do not turn the CLI into an importable library API.

JSON and HTML are written only below the canonical project root. Output paths cannot be absolute,
escape the root, traverse symbolic links, or replace existing files.

## Built-in rules

| Rule ID                        | Category      | Default severity | Review focus                          |
| ------------------------------ | ------------- | ---------------- | ------------------------------------- |
| `accessibility/button-name`    | accessibility | high             | Accessible name for intrinsic buttons |
| `accessibility/img-alt`        | accessibility | high             | Alternative text for intrinsic images |
| `accessibility/input-label`    | accessibility | high             | Label or name for form controls       |
| `performance/img-dimensions`   | performance   | medium           | Intrinsic image dimensions            |
| `performance/img-lazy-loading` | performance   | low              | Reviewable lazy-loading opportunity   |
| `seo/ambiguous-link-text`      | seo           | medium           | Ambiguous static link text            |
| `seo/multiple-h1`              | seo           | medium           | Multiple owned or linked headings     |
| `ux/small-inline-text`         | ux            | medium           | Very small literal inline text        |

`seo/multiple-h1` preserves its source-local finding at the second intrinsic `h1`. It also evaluates
bounded composition through exact direct local `ComponentLink` records: a linked child definition
contributes at most one `h1` at each JSX use, repeated uses count separately, and a child that
supplies the second contribution is reported at that JSX use. Unresolved or ambiguous references,
package imports, cycles, conditional rendering, and routes are handled conservatively and are not
inferred. Exactly `64` `ComponentLink` hops from each evaluated root are supported; paths with more
than `64` hops remain unknown. Each root component receives an independent `100000`-step traversal
budget, and work beyond that budget remains unknown.

See the
[rule catalog](https://github.com/cesar-html-mx/UXAudit/blob/main/docs/08_RULE_CATALOG.md) for
triggers, recommendations, and limitations.

## Exit codes

| Code | Meaning                                                                                       |
| ---: | --------------------------------------------------------------------------------------------- |
|  `0` | Help, version, or a completed audit, including audits with findings or recoverable errors.    |
|  `1` | Reserved for a future finding-failure policy; no current option emits it because of findings. |
|  `2` | Invalid command, argument, project path, or configuration.                                    |
|  `3` | Fatal analysis, invariant, internal, or report-write failure.                                 |

Do not use the current exit code as a finding threshold in CI. Consume the JSON result if a workflow
needs a project-specific policy.

## Privacy and security

UXAudit runs locally and has no product telemetry, database, hosted service, or network dependency.
It does not upload source, findings, or reports. Static-analysis rules consume a normalized model,
not executable project modules or raw parser nodes.

The scanner revalidates paths around source reads, bounds each source file to 1 MiB, decodes UTF-8
strictly, skips links by default, prevents traversal outside the canonical root, and escapes
untrusted values in terminal and HTML output. Reports include the canonical absolute project root
and can expose local directory names when shared; review or redact them first. See
[Security](https://github.com/cesar-html-mx/UXAudit/blob/main/docs/07_SECURITY.md) for the threat
model and reporting guidance.

## Current limitations

- Static analysis cannot observe rendered layout, routes, state, CSS cascade, network behavior, or
  user interaction.
- Component recognition and composition are conservative and syntactic. Only exact direct local
  relationships represented by `ComponentLink` are followed; unsupported aliases, higher-order
  abstractions, and module relationships remain unknown.
- The rules do not implement a complete accessible-name algorithm or claim full WCAG, SEO, UX, or
  performance compliance.
- Dynamic JSX values and unresolved spreads are often classified as unknown to avoid unsupported
  conclusions.
- Findings are review prompts and can include false positives or false negatives. Pair UXAudit with
  browser, assistive-technology, performance, and participant testing appropriate to the project.

## Develop from source

End users do not need to clone or build UXAudit. Contributors working from a repository checkout can
use:

```bash
nvm install
nvm use
npm ci
npm run build
node dist/cli/index.js scan /path/to/project
```

Common contributor checks are `npm run verify`, `npm test`, `npm run test:coverage`,
`npm run docs:check`, and `npm run build`.

## Documentation and contributions

Start with the
[documentation index](https://github.com/cesar-html-mx/UXAudit/blob/main/docs/00_INDEX.md).
Architecture, engineering, testing, security, and documentation contracts are grouped there by
audience. Contributions should preserve deterministic behavior, public tests and documentation,
strict TypeScript, safe filesystem boundaries, and paired English/Latin American Spanish
documentation.

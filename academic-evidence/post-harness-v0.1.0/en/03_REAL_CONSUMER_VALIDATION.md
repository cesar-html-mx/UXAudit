[Español](../es/03_REAL_CONSUMER_VALIDATION.md) | **English**

# Real consumer validation

## Objective

Validate the package that an external user receives from npm, independently of the UXAudit source
checkout. The scenario used a newly generated Vite React/TypeScript project, installed the exact
public version, invoked the locally linked executable, generated every report format, exercised a
project script, and compiled the consumer.

This was a realistic clean consumer integration, not a production-project certification or
participant study.

## Environment

| Component            | Observed value                         |
| -------------------- | -------------------------------------- |
| Operating system     | Linux                                  |
| Node.js              | `24.18.0`                              |
| npm                  | `11.16.0`                              |
| Project generator    | `create-vite@9.1.2`                    |
| Vite                 | `8.2.0`                                |
| React / React DOM    | `19.2.8`                               |
| TypeScript           | `6.0.2`                                |
| UXAudit              | `@cesar-html-mx/uxaudit@0.1.0`         |
| Installed executable | `ux-audit`                             |
| Source of UXAudit    | Public npm registry, not a local path  |
| Consumer persistence | Temporary; moved to trash after review |

## Procedure

The following commands record the tested consumer path with the observed generator version pinned:

```bash
npm create vite@9.1.2 uxaudit-real-consumer -- --template react-ts
cd uxaudit-real-consumer
npm install
npm install --save-dev @cesar-html-mx/uxaudit@0.1.0
npm exec --offline -- ux-audit --version
npm exec --offline -- ux-audit scan . --format all --output uxaudit-reports
```

The installed version reported:

```text
0.1.0
```

The common project-script integration was also tested:

```json
{
  "scripts": {
    "audit:ux": "ux-audit scan . --format json --output uxaudit-script-report"
  }
}
```

```bash
npm run audit:ux
npm run build
```

`npm exec --offline` was deliberate: after installation, the command could only resolve from the
local consumer dependency and could not download a similarly named executable.

## Primary audit result

| Measurement                  | Result |
| ---------------------------- | -----: |
| Inventory entries discovered |     18 |
| Source candidates            |      2 |
| Parsed files                 |      2 |
| Failed parses                |      0 |
| Components                   |      1 |
| JSX elements                 |     52 |
| Available / enabled rules    |  8 / 8 |
| Executed / successful rules  |  8 / 8 |
| Failed rules                 |      0 |
| Findings                     |      9 |
| Processing errors            |      0 |

Finding distribution:

| Rule ID                        | Severity | Count |
| ------------------------------ | -------- | ----: |
| `performance/img-dimensions`   | `medium` |     4 |
| `performance/img-lazy-loading` | `low`    |     5 |

All findings belonged to the performance review category. They reflected the current Vite template's
intrinsic images without statically verified dimensions and images without a statically configured
`loading="lazy"` value. The CLI correctly described these as reviewable static risks with
limitations, not observed runtime failures.

The completed audit returned exit code `0`, as documented: findings alone do not currently fail the
process.

## Report validation

The first run generated:

- `uxaudit-reports/audit-report.json`
- `uxaudit-reports/audit-report.html`

The JSON report was parsed again and confirmed:

```json
{
  "version": "0.1.0",
  "findings": 9,
  "errors": 0,
  "files": {
    "discovered": 18,
    "failed": 0,
    "parsed": 2,
    "selected": 2
  }
}
```

Observed report digests:

| File                | SHA-256                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `audit-report.json` | `50eeb169e12d70c0369011163294fd26d73f9626a54c084ca2f1a96ba7f149a3` |
| `audit-report.html` | `bacb1dba5dd7e13aa82cf72c4903114c6ca8dd7ecc461c05258bb48afa7038cf` |

The HTML file was non-empty and contained the tool version, nine-finding summary, source locations,
and both observed rule IDs. Because the temporary artifacts were not committed, the digests record
the reviewed session outputs but cannot be independently recalculated from this branch.

Pinning the observed generator makes the scaffold command stable, but the exact dependency
resolution is not reproducible from this dossier. The consumer lockfile, generated reports, and
sanitized command outputs were not retained, so the reported digests and dependency versions remain
class `D` observations rather than independently reproducible artifacts.

## Project-script and build result

`npm run audit:ux` resolved the same installed executable and produced a JSON report with the same
nine findings. By that point generated output increased the discovered inventory to 20 and exclusions
to 3, while the selected and parsed source set remained two files.

The consumer then passed:

```text
tsc -b && vite build
20 modules transformed
build completed successfully
```

The final npm dependency audit reported zero known vulnerabilities for the 54-package consumer tree
at the time of validation.

## Containment and cleanup

Vite initially interpreted an absolute scaffold target as a relative path below the UXAudit checkout.
No installation occurred there. The exact generated directory was inspected and moved to `/tmp`
before continuing; the accidental empty parent was removed and the UXAudit worktree was verified
clean.

After validation, the exact temporary consumer directory was moved to trash rather than
permanently deleted. The operation was recoverable at that point and left the UXAudit repository
unchanged.

## Conclusion

The public `0.1.0` package met the external-consumer path tested here:

1. npm installation succeeded;
2. the expected executable was linked and reported the correct version;
3. the CLI analyzed React/TypeScript source without a source checkout;
4. all eight rules completed without processing errors;
5. terminal, JSON, and HTML output were generated and internally consistent;
6. project-script integration worked;
7. the consuming React/TypeScript project still compiled.

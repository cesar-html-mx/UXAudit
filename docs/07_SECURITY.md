# Security

## Threat model

UXAudit processes a project selected by the user, but all project content is treated as untrusted.
Threats relevant to a local static analyzer include:

- path traversal and access outside the approved root;
- symlink loops or links to external files;
- malicious filenames and source strings;
- HTML/script injection in generated reports;
- executing or importing analyzed code;
- resource exhaustion from large or malformed projects;
- unsafe output paths and overwriting unrelated files;
- dependency and supply-chain vulnerabilities;
- sensitive path leakage in reports or logs.

## Required controls

1. Canonicalize and validate the project root.
2. Use explicit symlink policy and visited-realpath tracking.
3. Never execute target code, package scripts, configuration modules, or shells.
4. Parse text only.
5. Escape every project-controlled value in HTML.
6. Serialize JSON through standard encoders.
7. Default output paths to a controlled directory and prevent unintended overwrite.
8. Use bounded, clear handling for oversized or unreadable files when introduced.
9. Avoid secrets, telemetry, and external network transmission.
10. Commit a lockfile and run dependency review/audit.
11. Return typed errors without exposing unnecessary sensitive environment data.
12. Test hostile input.

## Security acceptance scenarios

- `../../` and equivalent path inputs do not escape an authorized root.
- Symlink cycles terminate safely.
- A symlink pointing outside the root follows the documented policy.
- `<script>alert(1)</script>` in a filename, JSX text, or attribute is displayed as text in HTML.
- A target project's `package.json` scripts are never executed.
- Malformed and deeply nested JSX cannot corrupt another file's results.
- Output write failure is reported without claiming success.
- Dependency audit results and accepted exceptions are recorded.

## Production-context statement

The MVP is local and does not expose an HTTP service, authentication layer, database, or WAF. Do not
invent those controls. Security evaluation must focus on the actual architecture while explaining
what would change if UXAudit later became a hosted service.

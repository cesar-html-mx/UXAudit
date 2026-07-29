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

- During discovery, `../../` and equivalent descendant inputs do not escape the user-selected
  canonical root. Selecting a root through `..` is itself allowed because the CLI user authorizes
  that root explicitly.
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

## M01 implemented controls and limits

- The project root is canonicalized, checked as a directory, and preflighted for read/search access.
- Missing, non-directory, denied, and unknown filesystem failures become typed errors. The CLI does
  not print their native causes.
- The CLI renders C0/C1 controls, bidirectional controls, injected line breaks, and Unicode line
  separators in untrusted paths and error values as visible escapes before writing to terminal
  streams.
- Product behavior uses Node filesystem APIs and does not execute a shell or target code.
- Direct dependencies are exact and locked; npm rejects engine/peer conflicts and unreviewed install
  scripts. esbuild `0.28.1` is the only approved dependency script, while optional fsevents scripts
  are explicitly denied.
- CI uses minimum permissions, immutable action SHAs, dependency audit, and conditional CodeQL and
  Dependency Review based on repository visibility/GitHub Code Security availability. Audit and
  dependency-review gates reject moderate-or-higher vulnerabilities.

Root access may change after validation, and `X_OK`/ACL behavior differs by platform. M02 must treat
preflight as advisory, handle actual traversal failures, detect symlink cycles, and enforce canonical
descendant containment.

## M02 implemented traversal controls

- Discovery revalidates the canonical root and every queued directory immediately before
  enumeration. Root loss is a typed fatal failure; descendant failures become stable recoverable
  issues without native messages or absolute-path disclosure.
- Directory names and normalized results use explicit ordinal ordering rather than
  locale-dependent filesystem order.
- The default policy does not follow symbolic links. The internal `follow-within-root` opt-in
  resolves targets, checks containment with `path.relative`, reapplies exclusions to the canonical
  target, and uses visited canonical directories to stop aliases and cycles.
- Excluded entries are rejected before a link is resolved, and canonical targets under excluded
  directories are rejected again to prevent alias-based bypass.
- POSIX sibling-prefix, Windows drive/separator, external-link, broken-link, cycle, race, access,
  and unsupported-entry scenarios are covered with temporary trees and an injected filesystem
  boundary.

Portable filesystem APIs cannot eliminate every race between validation and a later file read. M03
must treat the M02 inventory as a candidate list, canonicalize and verify containment again when
opening a file, and isolate changes that occur after discovery.

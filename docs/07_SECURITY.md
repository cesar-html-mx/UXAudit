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
  enumeration. Canonical containment and directory identity are checked before querying metadata for
  a retargeted path. Root loss is a typed fatal failure; descendant failures become stable
  recoverable issues without native messages or absolute-path disclosure.
- Directory names and normalized results use explicit ordinal ordering rather than
  locale-dependent filesystem order.
- The default policy does not follow symbolic links. The internal `follow-within-root` opt-in
  resolves targets, checks containment with `path.relative`, reapplies exclusions to the canonical
  target, and uses visited canonical directories to stop aliases and cycles.
- Unknown runtime policy values fail closed to default link skipping rather than entering the opt-in
  branch.
- Excluded entries are rejected before a link is resolved, and canonical targets under excluded
  directories are rejected again to prevent alias-based bypass.
- POSIX sibling-prefix, Windows drive/separator, external-link, broken-link, cycle, race, access,
  and unsupported-entry scenarios are covered with temporary trees and an injected filesystem
  boundary.
- The end-to-end controlled project contains a package-script sentinel and proves it is never
  created. Retained evidence is built from an isolated source copy with an allowlisted child
  environment, no inherited credential variables, rejected snapshot symlinks, pinned runtime and
  active-harness assertions, personal-path/token rejection, atomic initial publication, and a
  SHA-256 manifest that also covers the finalized milestone report.

Portable filesystem APIs cannot eliminate every race between validation and a later file read. M03
must treat the M02 inventory as a candidate list, canonicalize and verify containment again when
opening a file, and isolate changes that occur after discovery.

## M03 implemented source controls and limits

- Source reading accepts only a canonical absolute root whose directory identity remains stable.
  Each declared candidate must be an exact portable descendant, resolve to the expected canonical
  in-root file, and remain a regular file with the same device/inode, size, modification time, and
  change time across path and handle observations.
- POSIX opens request read-only, no-follow, and non-blocking behavior. Windows uses read-only plus
  the same descriptor/path identity checks. Content is read only through the verified handle, which
  is closed exactly once on success, recoverable failure, or fatal root loss.
- Each source is limited to 1 MiB; descriptor reads request no more than 64 KiB and can observe one
  extra byte to reject growth. Strict UTF-8 decoding fails closed on malformed bytes and deliberately
  preserves an initial BOM for the parser.
- Native filesystem/Babel errors, absolute paths, source bytes/text, AST values, and causes are not
  exposed by recoverable parser records or fatal application errors. Control and bidirectional
  characters remain untrusted model data and are escaped at the terminal boundary.
- A non-portable internal candidate path fails through a generic fatal invariant instead of being
  copied into a recoverable error record.
- The Babel composite parses supplied text only. It does not import a candidate, execute project
  configuration or package scripts, invoke a shell, or evaluate JSX expressions.
- Candidates run sequentially in deterministic order. Expected file-local read, syntax, and
  extraction problems do not corrupt or suppress safe sibling models; loss of root authorization,
  batch/model invariants, and unexpected extraction invariants stop processing.

Portable user-space checks cannot make pathnames permanently immutable. A replacement could still
occur between the last path observation and later external filesystem activity. UXAudit limits this
residual TOCTOU exposure by using only bytes read from the verified descriptor, comparing
path/descriptor identity before and after the bounded read, reauthorizing the root throughout, and
failing closed whenever an observable change occurs.

## M04 implemented rule controls and limits

- Rules receive only the normalized `AnalysisModel`; they do not read files, import parser nodes,
  execute target code, invoke a shell, or perform product network access.
- The registry validates and copies executable contracts, rejects duplicate IDs, deferred rules,
  incomplete metadata, and credential-bearing or non-HTTP(S) references, then freezes the accepted
  rules.
- Category/ID filters require plain own data, reject unknown values and keys, and fail closed on
  malformed containers or accessors. Experimental rules require exact ID opt-in.
- Before evaluation the engine deep-freezes the trusted model once. Thrown rules and malformed
  result batches become stable per-rule errors; safe sibling findings continue.
- Every non-null finding range must exactly match a canonical model location. Rules cannot inject an
  absolute/untraceable path, and native exceptions or project text do not enter normalized execution
  errors.
- Configurable rule factories inspect own descriptors without invoking getters, reject sparse or
  exotic containers, normalize throwing proxies to stable non-reflective errors, and copy accepted
  values into private deterministic sets/numbers.
- Stable catalog rules suppress dynamic/spread uncertainty or use explicit advisory wording and
  confidence. Custom components, rendered CSS, routing, viewport priority, and complete accessible
  context remain documented limitations instead of security or runtime claims.

The M04 engine is not yet connected to the CLI and does not write reports. M05 must preserve these
validated boundaries when loading user configuration and must treat every normalized finding field
as untrusted when rendering terminal, JSON, or HTML output.

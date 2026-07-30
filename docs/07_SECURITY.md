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
- M04 evidence runs in an allowlisted credential-free source copy, rejects snapshot mutation and
  noncanonical scenario JSON, and reauthorizes a regular in-repository destination immediately
  before atomic publication. Exact file allowlists, secret/path scans, a stable second-run
  comparison, and a SHA-256 manifest fail closed; finalization verifies the existing 20-artifact
  manifest before adding the milestone report.

The M06 CLI integration composes this engine with the M05 result/reporting boundaries without giving
rules filesystem, parser, reporter, or process access. Every normalized finding field remains
untrusted at presentation.

## M05-T02 implemented configuration controls and limits

- Configuration is inert JSON rather than an imported JavaScript/TypeScript module. Strict UTF-8
  decoding is bounded to 64 KiB, and malformed/oversized content fails through stable errors without
  retaining native causes or private paths.
- The conventional file is authorized as an exact canonical child of an unchanged canonical
  project root. Both conventional and explicitly selected files must remain regular with stable
  device/inode, size, modification-time, and change-time snapshots around a descriptor-only read.
  POSIX requests read-only, no-follow, and non-blocking flags; Windows uses read-only with the same
  portable identity checks.
- File and CLI layers are closed plain-data records. Accessors, proxies, sparse/exotic or
  oversized arrays, unknown keys/rules, duplicates, and invalid primitive values fail closed
  without invoking supplied getters.
- Output directories are bounded portable relative paths. Absolute paths, drive prefixes,
  backslashes, empty/dot components, controls/bidirectional overrides, invalid Windows characters,
  reserved device names, and ambiguous trailing dots/spaces are rejected before an
  `AuditResult` or writer target can be constructed.

An explicit configuration file is separate user authority and may be outside the analyzed project;
it is still subject to the regular-file and identity policy. Portable user-space checks cannot
eliminate every pathname race, so observed changes fail closed and only bytes from the verified
descriptor are parsed. M05-T04 still owns canonical output-directory authorization,
symlink-resistant creation, and exclusive report writes.

## M05-T03 implemented terminal controls

- The terminal reporter interpolates no raw project/result string. Each value is sanitized before
  structural separators or trusted ANSI are added, so injected newlines cannot forge report records
  and source-provided escapes cannot change terminal state.
- The shared sanitizer renders C0/C1 controls, ANSI/OSC bytes, bidirectional marks and isolates,
  Unicode line separators, BOM, and unpaired UTF-16 surrogates as visible lowercase `\uXXXX`
  sequences while preserving well-formed Unicode.
- Color is a normalized configuration value rather than TTY/environment behavior. Only fixed
  severity/stage badges receive ANSI; no-color output contains no escape character, and stripping
  reporter-owned ANSI produces the exact no-color bytes.
- Verbose mode exposes only already normalized recoverable error records. Native causes, stacks,
  source text, and additional absolute paths are not available to the reporter.

The M06 CLI writes this pure renderer's output directly and does not pass it through an assembled
output sanitizer that would neutralize trusted ANSI. Progress, diagnostics, and file-generation
claims continue to use the safe value boundary, while only the reporter introduces fixed color
sequences.

## M05-T04 implemented JSON and report-write controls

- JSON uses the standard encoder over the already validated complete result, so hostile strings
  remain data and no manually concatenated JSON syntax is trusted.
- The writer accepts only a closed plain request whose relative target exactly matches the validated
  configured directory and fixed format filename. Malformed objects, proxies, accessors, ill-formed
  UTF-16, absolute/ambiguous paths, and filename substitutions fail before filesystem mutation.
- Root and each directory segment must remain canonical in-root directories with stable
  device/inode identity. Segments are created individually with mode `0700`; the report is opened
  with `O_EXCL`, `O_CREAT`, `O_WRONLY`, POSIX `O_NOFOLLOW`, and mode `0600`.
- UTF-8 bytes are written positionally in chunks no larger than 64 KiB. Zero/oversized/invalid
  native write counts, write/sync/stat/close failures, link/identity/snapshot changes, and unsafe
  native error shapes become stable detail-free errors and never return a generated path.
- Path/handle identity and final size are checked around writing and again after close. Tests include
  real no-overwrite behavior plus injected root, ancestor, and target replacement windows.

Portable Node filesystem APIs do not provide a cross-platform `openat`/`openat2` transaction, and
some network filesystems may not honor local `O_EXCL` semantics identically. The controls detect
observable changes but cannot eliminate every pathname race. If a failure occurs after exclusive
creation, UXAudit deliberately leaves the possibly partial target: blindly unlinking that pathname
after an identity race could remove an attacker replacement. Only a returned `WrittenReport` may be
announced by the CLI as generated.

## M05-T05 implemented HTML controls

- The document has fixed trusted tags, IDs, classes, and CSS; no result value selects markup or
  style. It contains no script, event-handler attribute, form, frame, object, embedded resource,
  image, stylesheet link, `@import`, or CSS `url()`.
- An early CSP allows only the inline constant style and denies other default, script, object, base,
  and form sources/actions. The report is one local UTF-8 HTML5 file with no runtime service.
- Every dynamic value first uses the shared visible neutralization for C0/C1, ESC/terminal
  sequences, bidirectional marks/isolates, Unicode line separators, BOM, and lone surrogates, then
  escapes `&`, `<`, `>`, `"`, and `'` for HTML. Well-formed Unicode such as emoji remains intact.
- Reference URLs are distrusted again at presentation time, even if the object is forged as an
  `AuditResult`. Raw controls or directional formatting, malformed UTF-16, non-HTTP(S) schemes, and
  credentials make the reference inert. Accepted links use the parsed URL in the escaped attribute,
  while the original value remains escaped text.
- HTML never hides errors through `verbose` or findings through `minimumSeverity`, so security and
  processing records remain reviewable. Null/empty values and every zero bucket are explicit.

XSS validation consists of hostile fixtures, start-tag/attribute inspection, escaping assertions,
CSP inspection, and absence of executable/resource-bearing markup. It does not execute a browser
and must not be described as a runtime exploit test. File persistence continues to use the T04
writer and inherits its residual portable-filesystem limits.

## M06-T01 implemented integration controls and limits

- The project root is canonicalized before configuration loading. Conventional configuration stays
  in-root; an explicit path remains separate user authority. Configuration completes before
  discovery, source reads, or parsing.
- Commander contributes only values explicitly sourced from the CLI. Its absent `--no-color`
  default cannot override a file value, and repeatable selections are deduplicated before closed
  configuration validation.
- Rules receive the existing normalized model once, and all reporters receive the same frozen
  `AuditResult`. Target project modules, package scripts, configuration modules, and shells remain
  unexecuted.
- Progress, Commander diagnostics, typed failures, and writer-confirmed relative paths sanitize
  every dynamic value. The terminal reporter retains its own per-value sanitization and fixed ANSI.
- Selected result paths are not treated as persistence receipts. JSON is attempted before HTML, and
  only exact returned writer records are announced. An existing target or later write failure uses
  exit `3`, produces no completed report-set claim, and triggers no unsafe rollback.
- Findings and normalized recoverable errors use exit `0`; configuration/path input uses `2`. Exit
  `1` remains unused because no finding-failure policy exists.

Those focused integration controls and compiled smokes were subsequently complemented by M06-T04's
complete hostile-project, symlink, dependency, permission, performance, and security-checklist
execution.

## M06-T04 executed system security controls and limits

- A shell-free runner exercised 15 complete built-CLI cases on Linux, and every executable
  assertion passed. Real project-root and report-output permission denials produced the stable
  documented failures; capability-aware fallbacks remain available for platforms where `chmod`
  cannot reproduce denial.
- The hostile project created all three requested symbolic links. Internal, external, and cyclic
  links were excluded under the default policy, the scan terminated, and no linked source escaped
  into findings. Project/package-script sentinels remained absent throughout hostile, malformed,
  overwrite, and large-project execution.
- Project-relative output escape was rejected before writing. An output-directory symlink targeting
  an external directory was rejected without creating an external report. Repeating a successful
  JSON write returned the exclusive-target error, emitted no generated-report claim, and preserved
  the original report bytes.
- The hostile JSON report remained parseable with the original filename as data. Structural HTML
  validation confirmed escaped hostile path text, the exact restrictive CSP, no executable or
  resource-bearing tags, no event-handler attributes, no CSS resource loading, and no raw control
  or bidirectional characters. This establishes renderer structure and escaping, not runtime browser
  exploit resistance.
- A 32-directory-deep controlled source and two fresh hostile roots completed; the hostile outputs
  produced equal stable JSON and normalized HTML. Five complete scans of the generated 240-file
  project recorded elapsed-time distributions and the maximum child `VmRSS` observed by 5 ms
  `/proc` sampling; this is not claimed as an exact lifetime peak, and no environment-specific
  performance threshold was imposed.
- The locked, exact dependency set and strict install policy passed inspection, and
  `npm audit --audit-level=moderate --json` reported zero vulnerabilities. No hosted CodeQL result
  was retrieved, so CodeQL is truthfully recorded as unexecuted rather than inferred from the local
  workflow file.

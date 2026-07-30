[Español](es/07_SECURITY.md) | **English**

# Security and privacy

## Security model

UXAudit analyzes repositories that may be untrusted. Source files, names, paths, configuration, parser
input, rule observations, and report values are treated as untrusted data.

The product runs locally. A scan does not require a network connection and UXAudit has no telemetry,
hosted service, database, or upload path. Package installation may contact the configured npm
registry, but running the installed CLI does not send project data anywhere.

## Trust boundaries

| Boundary          | Untrusted input                                         | Required outcome                                      |
| ----------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| CLI               | Arguments, paths, and terminal-facing values            | Validate input and render stable single-line records. |
| Project traversal | Directory entries, links, permissions, and path changes | Stay inside the canonical root and prevent cycles.    |
| Source reader     | File identity, size, encoding, and concurrent changes   | Read a bounded regular file or fail closed.           |
| Parser            | Arbitrary JavaScript, TypeScript, JSX, and TSX text     | Return normalized data or a safe typed failure.       |
| Configuration     | Local JSON structure and output paths                   | Accept only a closed inert schema.                    |
| Rule engine       | Rule definitions and observations                       | Validate contracts and isolate safe failures.         |
| Reporters         | Findings, paths, messages, references, and metadata     | Escape for terminal, JSON, or HTML context.           |
| Report writer     | Output directories and filesystem races                 | Write only new authorized in-root files.              |

## Project traversal controls

- The selected directory is resolved to a canonical root before analysis.
- Empty paths, missing paths, regular files, and inaccessible roots are rejected.
- Symbolic links are skipped by default.
- Internal link-following support, when used programmatically, accepts only canonical in-root targets
  and tracks identities to prevent cycles.
- Common dependencies, caches, generated output, coverage, version-control metadata, and
  configuration files are excluded before source reads.
- Directory and inventory order is deterministic so hostile enumeration order cannot change results.
- Descendant permission or disappearance failures are normalized instead of exposing native details.

## Source reading and parsing controls

- Discovery does not permanently authorize a source. Root and candidate paths are revalidated around
  each descriptor-based read.
- Sources must be regular files inside the canonical root and may contain at most 1 MiB.
- Reads use chunks no larger than 64 KiB and compare file identity and metadata around the operation.
- UTF-8 decoding is strict; invalid encoding is a safe per-file failure.
- Babel parses text as syntax only. Project modules and configuration modules are never imported or
  executed.
- Raw source, syntax trees, and native parser errors remain inside the parsing boundary.
- Per-file failures can be isolated so safe siblings continue.

These controls reduce path traversal and common time-of-check/time-of-use risk, but no userspace
program can eliminate every concurrent privileged filesystem race. Do not scan an actively hostile
tree with greater privileges than necessary.

## Configuration controls

`uxaudit.config.json` and files selected with `--config` are inert JSON. UXAudit accepts a plain
closed object with `schemaVersion: 1`, known keys, bounded dense arrays, unique valid values, and safe
portable output directories.

The reader rejects links for the conventional in-root file, non-regular files, invalid UTF-8,
oversized data, malformed JSON, accessors, proxies, unknown keys, and invalid values. Configuration
is never evaluated as JavaScript.

## Rule-engine controls

Rules receive a recursively immutable normalized model and cannot access the parser tree through the
public contract. Registry and evaluation boundaries validate IDs, metadata, locations, observations,
and result shape. A rule exception becomes a safe normalized processing error when isolation can
preserve the rest of the audit.

The initial registry is code-owned. UXAudit does not load plugins or rule modules from the analyzed
project.

## Terminal controls

Dynamic terminal values are converted to well-formed visible text. Control characters, escape bytes,
line separators, and bidirectional controls are represented safely so untrusted names cannot inject
new records, color sequences, or reordered text.

Color is limited to fixed application-owned badges. `--no-color` produces output without ANSI escape
sequences. Native exceptions, raw source, and uncontrolled values are not printed directly.

## JSON and HTML controls

JSON serialization uses the validated normalized result. Consumers should still treat a report as
data from an untrusted project and validate it against the published schema when crossing another
trust boundary.

HTML reports:

- escape project-derived text after hostile Unicode is made visible;
- contain fixed embedded CSS with no scripts or external assets;
- set a restrictive Content Security Policy;
- allow a link only when a normalized reference is reparsed as credential-free HTTP(S);
- render any other reference as inert text.

The report is designed for local inspection. Opening any file derived from untrusted input still
belongs in a current, sandboxed browser.

## Report-writing controls

JSON and HTML paths are fixed filenames below a validated portable relative directory. The writer:

- reauthorizes the canonical project root and every directory segment;
- rejects absolute paths, parent traversal, links, path escape, and unsafe portable names;
- creates directories and files with restrictive permissions;
- opens report targets exclusively and never overwrites an existing file;
- writes in bounded chunks, synchronizes, closes, and reauthorizes before confirming success.

If a later write fails, an earlier report or partial target can remain. Automatic deletion is avoided
because a pathname race could make rollback delete a different file. Inspect the error and choose a
fresh destination before retrying.

## Dependency and release controls

Direct dependencies are pinned exactly, the lockfile is committed, dependency install scripts are
allowlisted, and the release gate includes a dependency audit and package-boundary installation
test. CI uses supported Node.js platforms and should keep third-party actions pinned to reviewed
immutable revisions.

No dependency control guarantees the absence of supply-chain risk. Review updates, lockfile changes,
published tarball contents, and provenance before release.

## Residual limitations

- Static analysis is not a security scanner for the target application.
- UXAudit does not inspect runtime DOM, browser policy enforcement, network requests, or server code.
- Findings do not certify WCAG, SEO, performance, privacy, or security compliance.
- A person who can alter the project concurrently may still cause denial of service or platform-level
  races; run with least privilege on a stable checkout.
- Terminal, JSON, and HTML reports include the canonical absolute project root. They can also contain
  project-relative source paths, findings, and timing. Review or redact them before sharing and
  handle them according to the project's confidentiality requirements.

## Report a vulnerability

Do not include confidential source code, credentials, or exploit details in a public issue. Follow
the private reporting instructions in the repository [security policy](../.github/SECURITY.md).
For ordinary non-sensitive defects and false positives, use the public issue tracker.

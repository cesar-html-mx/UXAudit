# Decision Log

## D-001 — Local command-line product

UXAudit will be a local CLI. A server, account system, database, and hosted UI are outside the initial
scope.

## D-002 — Static analysis boundary

The initial version analyzes source code without executing the target application. Dynamic usability,
browser behavior, runtime performance, and complete rendered-page SEO remain explicit limitations.

## D-003 — React and TypeScript focus

The initial ecosystem is React with TypeScript, while `.js` and `.jsx` remain accepted for mixed
projects. Other frameworks require a future parser/model adapter decision.

## D-004 — Normalized analysis model

Babel AST structures remain inside the parsing boundary. Rules consume UXAudit domain models so
that the rule catalog is not coupled directly to parser internals.

## D-005 — File-based persistence

Configuration and outputs use local JSON, HTML, and optional log files. Transient analysis state stays
in memory. No database is required.

## D-006 — Independent rules and reporters

Rules are independently executable and return normalized findings. Reporters consume one
`AuditResult` and do not rerun analysis.

## D-007 — Incremental delivery

The project follows the six increments already defined in the TFM. Each milestone must leave a
verifiable working capability.

## D-008 — Agent harness location

The root `AGENTS.md` is the entry point. Orchestration lives under `.github/harness`, reusable Codex
skills under `.agents/skills`, and durable product knowledge under `docs/`.

## D-009 — Node.js 24 and current compatible toolchain

- Date: 2026-07-29
- Status: accepted
- Context: The owner explicitly requested a clean M01 restart using Node.js 24 and the best current
  stable industry tooling. Node.js 20 is end-of-life, while Node.js 24 is the current LTS line.
- Decision: Require Node.js `>=24.18.0 <25` and npm `>=11.16.0 <12`, pin local development to Node.js
  `24.18.0`, compile ESM for ES2024, and pin direct dependencies exactly. Use the latest stable
  package version only when its declared engine and peer contracts are satisfied.
- Alternatives considered: Retaining Node.js 20 compatibility; using the shell-default Node.js 22;
  or forcing TypeScript 7 despite TypeScript ESLint's `<6.1.0` peer range.
- Consequences: The project intentionally drops Node.js 20/22 support. TypeScript remains on 6.0.3
  until stable TypeScript ESLint supports 7. Untested Node/npm future majors are rejected. npm
  install scripts are strictly reviewed: esbuild is version-pinned and fsevents is denied.
- Requirements/contracts affected: RNF-03, RNF-09, and the M01 runtime contract.
- Evidence: `.nvmrc`, `.npmrc`, `package.json`, `package-lock.json`, registry metadata, and passing
  Node.js 24 typecheck/build commands.

## D-010 — Unified strict quality gate

- Date: 2026-07-29
- Status: accepted
- Context: M01 needs one reproducible developer and CI gate while keeping each underlying check
  independently runnable and diagnosable.
- Decision: Use ESLint 10 flat configuration with typed strict/stylistic rules, Prettier as the
  repository formatter, Vitest with V8 coverage and 90% global thresholds, strict TypeScript
  compiler checks, and Husky 9 to invoke `npm run verify` before commits. Treat warnings as
  failures and enforce npm engine, exact-version, peer-dependency, and install-script policies.
- Alternatives considered: Legacy `.eslintrc`; untyped linting; floating dependency ranges; forcing
  incompatible peer versions; or duplicating gate commands inside the Git hook.
- Consequences: Local commits perform the same product gate later used by CI. The minimal
  process-boundary entry point is excluded from unit coverage and must be exercised by portable
  smoke tests in M01-T05.
- Requirements/contracts affected: RNF-03, RNF-09, and M01 quality acceptance.
- Evidence: `eslint.config.mjs`, `vitest.config.ts`, `.prettierrc.json`, `.husky/pre-commit`,
  `tests/product.test.ts`, and passing Node.js 24 `npm run verify`/coverage output.

## D-011 — Testable CLI boundary and exit codes

- Date: 2026-07-29
- Status: accepted
- Context: Commander must not contain application validation and product behavior must be testable
  without shell execution or mutation of global process state.
- Decision: Keep the executable boundary in `src/cli/index.ts`; inject application behavior and
  output streams into `runCli`; use exit code 0 for success/help/version, 2 for command or user-input
  errors, and 3 for unexpected internal failures. M01-T03 reports only that a scan request was
  prepared.
- Alternatives considered: Calling `process.exit` from Commander actions; validating paths in
  argument definitions; spawning the CLI for every unit assertion; or implying discovery before
  M02.
- Consequences: CLI behavior is deterministic and unit-testable. M01-T04 can add typed path
  validation behind the existing application function without changing the command grammar.
- Requirements/contracts affected: RF-01, RNF-01, RNF-03, and the M01 CLI contract.
- Evidence: `src/cli/run-cli.ts`, `src/application/scan-project.ts`, CLI/application unit tests, and
  built `--help`, `--version`, `scan .`, and missing-argument checks.

## D-012 — Canonical project-root validation

- Date: 2026-07-29
- Status: accepted
- Context: RF-02 requires early, portable validation without traversing the project or executing
  target code, while native filesystem errors and paths must not leak through the CLI.
- Decision: Resolve and canonicalize the requested root, require directory status, and preflight
  read/search access through an injectable Node filesystem adapter. Map `ENOENT`/`ENOTDIR` and
  access-denial codes to stable typed input errors; map unknown filesystem failures to a typed
  operational error and exit 3. Return the canonical path exactly as supplied by `realpath`.
- Alternatives considered: Synchronous filesystem calls; validating inside Commander; testing
  permissions with `chmod`; comparing native error text; or constraining the selected root to the
  current working directory.
- Consequences: Tests are portable across Linux, Windows, and macOS and the CLI does not expose
  native causes. The access check remains susceptible to TOCTOU, and M02 must enforce canonical
  containment and handle failures during actual traversal.
- Requirements/contracts affected: RF-02, RNF-01, RNF-03, and the M01 path/exit contract.
- Evidence: `src/project/validate-project-path.ts`, application/CLI integration, focused path tests,
  100% measured unit coverage, and built valid/missing/file/empty-path checks.

## D-013 — Immutable Node.js 24 CI and sanitized evidence

- Date: 2026-07-29
- Status: accepted
- Context: M01 must verify the supported runtime across major operating systems without trusting
  mutable action tags or publishing local secrets and personal paths in retained evidence.
- Decision: Run the shared Node.js 24 gate and shell-free CLI smokes on Ubuntu 24.04, Windows 2025,
  and macOS 15. Pin every GitHub action to a full release SHA, disable persisted credentials, grant
  minimum permissions, and run Linux coverage/audit checks with a moderate-severity threshold.
  Generate evidence from an isolated working-tree copy, identify that snapshot with a deterministic
  SHA-256 tree digest, hash every retained core artifact in a SHA-256 manifest, and reject
  GitHub-token and personal-home patterns before publication.
- Alternatives considered: Mutable action tags; Node.js 26 Current in the support matrix; Linux-only
  checks; direct logging from the developer workspace; or always enabling Dependency Review where
  GitHub Code Security may be unavailable.
- Consequences: The workflows are deterministic at known action revisions and test the complete
  supported OS surface. Dependency Review is conditional for private repositories, and remote CI
  execution remains unverified until a safely authenticated push. A reproducibility rerun rejects
  incomplete, unsanitized, integrity-invalid, or source/result-mismatched retained evidence.
- Requirements/contracts affected: RNF-03, RNF-09, M01 quality acceptance, and evidence policy.
- Evidence: `.github/workflows/`, `scripts/smoke-cli.mjs`,
  `scripts/collect-m01-evidence.mjs`, and `evidence/m01-bootstrap/`.

## D-014 — Visible escaping at the terminal boundary

- Date: 2026-07-29
- Status: accepted
- Context: Canonical paths, Commander diagnostics, and unexpected error messages can contain
  attacker-controlled terminal controls or bidirectional formatting characters.
- Decision: Preserve canonical path values in application results, but render unsafe C0/C1,
  bidirectional, and Unicode line-separator characters as visible `\uXXXX` escapes at the CLI
  output boundary. Escape reflected line feeds while preserving the structural final newline and
  static multiline help generated by the framework.
- Alternatives considered: Printing raw strings; stripping only ANSI color sequences; deleting
  controls invisibly; or escaping canonical paths before application validation.
- Consequences: Terminal output cannot execute ANSI/OSC control sequences from selected project
  names or reflected errors, while ordinary path output and multiline help remain readable.
- Requirements/contracts affected: RF-01, RF-02, RNF-01, and the M01 terminal-output contract.
- Evidence: `src/cli/sanitize-terminal.ts`, hostile CLI unit tests, coverage, and compiled smokes.

## D-015 — Explicit, secure-by-default symlink policy

- Date: 2026-07-29
- Status: accepted
- Context: M02 must support portable project discovery without following an untrusted link outside
  the canonical root or entering a cycle. Some React projects also use intentional in-root links,
  so permanently rejecting every link would prevent a controlled future opt-in.
- Decision: Discovery uses an explicit `skip | follow-within-root` policy and defaults to `skip`.
  The opt-in mode resolves every target canonically, checks containment with path-relative
  semantics, reapplies exclusions to the canonical target, and tracks visited canonical
  directories. Discovery, inventory, and source classification expose separate immutable
  contracts and never label a source candidate as a React component.
- Alternatives considered: Following every link; using string-prefix containment; or having no
  opt-in mode.
- Consequences: Default scans have the smallest attack surface. Projects that deliberately use
  internal links can opt in once configuration is surfaced, while external, broken, cyclic, and
  duplicate link behavior remains observable and testable. Unknown runtime values fail closed to
  link skipping rather than entering the opt-in branch. Portable Node APIs cannot eliminate all
  filesystem races, so M03 must revalidate a file when opening it for parsing.
- Requirements/contracts affected: RF-03 through RF-06, RNF-04, RNF-07, RNF-09, R-004, and R-015.
- Evidence: M02 discovery contracts, controlled traversal tests, and
  `evidence/m02-discovery/`.

## D-016 — Canonical inventory identity and portable ordering

- Date: 2026-07-29
- Status: accepted
- Context: RF-05 requires normalized absolute and relative locations with no duplicates and RNF-04
  requires stable results across repeated execution.
- Decision: Use the discovered canonical absolute path as inventory identity, derive a `/`-separated
  relative path from the canonical root, normalize the final extension to lowercase, and sort
  ordinally by relative path. Reject root, relative, sibling-prefix, ancestor, or other outside-root
  records as invariant failures.
- Alternatives considered: Deduplicating observed aliases; locale-aware sorting; comparing content;
  or performing additional device/inode calls to merge hard links.
- Consequences: Symlink aliases collapse deterministically and unsupported files remain available to
  the separate classifier. Hard links at distinct canonical paths remain separate entries because
  they are independently addressable locations; this is an explicit limitation rather than an
  unsupported physical-identity claim.
- Requirements/contracts affected: RF-05, RNF-04, RNF-07, and RNF-09.
- Evidence: `src/project/inventory/`, focused normalization/deduplication tests, and
  `evidence/m02-discovery/`.

## D-017 — Syntactic source-candidate classification

- Date: 2026-07-29
- Status: accepted
- Context: RF-06 needs source candidates for M03 without parsing in M02 or falsely describing every
  TypeScript file as a React component.
- Decision: Derive the actual suffix from the normalized relative path, accept
  `.js`/`.jsx`/`.ts`/`.tsx` case-insensitively, and map only to JavaScript/TypeScript plus
  JSX/non-JSX source kinds. Exclude `.d.ts`, `config.*`, and `*.config.*` paths before parsing. Do
  not read content or add React/component fields.
- Alternatives considered: Trusting inventory extension metadata; selecting every supported suffix;
  scanning file text for imports or JSX; or identifying components before the parser/model
  milestone.
- Consequences: Classification is deterministic, cheap, and does not duplicate M03 parsing.
  Conventionally named configuration files are excluded, with the explicit limitation that an
  unusually named runtime source such as `config.ts` is also omitted.
- Requirements/contracts affected: RF-04, RF-06, RNF-04, RNF-07, and RNF-08.
- Evidence: `src/project/classification/`, the supported/rejected candidate matrix, and
  `evidence/m02-discovery/`.

## D-018 — Retained discovery pipeline and stable CLI summary

- Date: 2026-07-29
- Status: accepted
- Context: M02 must connect discovery to the CLI without collapsing project-layer boundaries,
  discarding data required by M03, changing M01's established first output line, or claiming a
  completed audit.
- Decision: Compose `validation → discovery → inventory → classification` in the application layer
  and return each normalized stage result plus five counts. Preserve
  `Project path validated: <canonical-root>` and append one fixed-order `Discovery summary` line.
  Treat only invalid path input as exit 2; fatal validation or pipeline-stage failures become stable
  exit-3 application errors, while recoverable descendant issues remain in the result and count.
- Alternatives considered: Returning only counts; placing traversal in Commander; flattening all
  errors into input failures; treating every descendant issue as fatal; or constructing an
  incomplete `AuditResult`.
- Consequences: M03 can consume the exact candidates and discovery issues without rediscovery, CLI
  compatibility remains explicit, and users can distinguish inventory progress from a future audit.
  The complete transient inventory remains in memory, and parsing-time file authorization is still
  required.
- Requirements/contracts affected: RF-01, RF-03 through RF-06, RNF-01, RNF-04, RNF-07, RNF-08,
  and the M01 exit-code boundary.
- Evidence: `src/application/scan-project.ts`, `src/cli/run-cli.ts`, application/CLI integration
  tests, compiled smoke tests, and `evidence/m02-discovery/`.

## D-019 — Babel 8 isolated parser boundary

- Date: 2026-07-29
- Status: accepted
- Context: M03 needs current JS, JSX, TS, and TSX syntax support without exposing a parser-specific
  tree to rules or relying on Babel packages that happen to exist under a development-only
  transitive dependency.
- Decision: Declare exact production dependencies on `@babel/parser`, `@babel/traverse`, and
  `@babel/types` `8.0.4`, the current stable releases verified from registry metadata. Keep every
  Babel type and value below `src/parsing/babel/`. Parse with locations, `sourceType:
'unambiguous'`, no recovery or target configuration loading, and plugins selected only from the
  M02 source kind: TypeScript for `.ts`, JSX for `.jsx`, and both for `.tsx`. Plain `.js` does not
  silently enable JSX. Convert every success and failure to UXAudit-owned contracts before leaving
  the parsing package.
- Alternatives considered: Babel 7; TypeScript compiler AST; enabling every syntax plugin for every
  extension; using `errorRecovery`; exposing Babel nodes behind `unknown`; or relying on Vitest's
  incidental Babel tree.
- Consequences: The parser uses the newest stable line compatible with Node.js `24.18.0`, has an
  explicit locked runtime supply chain, and cannot couple M04 rules to Babel. Flow, decorators, JSX
  in `.js`, and other opt-in proposal syntax remain unsupported unless a later requirement and
  fixture justify them. A malformed file yields no partial model.
- Requirements/contracts affected: RF-07, RF-08, RF-12, RNF-02, RNF-03, RNF-08, R-003, and R-010.
- Evidence: M03 four-kind parser matrix, negative plugin cases, declaration-boundary checks,
  dependency audit, and `evidence/m03-parsing/`.

## D-020 — AST-free relational JSX model and confidence

- Date: 2026-07-29
- Status: accepted
- Context: M04 rules need element names, selected values, descendant text, relationships, and exact
  locations, but dynamic JSX and component abstractions cannot be evaluated reliably by a local
  static parser.
- Decision: Use a plain readonly relational model of files, syntactically justified components,
  JSX elements/fragments, parent/child and ownership IDs, named/spread attributes, and static text.
  Preserve primitive literals and recursively bounded static object properties; represent
  expressions and unknown spread content as dynamic or partial instead of guessing. Intrinsic tags
  remain distinct from custom/member components. Named PascalCase functions become components only
  when they directly own JSX; direct default exports may be anonymous, and supported React classes
  own JSX only through instance `render` methods. Attribute values and nested executable boundaries
  start separate JSX roots instead of being presented as rendered children. Source locations carry
  portable relative file paths, one-based lines, zero-based UTF-16 columns and offsets, and
  end-exclusive ranges. Stable IDs derive from the relative file path, entity kind, and source
  offset.
- Alternatives considered: Retaining the Babel AST; nested cyclic objects; flattening dynamic
  values to strings; resolving imports and aliases; rendering components; or treating all
  PascalCase functions as React components.
- Consequences: The model is deterministic, serializable, parser-independent, and sufficient for
  the initial catalog's `img`, input/label, button, heading, link, image-dimension/loading, and
  literal `style.fontSize` checks. Rules must respect exact/partial/dynamic confidence. Runtime
  component behavior, imported aliases, external CSS, and evaluated expressions remain explicit
  limitations.
- Requirements/contracts affected: RF-08, RF-12, RNF-02 through RNF-05, R-001, R-002, and R-008.
- Evidence: Contract tests, extraction fixtures, expected/actual model samples, location assertions,
  serialization checks, and `evidence/m03-parsing/`.

## D-021 — Authorized bounded source processing

- Date: 2026-07-29
- Status: accepted
- Context: M02 inventory entries remain untrusted candidates when M03 opens them. A path, target,
  type, size, or byte sequence can change after discovery, and a syntactically valid but extremely
  large/deep file can consume disproportionate parser resources.
- Decision: Limit one source file to `1_048_576` bytes and one extraction traversal to at most
  `100_000` Babel nodes. Maintain ownership and JSX-parent contexts during that traversal instead of
  rescanning ancestor chains. Retain at most `256` UTF-16 code units of descendant text per JSX
  node and mark truncation as partial. Reauthorize the canonical root and expected canonical file
  immediately around a read-only file-handle open; use no-follow/non-blocking flags on platforms
  that support them; compare path and handle type/device/inode metadata; read only through that
  handle in bounded chunks; detect growth or mutation; and close in `finally`. Decode with
  `TextDecoder('utf-8', { fatal: true, ignoreBOM: true })`, preserving an initial U+FEFF so UTF-16
  offsets describe the exact JavaScript string supplied to Babel. Every expected file-local
  failure is stable and recoverable; a non-portable candidate declaration, root loss, or model
  invariant remains fatal and detail-free.
- Alternatives considered: `readFile(path)` after a preflight; following final symlinks; replacing
  malformed UTF-8; stripping BOM; unlimited parsing/traversal; arbitrary timing-based test limits;
  or keeping a partial AST/model after a resource error.
- Consequences: Normal authored sources remain single-pass and deterministic while oversized,
  non-regular, retargeted, changed, invalid-encoding, or extraction-heavy candidates cannot discard
  safe sibling results. Extremely long static labels remain useful for presence checks but are
  explicitly partial rather than copied through every ancestor. Portable filesystem APIs still
  cannot eliminate every race, and Windows lacks the full POSIX open-flag set; post-open
  handle/path comparison and documented residual risk remain necessary.
- Requirements/contracts affected: RF-07, RF-08, RNF-03, RNF-04, RNF-07, RNF-09, R-003, R-006,
  and R-015.
- Evidence: extraction-limit tests, source-open race/type/size/encoding tests, malformed sibling
  isolation, parser baseline, no-execution scenario, and `evidence/m03-parsing/`.

## D-022 — Defensive canonical analysis-model construction

- Date: 2026-07-29
- Status: accepted
- Context: Per-file parser output is an internal boundary, but rules need one deterministic project
  model whose identities, coordinates, ownership, and values cannot be corrupted by an adapter bug
  or retained parser reference.
- Decision: Reproject every per-file value into fresh UXAudit-owned objects and validate the entire
  graph before returning it. File paths must be non-empty slash-separated relative paths without
  absolute, drive, traversal, empty-segment, or backslash syntax; control and bidirectional
  characters remain untrusted filename data for later reporters to escape. Locations must use safe
  half-open UTF-16 coordinates, agree at shared offsets, remain within their file and owning
  containers, and advance consistently. IDs derive exactly from file path and start offset. File,
  component, root, ownership, parent, and child arrays must equal the canonical source-order graph;
  every component owns JSX and at least one root. Literal/object/text confidence must be internally
  consistent, numbers finite, structured values bounded and cycle-safe, and all invalid input must
  stop with one detail-free `AnalysisModelInvariantError`. Do not add query helpers before a rule
  demonstrates a concrete need.
- Alternatives considered: Trusting parser output; shallow copying; retaining nested input
  references; silently repairing broken relationships; accepting absolute or platform-separator
  paths; returning the first detailed invariant failure; or adding speculative indexes/helpers.
- Consequences: Equivalent per-file input order produces byte-identical project models, attributes
  and object properties retain source order, parser/source extras cannot cross the domain boundary,
  and later rules can rely on reciprocal relationships. A model invariant is fatal rather than
  isolated because continuing could produce unsound findings. Hostile path characters remain data,
  so every reporter must still apply its output-context escaping policy.
- Requirements/contracts affected: RF-08, RF-12, RNF-02, RNF-03, RNF-04, RNF-05, R-001, R-002,
  R-008, and R-014.
- Evidence: model projection/immutability tests, reverse-input serialization, ID/location/value
  invariant matrices, cycle and cross-file cases, prototype-sensitive keys, generic-error
  redaction, and `evidence/m03-parsing/`.

## D-023 — Additive sequential source-analysis integration

- Date: 2026-07-29
- Status: accepted
- Context: M03 must connect the completed discovery pipeline to parsing and model construction
  without changing M02's published `scanProject` contract. Expected read, syntax, and extraction
  failures affect one candidate, while root authorization, parser bookkeeping, and model integrity
  failures make the project result unsafe.
- Decision: Add `analyzeProject` as a separate application facade over the unchanged `scanProject`.
  Sort a copy of candidates ordinally, reject duplicate or non-portable paths, parse one candidate
  at a time, retain successful analyzed files and recoverable parser errors in separate ordered
  arrays, and build one model only after the batch finishes. A parser result whose path does not
  match its candidate is a fatal invariant. Preserve existing two-line CLI scan output and let the
  production injection append one fixed-order parsing summary; callers that inject only
  `scanProject` retain the M02 behavior. Collapse fatal analysis/model details into stable
  application errors without native causes or project data.
- Alternatives considered: Mutating the existing scan result contract; parsing concurrently;
  stopping on the first malformed file; returning a partial model after an invariant failure;
  printing every parser error by default; or replacing the established discovery summary.
- Consequences: M04 receives a deterministic AST-free model even when a safe sibling is malformed,
  completed M02 callers remain compatible, and the CLI distinguishes discovery issues from parsing
  failures without claiming that rules ran. Sequential parsing bounds simultaneous source/AST
  memory but does not impose a whole-project candidate limit; project-scale performance remains an
  M06 validation concern.
- Requirements/contracts affected: RF-01, RF-07, RF-08, RF-12, RNF-01, RNF-03, RNF-04, RNF-07,
  RNF-08, R-003, R-006, R-014, and R-015.
- Evidence: batch isolation/invariant tests, real-filesystem application integration, compiled CLI
  scenario, no-execution sentinel, measurements, and `evidence/m03-parsing/`.

## D-024 — Self-contained rule and finding contracts

- Date: 2026-07-29
- Status: accepted
- Context: M04 rules need one typed, extensible input/output boundary while M05 reporters must later
  consume normalized results without loading rules again. The planning finding schema flattened
  source coordinates, but M03 already established a canonical half-open location with one-based
  lines and zero-based UTF-16 columns/offsets.
- Decision: A `Rule` owns complete immutable metadata and a synchronous model-only evaluation
  function that returns rule-local message, confidence, and nullable source-location observations.
  Normalize each observation into a self-contained `Finding` by copying the metadata, limitations,
  structured reference, and complete M03 `SourceLocation`; do not convert coordinates at the domain
  boundary.
  Keep finding confidence independent from default severity and catalog status. Represent an
  isolated rule failure as a stable recoverable `RuleExecutionError`, never as a finding, and keep
  explicit available/enabled/executed/succeeded/failed/finding counters in the report-independent
  result contract.
- Alternatives considered: Returning partially populated findings directly from every rule;
  flattening file/line/column and dropping the end range; using one value for severity and
  confidence; exposing thrown errors or native causes; asynchronous rule I/O; or requiring a
  reporter to reload rule metadata.
- Consequences: Reporters can consume one normalized record without reevaluation, every finding is
  traceable to a rule and canonical source range, and rule failures remain separately countable.
  M05 owns any display-coordinate conversion. Runtime validation and deterministic execution remain
  M04-T02 responsibilities.
- Requirements/contracts affected: RF-10 through RF-14, RNF-02 through RNF-05, RNF-10, R-007, and
  the rule/finding schemas.
- Evidence: `tests/domain/rules/rule-contracts.test.ts`, focused typecheck/lint, and the eventual
  `evidence/m04-rules/` package.

## D-025 — Validated deterministic rule execution

- Date: 2026-07-29
- Status: accepted
- Context: RF-09 through RF-11 require configurable rule selection and independent zero/one/multiple
  results, while RNF-04/RNF-05 require deterministic traceable output. A thrown rule or malformed
  extension result must not discard unrelated valid findings or introduce an untrusted path.
- Decision: Build an explicit registry that validates, copies, freezes, deduplicates, and ordinally
  sorts rules by ID. Permit only nullable credential-free HTTP(S) references and reject deferred
  executable rules. Treat category and ID allowlists as fail-closed validated intersections;
  absent filters enable required/stable rules, empty filters enable none, unknown IDs fail clearly,
  and experimental rules require exact ID opt-in. Deep-freeze the trusted model once, then execute
  each loaded rule synchronously exactly once. Validate its complete returned batch before accepting
  any finding, require every non-null location to equal a canonical location already present in the
  M03 model, and treat the same rule/message/location as duplicate regardless of confidence.
  Collapse thrown versus invalid-result failures into separate stable recoverable codes. Sort
  normalized findings by rule ID, portable path, source range, and message, and retain explicit
  available/enabled/executed/succeeded/failed/finding counters.
- Alternatives considered: Implicit filesystem discovery; registry insertion order; locale-aware
  sorting; silently ignoring unknown filters; accepting partial results before a malformed
  candidate; copying native exception messages; synthesizing arbitrary finding ranges; reparsing or
  cloning the full model per rule; permitting executable deferred rules or implicit experimental
  rules; accepting arbitrary URL schemes; or terminating on the first failure.
- Consequences: Equivalent registry/filter/model input produces stable normalized output, extension
  failures are isolated transactionally, and every source finding is traceable to trusted model
  evidence. One deep-freeze enforces the readonly model contract at runtime without duplicating the
  model per rule. Reference strings remain owned metadata, and future reporters still must escape
  them for their output context.
- Requirements/contracts affected: RF-09 through RF-12, RNF-02 through RNF-05, RNF-07, RNF-10,
  R-007, R-008, and R-014.
- Evidence: `tests/rules/rule-registry.test.ts`, `tests/rules/load-rules.test.ts`,
  `tests/rules/evaluate-rules.test.ts`, repeated serialization, full coverage gate, and the eventual
  `evidence/m04-rules/` package.

## D-026 — Conservative intrinsic accessibility scope

- Date: 2026-07-29
- Status: accepted
- Context: A11Y-001 through A11Y-003 must identify useful review situations without evaluating React
  or turning dynamic JSX, spreads, and component abstractions into false certainty. The catalog's
  `required` label expresses M04 delivery selection, while runtime metadata needs to express the
  validated maturity reached after implementation.
- Decision: Publish all three implemented accessibility rules with `stable` runtime status and keep
  “required for M04” as catalog planning provenance. Analyze exact intrinsic tag names only. Resolve
  attributes from right to left so a later spread makes an earlier value unknown. A11Y-001 is an
  explicit-`alt` presence check and does not score value quality. A11Y-002 covers intrinsic
  `input`/`select`/`textarea`, excludes exact hidden/button/submit/reset/image input types, accepts
  nested labels, recognized-same-component exact untrimmed `htmlFor`/`for` plus `id`, and exact
  non-empty ARIA names. Known `null` ARIA values are absence, while dynamic values remain unknown.
  A11Y-003 accepts retained non-empty static text or exact non-empty supported ARIA names. Suppress
  findings whenever dynamic-only evidence or a spread could satisfy the supported condition; keep
  excluded input types and unsupported nested-label cardinality in metadata, fixtures, and catalog
  documentation.
- Alternatives considered: Inferring custom components by name; ignoring JSX override order;
  flagging every dynamic or spread case; validating alternative-text quality; pairing labels across
  components; treating all input types as text controls; or claiming the complete accessible-name
  algorithm.
- Consequences: Findings are high-confidence inside a narrow reproducible static scope, while
  wrapper/alias/dynamic cases can remain false negatives and require review. The complete
  accessible-name algorithm, CSS visibility, runtime spread values, and ARIA target resolution
  remain explicit limitations rather than implicit claims.
- Requirements/contracts affected: RF-09 through RF-14, RNF-02 through RNF-07, R-001, R-002,
  R-007, and the A11Y-001/A11Y-002/A11Y-003 catalog contracts.
- Evidence: focused rule tests, `tests/fixtures/m04-rules/accessibility-cases.tsx.fixture`,
  `tests/rules/accessibility/accessibility-rules.integration.test.ts`, and the eventual
  `evidence/m04-rules/` package.

## D-027 — Explicit advisory scopes for performance, SEO, and UX rules

- Date: 2026-07-29
- Status: accepted
- Context: PERF-001/PERF-002, SEO-001/SEO-002, and UX-001 need useful static findings without
  claiming viewport priority, observed layout shift, rendered page composition, complete accessible
  context, or computed CSS. The M03 model retains exact/partial/dynamic evidence, component
  ownership, ordered JSX attributes/object properties, and canonical property locations.
- Decision: Publish all five rules as stable within narrow intrinsic scopes. PERF-001 emits a
  medium-confidence, low-severity review for absent/eager/invalid known `loading` values while
  suppressing dynamic/spread uncertainty. PERF-002 normally requires two positive integer
  dimensions, lets a proved missing/invalid sibling prevail over unrelated uncertainty, and treats
  literal zero-by-zero as content not intended for the user. SEO-001 emits one medium-confidence
  finding at the second intrinsic H1 of each recognized component and ignores unowned/project-wide
  aggregation. SEO-002 matches only exact static anchor text after NFKC/whitespace/case normalization
  against a descriptor-validated, dense replace-all phrase set. UX-001 reports the last exact
  literal inline `fontSize` property on eligible intrinsic known text when a finite non-negative
  numeric/px value is below an exclusively compared, validated `12px` default threshold; exact text
  has high confidence and partial text has medium confidence. Assemble these with the accessibility
  rules in one explicit eight-rule registry.
- Alternatives considered: Project-wide or file-wide H1 counts; inferring pages/routes, custom
  components, surrounding accessible names, above-fold position, CSS layout reservation, relative
  units, or computed styles; reporting dynamic/spread values as violations; treating all eager
  images as defects; or exposing mutable rule configuration through `RuleContext`.
- Consequences: The initial catalog has deterministic coverage in all four product categories and
  provides reviewable locations without runtime claims. It can miss wrapper, CSS, routed, and
  dynamic cases; advisory wording, confidence, metadata limitations, and boundary fixtures make
  those tradeoffs explicit. M05 can construct configured rule instances before registration without
  changing the evaluator contract.
- Requirements/contracts affected: RF-09 through RF-14, RNF-02 through RNF-07, RNF-10, R-001,
  R-002, R-011, PERF-001/PERF-002, SEO-001/SEO-002, and UX-001.
- Evidence: category-focused and registry integration tests, the eventual mixed-catalog scenario,
  independent semantic review, and `evidence/m04-rules/`.

## D-028 — Reviewed full-catalog scenario and isolated evidence lifecycle

- Date: 2026-07-29
- Status: accepted
- Context: M04 acceptance requires more than isolated rule tests: the exact eight-rule registry must
  demonstrate deterministic normalized output, filtering, metadata/limitations, and failure
  isolation over one realistic model. The CLI intentionally does not invoke rules until M05, so a
  CLI audit claim would violate the active boundary.
- Decision: Build and run a domain-level controlled TSX project through the production
  analyze-model and rule-engine modules. Version one full normalized expected result with exactly
  one finding for each stable rule, plus explicit safe/unsupported case mappings. Compare two
  serialized evaluations byte-for-byte; retain filters, metadata, limitations, finding samples, and
  one injected throwing-rule result that preserves all eight siblings. Reuse the M03 isolated
  evidence lifecycle: allowlisted source copy, credential-free child environment, clean locked
  install, full gates, exact no-skip/todo record, source digest, sanitized exact artifact contract,
  atomic initial publication, stable second-run comparison, and a finalizable SHA-256 manifest.
- Alternatives considered: Calling the scan-only CLI and implying rule integration; retaining only
  test console output; generating expected data without committing/reviewing it; project-wide
  aggregate counts without rule identity; overwriting evidence on rerun; or inheriting the parent
  environment and credentials.
- Consequences: M04 behavior is reproducible and auditable without changing the CLI contract.
  Expected/actual drift, missing rules, nondeterminism, failure contagion, skipped tests, source
  changes, noncanonical JSON, unsafe publication paths, extra evidence files, secrets, and manifest
  mismatch fail the scenario/collector. Finalization first verifies the exact base manifest before
  adding the report. The evidence is a controlled functional validation, not M06 precision/recall
  or hosted CI evidence.
- Requirements/contracts affected: RF-09 through RF-14, RNF-03 through RNF-07, RNF-09, RNF-10,
  M04 acceptance criteria, R-007, R-009, R-010, R-011, and R-012.
- Evidence: `tests/rules/initial-catalog.integration.test.ts`,
  `scripts/run-m04-scenario.mjs`, the expected fixture, two collector executions, and
  `evidence/m04-rules/`.

## D-029 — Versioned immutable configuration and AuditResult boundary

- Date: 2026-07-29
- Status: accepted
- Context: M04 returns deterministic findings, recoverable rule errors, and evaluation counters, but
  every M05 reporter needs the same complete result and configuration vocabulary. The planning
  schema did not define counters, processing-error variants, timing, output paths, or summary
  buckets, and allowing reporters to reconstruct those facts independently would introduce drift.
- Decision: Normalize configuration as schema version `1` with explicit category/rule filters,
  report formats, relative output directory, minimum display severity, color, and verbosity.
  `null` filters select the stable default catalog while empty arrays intentionally select no
  rules. Defaults are terminal output, color enabled, `info` threshold, non-verbose detail, and the
  controlled `uxaudit-reports` directory with fixed `audit-report.json`/`.html` names. Define
  `AuditResult` schema `1.0.0` as one recursively frozen defensive value containing that
  configuration, canonical project/timing/tool metadata, discovered/selected/parsed/failed file
  counters, the complete M04 rule counters/findings, normalized discovery/source/rule errors,
  explicit zero-filled category/severity/stage summaries, and pre-resolved project-relative report
  paths. The builder rejects inconsistent counters, unsafe configured paths, malformed references,
  noncanonical timestamps, or invalid upstream records through one detail-free invariant error and
  orders findings/errors deterministically. A pure reporter receives exactly one such result;
  filesystem writers remain separate boundary adapters. Commander and full audit orchestration
  remain M06 work.
- Alternatives considered: Reporter-specific projections; optional/missing summary buckets; treating
  an empty filter as absent; retaining the permissive schema; storing absolute report paths;
  mutating the result after each reporter writes; or connecting the current scan-only CLI before
  M06.
- Consequences: Terminal, JSON, HTML, and future reporters share one typed and schema-versioned
  source of truth. Stored source columns remain zero-based; only human presentation may convert
  them. Timestamps/duration are intentionally volatile between audit sessions but deterministic
  rendering is required for the same prepared result. Paths identify configured output targets;
  later writers must still verify successful exclusive in-root creation before an application
  claims generation.
- Requirements/contracts affected: RF-13 through RF-15, RNF-02 through RNF-06, RNF-09, RNF-10,
  M05 acceptance, R-005, R-009, R-014, R-017, R-018, and R-019.
- Evidence: exact audit-result schema, configuration/audit/reporter contract tests, the 372-test
  Node.js 24 product gate, and M05 reporter/evidence work as it is completed.

## D-030 — Bounded JSON configuration boundary and explicit precedence

- Date: 2026-07-29
- Status: accepted
- Context: M05 must accept one conventional project configuration and future CLI values without
  importing target modules, following symlinks, leaking native filesystem detail, accepting
  ambiguous selections, or allowing host-dependent report paths. An explicitly selected
  configuration is independently user-authorized and therefore does not have the same containment
  semantics as the conventional project-root file.
- Decision: Read at most 64 KiB of strict UTF-8 JSON from a verified regular-file descriptor. The
  conventional `uxaudit.config.json` must be an exact canonical child of an unchanged canonical
  project root; its absence means defaults. An explicit path may resolve outside the project root,
  but absence is an error and symlink/nonregular/changed paths still fail closed. Validate file and
  programmatic override layers as closed own-data records without invoking accessors, bound arrays
  to 128 entries, reject duplicate top-level keys and duplicate/unknown selections, and accept only
  portable relative output directories. Canonicalize categories, formats, and rule IDs, merge
  `defaults < file < CLI`, defensively copy arrays, and recursively freeze the complete result.
  File-level `null` filters mean the stable catalog, explicit empty filters mean no selection, and
  CLI filters use omission rather than `null` for “no override.” All failures use stable
  non-reflective `ConfigurationError` codes without retaining native causes.
- Alternatives considered: Executable JavaScript/TypeScript configuration; unbounded
  `readFile`; treating a missing explicit path as defaults; requiring every explicit file to be
  inside the analyzed project; shallow object spreading without validation; locale ordering; or
  allowing output paths whose meaning changes across POSIX and Windows.
- Consequences: Configuration is inert, deterministic, independently testable, and portable.
  Commander wiring remains M06 work, so T02 exposes a loader boundary rather than changing the
  current scan-only CLI. User-space identity checks reduce observable path races but cannot provide
  an atomic pathname guarantee on every platform.
- Requirements/contracts affected: RF-09, RNF-01, RNF-03, RNF-04, RNF-09, M05 acceptance, R-009,
  R-015, and R-017.
- Evidence: configuration reader/loader tests and the 435-test Node.js 24 task gate with 95.77%
  statements, 91.08% branches, 99.29% functions, and 95.72% lines.

## D-031 — Pure terminal report with per-value sanitization

- Date: 2026-07-29
- Status: accepted
- Context: The terminal is an immediate human presentation of the same frozen result used by JSON
  and HTML. Reordering by severity would contradict the canonical result, sanitizing a completed
  report would preserve attacker-supplied line structure or neutralize trusted color, and deriving
  options from TTY/environment state would make rendering nondeterministic.
- Decision: Define one frozen terminal `Reporter` that renders LF text synchronously from exactly
  one `AuditResult`. Present complete file/rule/finding/error summaries with fixed category,
  severity, and stage bucket order. Apply the configured minimum severity inclusively to finding
  detail only, preserving the result's canonical order and retaining total counts. Display source
  start columns as stored column plus one, render null locations/references explicitly, and include
  normalized error records only when `verbose` is true. Move terminal sanitization to a neutral
  shared module with the original CLI module as a compatibility re-export. Sanitize every dynamic
  value—including controls, bidirectional markers, BOM, and unpaired surrogates—before adding fixed
  ANSI only around severity/stage badges. `color: false` emits no escape character; stripping the
  trusted ANSI from color output reproduces no-color output byte-for-byte.
- Alternatives considered: Sorting/grouping findings by severity; filtering summary totals;
  converting stored result coordinates; sanitizing the assembled report; coloring whole
  attacker-controlled lines; reading `NO_COLOR`/TTY state; or printing native error causes.
- Consequences: Terminal output is deterministic, injection-resistant, readable, and independent
  of discovery/rules/filesystem I/O. M06 must pass external color/verbosity choices into normalized
  configuration and write the already-sanitized reporter output through a boundary that preserves
  its trusted ANSI rather than sanitizing the assembled report again.
- Requirements/contracts affected: RF-15, RNF-01, RNF-04, RNF-06, RNF-09, RNF-10, M05 acceptance,
  R-014, and R-019.
- Evidence: terminal/CLI focused tests and the 449-test Node.js 24 task gate with 95.94% statements,
  91.42% branches, 99.31% functions, and 95.90% lines.

## D-032 — Lossless JSON and one exclusive report-file boundary

- Date: 2026-07-29
- Status: accepted
- Context: JSON must remain the exact machine-readable `AuditResult`, while JSON and HTML need the
  same local persistence guarantees. A lexical join or ordinary overwrite-capable write could
  escape through a link/race, replace unrelated data, or claim a report that was not durably
  completed.
- Decision: Render JSON as the complete supplied result using two-space `JSON.stringify` followed by
  exactly one LF. Preserve timing and zero-based source coordinates and perform no reporter-specific
  projection. Keep persistence outside the pure reporter. The shared format-aware writer accepts a
  closed plain request only when its relative path is exactly the validated configured output
  directory plus fixed `audit-report.json` or `audit-report.html`. It reauthorizes the canonical
  root and every directory identity around segment-by-segment creation, rejects links/escapes,
  opens the target exclusively with POSIX no-follow where available and mode `0600`, writes UTF-8
  through bounded positional chunks, syncs, verifies path/handle snapshots, closes exactly once,
  and performs a final authorization before returning only a frozen relative success record.
  Invalid, unsafe, existing-target, and operational failures use stable detail-free error codes.
- Alternatives considered: A reduced JSON projection; removing volatile timing; converting JSON
  coordinates for display; recursive directory creation; ordinary `writeFile` overwrite behavior;
  returning an output path before close; format-specific writers; or automatically unlinking a
  partial target after a failed post-open authorization.
- Consequences: Both file reporters share deterministic content-independent persistence, existing
  files are never intentionally overwritten, and callers can claim only returned paths. Portable
  Node APIs do not expose `openat`/`openat2`, so user-space checks cannot eliminate every ancestor
  swap or network-filesystem `O_EXCL` limitation. A failure after exclusive creation may leave a
  partial target; it is not automatically unlinked because an observed identity race could make
  pathname deletion unsafe, and a retry will report that target as existing.
- Requirements/contracts affected: RF-15, RNF-03, RNF-04, RNF-09, RNF-10, M05 acceptance, R-009,
  R-018, and R-019.
- Evidence: exact JSON and shared-writer tests plus the 490-test Node.js 24 task gate with 95.66%
  statements, 91.19% branches, 99.36% functions, and 95.62% lines.

## D-033 — Complete standalone HTML with context-specific escaping

- Date: 2026-07-29
- Status: accepted
- Context: HTML must present the same normalized result as terminal and JSON without treating source,
  configuration, path, error, or reference text as markup. Terminal thresholds and verbosity would
  make HTML incomplete, and trusting an already typed URL would leave forged or normalized control
  sequences able to become active navigation.
- Decision: Render one deterministic UTF-8 HTML5 document with constant inline CSS, one early
  restrictive CSP (`default-src 'none'`, no scripts, inline style only, and no objects, base, or
  forms), and no external assets or executable content. Show complete result metadata,
  configuration, report paths, timing, all summary buckets, all findings, and all processing errors.
  Group findings in fixed critical/high/medium/low/info order and errors in fixed
  discovery/read/parse/extract/rule order while retaining canonical order inside each group. Do not
  apply the terminal severity or verbosity presentation filters. Display one-based lines/columns,
  both UTF-16 offsets, and the end-exclusive range contract. Neutralize controls, C1, bidi/isolates,
  BOM, Unicode line separators, and lone surrogates before escaping HTML metacharacters for every
  dynamic value. Reparse even typed reference URLs, accept only well-formed control-free
  credential-free HTTP(S), use the parsed URL for the escaped `href`, and otherwise render the
  escaped label/value inert. Keep writing in a small adapter over the shared T04 writer.
- Alternatives considered: JavaScript filtering; external CSS/fonts; terminal-threshold filtering;
  verbose-only error detail; interpolating typed values directly; linking every non-null URL;
  omitting null/empty buckets or UTF-16 offsets; sorting input arrays; or implementing a separate
  HTML filesystem path.
- Consequences: The report is portable, complete, readable offline, deterministic for one prepared
  result, and resilient to markup/script/URL injection without mutating the result. CSP/escaping
  tests are structural and do not claim browser execution. Absolute timestamps remain explicit
  volatile audit data, and the shared writer retains D-032's portable-filesystem limits.
- Requirements/contracts affected: RF-15, RNF-02 through RNF-04, RNF-06, RNF-09, RNF-10, M05
  acceptance, R-005, R-018, and R-019.
- Evidence: focused HTML, cross-reporter, hostile-value, URL, null/empty, determinism, and writer
  tests plus the controlled M05 reporting scenario.

## D-034 — Isolated, exact, and finalizable M05 evidence package

- Date: 2026-07-29
- Status: accepted
- Context: M05 acceptance needs reproducible configuration and reporter facts rather than edited
  console excerpts or claims that the scan-only CLI already orchestrates audits. Retained hostile
  output also must not preserve terminal controls, misleading directional text, credentials, or
  personal paths.
- Decision: Copy an allowlisted, symlink-free source snapshot into a credential-free temporary
  environment pinned to Node.js `24.18.0` and npm `11.16.0`. Run clean locked installation, the
  product gate, coverage, a machine-readable no-skip/todo test run, compiled CLI smokes, the
  controlled M05 reporter scenario, harness validation, and a moderate-threshold dependency audit.
  Retain exactly 22 base artifacts: summary/environment, two measurements, eight raw command
  records, and ten scenario records covering exact JSON/expected result, standalone HTML,
  no-color terminal, transient color validation, configuration, cross-reporter fields,
  determinism, structural XSS/CSP validation, and safe writes. Reject source mutation, unexpected
  files, symlinks, noncanonical JSON, secrets/personal paths, ill-formed Unicode, raw terminal/C1/
  bidi/BOM characters, and manifest drift. A second execution must match the source/stable results
  and preserve the first package. The collector rejects the milestone report and enforces exactly
  those 22 artifacts before creating the manifest, then exactly 23 package files including that
  manifest at every staging/publication boundary. Finalization alone accepts the report, verifies
  the unchanged 22-entry base manifest, and adds the report as entry 23.
- Alternatives considered: Retaining raw colored output; browser-execution or CLI-integration
  claims; keeping unfiltered environment variables; allowing arbitrary evidence files; overwriting
  the first package on rerun; omitting a reviewed expected result; or adding the milestone report
  without first verifying the base manifest.
- Consequences: The package is reviewable, sanitized, reproducible, and explicit that XSS validation
  is structural and reporter APIs remain outside the CLI until M06. Standard JSON fidelity is
  preserved: the retained result uses control/lone-surrogate payloads that `JSON.stringify` escapes;
  a separate non-retained render validates C1/bidi/BOM visible escaping without storing those raw
  characters. Portable Node lacks a no-replace directory rename. Initial publication reauthorizes
  the dedicated empty/absent destination immediately before a same-filesystem staging rename and
  fails if a concurrent destination is non-empty, but POSIX may replace a concurrently created
  empty directory in that final interval. The target is the milestone-owned placeholder rather than
  user data; this narrow residual is documented instead of claiming atomic no-clobber semantics.
  Failed publication deliberately retains its staging directory instead of recursively deleting a
  path after an ancestor race. Finalization writes a `0600` temporary manifest exclusively through
  a file handle, syncs it, compares handle/path identity, repeatedly reauthorizes the evidence
  parent/directory/manifest/report and temporary file immediately before rename, and never performs
  pathname cleanup after failure or success. The final pathname-to-rename interval remains subject
  to the same portable Node limitation.
- Requirements/contracts affected: RF-09, RF-15, RNF-03, RNF-04, RNF-06, RNF-09, RNF-10, M05
  acceptance, R-005, R-009, R-010, R-012, R-018, and R-019.
- Evidence: `scripts/run-m05-scenario.mjs`, the M05 evidence contract/collector/finalizer, two
  successful collections, and `evidence/m05-reporting/`.

## D-035 — Additive complete-audit facade and explicit CLI success policy

- Date: 2026-07-29
- Status: accepted
- Context: M06 must connect the completed path, parser/model, rule, configuration, result, reporter,
  and writer boundaries without changing the public contracts closed in M01-M05. Configuration must
  fail before traversal/parsing, existing progress output must remain available, trusted reporter
  ANSI must not be neutralized, and report targets must not be mistaken for successful writes. The
  M05 configuration has no finding-failure field.
- Decision: Add `audit-project.ts` as an orchestration facade. It authorizes the root, loads inert
  configuration, calls the existing analysis facade once, translates `null` versus empty rule
  filters exactly, evaluates one model, builds one clock-bounded immutable `AuditResult`, and writes
  JSON then HTML through the exclusive writer. It returns the preserved analysis result and only
  exact writer-confirmed report records. Commander exposes the documented options, deduplicates
  repeatable values, and constructs overrides only from values sourced explicitly from the CLI.
  Progress/diagnostics/claims use safe value rendering, while the terminal reporter's already safe
  output is written directly. A completed audit returns `0` even with findings or recoverable errors;
  `1` remains reserved, input/configuration uses `2`, and fatal/report failures use `3`.
- Alternatives considered: Collapsing or changing `analyzeProject`; loading configuration after
  traversal; treating `minimumSeverity` as a failure threshold; re-sanitizing the completed terminal
  report; announcing every configured target before persistence; or deleting a sibling/partial file
  after a multi-report failure.
- Consequences: The integration performs one discovery/parser/model/rule pass and preserves earlier
  injected CLI behavior. Canonical root validation occurs twice so configuration can precede
  traversal, but traversal/parsing occurs once. Audit timing ends before persistence. JSON may exist
  if a later HTML write fails; the CLI returns `3`, makes no completed report-set claim, and performs
  no unsafe rollback. A configured future finding-failure policy would require a deliberate public
  contract change.
- Requirements/contracts affected: RF-01, RF-02, RF-09, RF-10, RF-14, RF-15, RNF-01, RNF-04,
  RNF-06, RNF-07, RNF-10, M06-T01, R-009, R-014, R-017, R-018, and R-019.
- Evidence: application/CLI unit and real-filesystem integration tests, eleven compiled CLI smoke
  scenarios, and the M06 evidence package as it is completed.

## D-036 — Closed controlled-project corpus with runtime security and scale variants

- Date: 2026-07-30
- Status: accepted
- Context: M06 needs reviewed end-to-end expectations for safe, violating, mixed, hostile, and
  large projects. Committing symbolic links is platform-sensitive, and committing hundreds of
  repeated sources would obscure the validation contract.
- Decision: Commit minimal valid, invalid, and mixed React/TypeScript projects plus one canonical
  closed manifest. Version exact candidates, exclusions, parser errors, complete eight-rule count
  maps, finding case IDs, volatile fields, and non-execution sentinels. Generate the hostile/security
  project from the valid seed with portable hostile content and capability-aware internal,
  external, and cyclic links. Generate 240 safe TSX components from versioned parameters. Execute
  all five projects twice through the built CLI in fresh roots; verify one shared result across
  terminal/JSON/HTML and compare a stable projection that removes only root/timing volatility.
- Alternatives considered: committing links or generated bulk; using only model-level rule calls;
  deriving expectations from observed reports; reusing report directories; or normalizing finding,
  location, error, and summary differences.
- Consequences: The corpus remains small, portable, reviewable, and strict about actual product
  behavior. Link observations remain capability-dependent on platforms that prohibit creation.
  The 240-file size is a controlled validation scale, not a maximum supported project or a
  machine-independent performance threshold.
- Requirements/contracts affected: RF-03 through RF-15, RNF-04, RNF-07, RNF-09, RNF-10,
  M06-T02, R-001 through R-006, R-009, R-021.
- Evidence: `fixtures/m06-validation/`, its six manifest/corpus tests, and
  `scripts/run-m06-scenario.mjs`.

## D-037 — Instance-level per-rule accuracy without implicit true negatives

- Date: 2026-07-30
- Status: accepted
- Context: Counting every unreported JSX node as a true negative would inflate accuracy, while
  combining rule results would hide differences and unsupported static boundaries. Findings retain
  locations but not fixture case IDs.
- Decision: Version explicit positive, negative, and unsupported instances for every stable rule.
  Obtain findings from the built JSON CLI and use a separate analysis pass only to map literal
  `data-uxaudit-case` values to normalized half-open ranges. Match one finding to at most one
  instance by project, rule, file, and containment. Classify positives as TP/FN and negatives as
  FP/TN; count duplicate/unmatched findings as FP. Report unsupported totals/detections separately
  and exclude them from precision/recall. Preserve rule-level results and use `null` for a zero
  denominator.
- Alternatives considered: project-level binary accuracy; implicit TN from all other nodes;
  aggregate-only scores; counting unsupported as negative; matching only by line; deriving expected
  cases from observed findings; or silently dropping duplicate/unmatched findings.
- Consequences: The measurement is reproducible and auditable but intentionally small. A 1.0 value
  proves conformance to these reviewed static cases, not external validity on arbitrary applications
  or runtime behavior. Diagnostic artifacts are written before a mismatch exits nonzero when an
  output directory is requested.
- Requirements/contracts affected: RF-11 through RF-14, RNF-04 through RNF-06, RNF-10, M06-T03,
  R-001, R-002, R-011, R-021, R-022.
- Evidence: `fixtures/m06-validation/ground-truth.json`, focused ground-truth/metrics tests, and
  `scripts/run-m06-accuracy.mjs`.

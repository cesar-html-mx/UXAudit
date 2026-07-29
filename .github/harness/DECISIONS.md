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
  failure is stable and recoverable; root loss or a model invariant remains fatal.
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

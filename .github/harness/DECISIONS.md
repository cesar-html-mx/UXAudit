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
  duplicate link behavior remains observable and testable. Portable Node APIs cannot eliminate all
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

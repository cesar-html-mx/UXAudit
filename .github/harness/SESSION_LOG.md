# Session Log

## Harness initialization

- Created the repository execution map, machine-readable state, six milestone plans, quality
  workflows, product specifications, reusable skills, and evidence templates.
- Active milestone set to M01.
- No product implementation has been claimed.

## M01 clean restart — 2026-07-29

- At the owner's request, restored the unpublished M01 branch to `4959dba` and removed generated
  dependencies, build output, and coverage from the discarded attempt.
- Verified Node.js `24.18.0` LTS, npm `11.16.0`, current registry versions, and the TypeScript
  7/TypeScript ESLint incompatibility before implementation.
- Completed M01-T01 with an exact-version npm/ESM/ES2024/strict-TypeScript scaffold, reviewed
  esbuild install-script approval, a committed lockfile, and passing Node.js 24 typecheck/build.
- Completed M01-T02 with the current compatible ESLint, TypeScript ESLint, Prettier, Vitest,
  coverage-v8, and Husky releases. Added a flat type-aware lint configuration, 90% coverage
  thresholds, strict peer enforcement, repository-wide formatting baseline, and a pre-commit hook
  that delegates to the shared verification gate.
- Verified T02 under Node.js `24.18.0`: format, lint, typecheck, one focused unit test, build,
  coverage, dependency-tree resolution, and install-script review all passed.
- Completed M01-T03 with Commander `15.0.0`, an injectable CLI adapter, application-level scan
  request contract, npm executable mapping, and a process-only entry point.
- Verified help/version output, application delegation, missing-argument exit 2, unexpected-error
  exit 3, built `scan .`, eight tests, and 100% measured unit coverage under Node.js `24.18.0`.
- Completed M01-T04 with canonical project-root validation, typed and sanitized path errors,
  application integration, and portable filesystem injection. Corrected the duplicate
  `dependencies` key discovered in the committed T03 package metadata.
- Verified valid, empty, missing, file, denied, race, and unknown-error paths; exit 2 versus 3
  mapping; hidden native causes; built CLI smokes; 23 tests; and 100% measured unit coverage under
  Node.js `24.18.0`.
- Completed M01-T05 with immutable-SHA GitHub workflows, a Node.js 24 matrix across Ubuntu, Windows,
  and macOS, a shell-free six-scenario CLI smoke runner, updated product/architecture/security/test
  documentation, and a reproducible evidence collector.
- An independent acceptance review detected a remaining CLI-to-project error dependency. T05
  corrected it by translating project validation failures at the application boundary and added
  focused application/CLI regression coverage. Final review also added an explicit side-effect-free
  `scan --help` regression and corrected Windows npm execution to remain shell-free under Node 24.
- Independent security review reproduced terminal-control injection and weak retained-evidence
  validation. T05 added visible control/bidirectional escaping, hostile-output tests, a deterministic
  source-tree digest, per-artifact SHA-256 manifest, retained-package
  completeness/sanitization/integrity/result checks, and moderate dependency vulnerability
  thresholds.
- Generated `evidence/m01-bootstrap/` from an isolated clean `npm ci`. The retained run passed the
  complete gate, 31 tests, 100% coverage, six smokes, path CLI checks, harness validation, and an npm
  audit reporting zero known vulnerabilities; its sanitizer found no token or personal-home path.
- Remote CI and publication were not claimed. A safe Git credential helper or GitHub CLI was not
  configured in the local repository at evidence time.
- Closed M01 against verified task commit `4b5dac8` and activated M02-T01. The M01 milestone report,
  source digest, integrity manifest, and raw records remain under `evidence/m01-bootstrap/`.

## M02 discovery and inventory — 2026-07-29

- Reconciled the activated M02 state with the repository, created
  `milestone/m02-discovery-inventory` from the verified M01 closure commit, and confirmed that no
  discovery, inventory, or classification implementation already existed.
- Completed M02-T01 with immutable contracts for discovered files, exclusions, recoverable issues,
  inventory entries, and source candidates. Defined exact default dependency/generated/configuration
  exclusions, the `.js`/`.jsx`/`.ts`/`.tsx` boundary, and a secure-by-default symlink policy with an
  explicit in-root opt-in.
- Verified T01 under Node.js `24.18.0`: formatting, strict lint, typecheck, two focused contract
  tests, and harness integrity passed.
- Completed M02-T02 with iterative recursive discovery, deterministic entry/result sorting,
  canonical descendant containment, pre/post-resolution exclusions, configurable internal-link
  following, visited-directory cycle prevention, recoverable descendant issues, and typed fatal root
  failures.
- Verified nested/default/configured exclusions, deterministic reruns, actual directory-link skipping,
  internal/external/broken/cyclic link handling, canonical-exclusion bypass prevention, sibling
  continuation, filesystem races, special entries, POSIX sibling-prefix containment, and Windows
  drive/separator semantics. All 45 repository tests passed with 100% statements/lines/functions and
  94.07% branch coverage.
- Completed M02-T03 with a pure canonical-path inventory builder, portable relative paths, normalized
  extensions, canonical alias deduplication, explicit file type, ordinal ordering, input immutability,
  and a typed invariant failure for non-descendant records.
- Verified T03 with seven focused inventory tests and 52 repository tests. Coverage remained 100%
  for statements, lines, and functions and reached 94.36% for branches.
- Completed M02-T04 with case-insensitive `.js`/`.jsx`/`.ts`/`.tsx` classification, parser-oriented
  JavaScript/TypeScript and JSX source kinds, deterministic ordering, and conservative exclusion of
  declaration and configuration files. The classifier derives paths only and makes no React
  component claim.
- Verified T04 with four focused positive/negative/determinism tests and 56 repository tests.
  Coverage reached 100% statements, lines, and functions and 94.59% branches.
- Integrated M02-T05 as the complete
  `validation → discovery → inventory → classification` application flow. The normalized result
  retains discovery, inventory, candidates, and five summary counts; the CLI preserves M01's first
  line and appends the exact discovery summary without claiming parsing or audit completion.
- Added typed fatal boundaries for discovery, inventory, and classification while keeping
  descendant traversal issues recoverable. Independent review further enforced that discovery and
  inventory adapters cannot redefine the validated canonical root.
- Added a real-filesystem application integration test, extended all six compiled CLI smokes, and
  created a reviewed controlled scenario with default/opt-in symbolic-link behavior, exact
  exclusions, expected/actual inventory, byte-identical reruns, and executable source/package
  sentinels that remain untouched.
- Independent pre-closure security review found and corrected fail-open behavior for an unknown
  runtime symlink policy and containment-after-metadata ordering for a retargeted queued directory.
  Focused regressions now prove fail-closed link skipping and that no outside-root metadata is
  inspected.
- Independent evidence review hardened the collector to reject source-snapshot symlinks, bind child
  processes to the pinned Node.js 24 runtime, validate Git/harness metadata, enforce zero
  skipped/todo tests from a machine-readable Vitest report, publish through same-filesystem staging,
  and include the finalized milestone report in the SHA-256 manifest.
- Generated `evidence/m02-discovery/` three times from isolated clean installations. The first run
  atomically published the package and two later runs preserved it after exact source/result
  reproducibility comparisons. The retained run passed 66 tests across nine files with zero
  skipped/todo, 99.64% statements/lines, 100% functions, 94.15% branches, six compiled smokes, the
  reviewed 10-entry/five-candidate scenario, harness validation, and an npm audit reporting zero
  known vulnerabilities. The sanitizer and SHA-256 contract passed independently.
- Three independent final reviews found no blocking or medium-severity defects. They confirmed
  requirements, M01 compatibility, dependency direction, path/link controls, evidence integrity,
  and the documented residual TOCTOU boundary. Remote Windows/macOS CI remains unclaimed until the
  milestone branch is published.
- Completed M02-T05 in commit `5ffbd14` after its pre-commit Node.js 24 gate passed all 66 tests and
  the build.
- Closed M02 against verified task commit `5ffbd14` and activated M03-T01. The finalized milestone
  report, source digest, expected/actual scenario, measurements, raw records, and SHA-256 manifest
  remain under `evidence/m02-discovery/`.

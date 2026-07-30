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
- Created closure commit `868442a`. Automated HTTPS publication then failed because Git had no
  non-interactive GitHub username/credential, so no remote M02 branch, pull request, or hosted
  Windows/macOS result is claimed.

## M03 parser and analysis model — 2026-07-29

- Loaded and validated the active M03 harness, created
  `milestone/m03-parser-analysis-model` from the verified M02 tree, and reconciled the stale
  `state.currentBranch` value before product work.
- Inspected the completed M02 pipeline and confirmed that no parser, analysis model, or M03 fixture
  implementation already existed. Registry metadata identified aligned Babel `8.0.4` packages as
  the current stable releases compatible with Node.js `24.18.0`; the exact AST-boundary decision
  was recorded before installation.
- Completed M03-T01 with parser-independent source locations, analyzed-file/component/JSX models,
  named/spread attributes, literal/object/dynamic values, text confidence, and discriminated
  recoverable read/parse/extract results. Rule-facing contracts contain no Babel imports, AST,
  absolute project root, or source content.
- Verified T01 under Node.js `24.18.0`: formatting, strict lint, typecheck, eight focused contract
  tests, all 74 repository tests across 12 files, harness integrity, and the Babel-boundary scan
  passed with no skipped tests.
- Completed M03-T02 with exact `@babel/parser`, `@babel/traverse`, and `@babel/types` `8.0.4`
  production dependencies and an internal Babel adapter. Source kinds select only JavaScript, JSX,
  TypeScript, or TSX syntax; source type is unambiguous; locations and relative filenames are
  retained; partial recovery, comments, and tokens are disabled.
- Added an inert fixture corpus plus tests for the four language kinds, script/module behavior,
  negative plugin boundaries, stable malformed-file coordinates, CRLF/astral UTF-16 offsets,
  deterministic reruns, direct dependency declarations, and target-code non-execution. ESLint now
  prevents Babel imports from entering domain or rule modules.
- Verified T02 on Node.js `24.18.0`: ten focused tests and all 84 tests across 14 files passed,
  together with formatting, strict lint, typecheck, build, an exact top-level Babel dependency
  tree, and an npm audit reporting zero vulnerabilities.
- Completed M03-T03 with one bounded Babel traversal that projects AST data into UXAudit-owned
  component and JSX records without evaluating target code. It recognizes named and anonymous
  default function, arrow/function-expression, and supported React class component forms while
  retaining unowned JSX conservatively.
- Extracted JSX now distinguishes intrinsic, custom, member/namespaced, shorthand fragment, and
  `React.Fragment` forms. Deterministic IDs and source-order arrays retain exact bidirectional
  component/root/parent/child relationships; JSX attributes and nested functions form explicit
  relationship or ownership barriers.
- Added named/spread attribute extraction; exact finite primitive, static-template, and structured
  object values; dynamic/partial confidence for unresolved data; and normalized descendant text
  with exact/partial/dynamic confidence. Prototype-sensitive object keys remain data, object depth
  is bounded, static text is capped at 256 UTF-16 code units, and the traversal stops recoverably
  after 100,000 Babel nodes.
- Preserved portable half-open locations for files, components, JSX, attributes, and object
  properties. Expected extraction/limit failures remain stable and recoverable per file, while
  unexpected traversal or bookkeeping invariant failures are hidden behind one stable fatal
  `BabelAnalysisInvariantError`.
- Verified T03 on Node.js `24.18.0`: 22 focused extraction tests and all 106 repository tests passed,
  along with formatting, strict lint, typecheck, and build. Global V8 coverage passed at 97.17%
  statements, 90.71% branches, 100% functions, and 97.13% lines.
- Completed M03-T04 with a defensive `buildAnalysisModel` boundary that recursively projects fresh
  UXAudit-owned files, components, JSX nodes, attributes, text, and values. Parser/source extras and
  all mutable input references are discarded instead of being concatenated into the project model.
- Normalization orders portable project-relative paths ordinally and rebuilds per-file and global
  arrays from canonical component/JSX IDs. It preserves source-significant attribute/object-property
  order and retains hostile control characters as inert data for later escaping at output
  boundaries.
- Added fatal validation for duplicate or nonportable paths; unsafe/inconsistent coordinates;
  location containment; membership, ownership, root, and reciprocal parent/child relationships;
  missing/cross-file references and cycles; value/confidence combinations; finite literals; bounded
  text/object depth; object cycles; and `usesJsx` consistency. All failures expose the same generic
  `AnalysisModelInvariantError` without invalid input details.
- Verified T04 on Node.js `24.18.0`: 26 focused builder tests and all 132 repository tests across 16
  files passed, together with formatting, strict lint, typecheck, and build. Global V8 coverage
  passed at 97.00% statements (973/1003), 90.31% branches (634/702), 100% functions, and 96.95%
  lines.
- Implemented M03-T05 source opening with canonical-root reauthorization, declared/canonical
  containment, path/descriptor identity and snapshot comparisons, POSIX no-follow/non-blocking
  flags, exact handle closure, stable local/fatal error boundaries, a 1 MiB source limit, and 64 KiB
  bounded reads.
- Added strict UTF-8 decoding that rejects malformed bytes while retaining an initial BOM. The
  composite parser now performs `verified read → Babel parse → AST-free extraction` without
  exposing source text or Babel nodes.
- Added deterministic sequential candidate analysis. Expected read, syntax, and extraction failures
  remain ordered per-file records and safe siblings continue; duplicate/result-path, root,
  extraction, and model invariants remain fatal.
- Preserved the completed M02 `scanProject` public contract and introduced the separate
  `analyzeProject` facade for parser errors, normalized model, and parsing counts. Existing injected
  scan-only CLI callers retain their behavior, while the production entry point appends
  `Parsing summary: parsed=<n> failed=<n> components=<n> jsx=<n>`.
- Added secure-reader, composite, batch, application, real-filesystem integration, and CLI
  regressions. The integration case isolates malformed TSX, retains valid sibling model locations,
  and proves that target-code sentinels are not executed.
- Independent review found two cross-platform hardening gaps before closure. Non-portable candidate
  paths now fail through a detail-free fatal invariant, Windows drive prefixes are rejected on every
  host, and reader tests construct native absolute paths instead of assuming POSIX syntax.
- Verified T05 on Node.js `24.18.0`: all 208 repository tests across 21 files passed, together with
  formatting, strict lint, typecheck, and build. Global V8 coverage passed at 97.63% statements,
  91.86% branches, 100% functions, and 97.59% lines.
- The compiled controlled M03 scenario modeled seven files, isolated one malformed file, retained
  seven components and 15 JSX nodes across JavaScript/JSX/TypeScript/TSX, reproduced byte-identical
  expected output, and did not execute target code.
- Collected the isolated `M03-PARSING` evidence package twice. Locked install, product gate,
  coverage, zero-skip/todo tests, CLI smoke, controlled scenario, harness, moderate-threshold audit,
  and exact direct Babel tree all passed. The second run preserved the initial package after stable
  comparison; its manifest verifies every retained artifact, and npm reported zero known
  vulnerabilities.
- Attempted to publish the task-complete T04 branch tip before the T05 commit. This process has no
  HTTPS credential helper and no authorized SSH key, so the attempt failed without changing the
  remote. No embedded token or remote publication is claimed.
- Two independent final reviews collectively covered the Node.js `24.18.0` product gate, coverage,
  CLI smokes, controlled scenario, exact Babel tree, evidence contract, and security/architecture
  boundaries. One reproduced the executable gate and scenarios; the other audited the retained
  evidence and finalizer independently. Neither found a blocking, high, or medium defect; the only
  observed harness failure was the expected pre-advance state with M03 active and no remaining task.
- Finalized the M03 milestone report and SHA-256 evidence manifest, marked the retained package
  complete, and recorded the residual portable TOCTOU, syntactic-analysis, unbounded project-count,
  and unexecuted hosted-platform limitations without weakening a gate.
- Closed M03 against verified task commit `6a33946a07bf2d8db5e81d201b59a038bf994e5e`
  and activated M04-T01. The M03 ExecPlan moved to `exec-plans/completed/`; no M04 implementation
  work was started.

## M04 rule engine and initial catalog — 2026-07-29

- Validated the harness, reconciled the clean `main` merge `2625bf6` with the stale M03 branch field
  in state, created `milestone/m04-rule-engine-catalog`, and updated the active ExecPlan before
  product work.
- Defined M04-T01's model-only `Rule`, complete metadata/classification, rule-local observation,
  self-contained normalized `Finding`, stable recoverable execution error, and evaluation-result
  counter contracts. Finding normalization defensively copies limitations, the M03 half-open
  location, and the structured reference without report-specific coordinate conversion.
- Focused T01 verification passed seven contract tests, strict TypeScript, and ESLint.
- Implemented M04-T02's explicit validated registry, category/ID intersection loader, exact-once
  evaluator, transactional result validation, stable per-rule isolation, canonical model-location
  provenance, deterministic finding/error order, and complete counters.
- Independent T02 review found fail-open filter containers, runtime model-mutation exposure, unsafe
  reference schemes, confidence-sensitive duplicate identity, and implicit experimental/deferred
  execution. The implementation now fails filters closed, deep-freezes the model once, admits only
  safe HTTP(S) references, rejects contradictory duplicates/deferred rules, and requires exact ID
  opt-in for experiments.
- T02's 53 focused contract/registry/loader/evaluator tests passed. The full 261-test coverage run
  passed with 97.34% statements, 91.72% branches, 99.62% functions, and 97.35% lines.
- Implemented M04-T03's three stable intrinsic accessibility rules with ordered JSX-spread
  semantics, conservative unknown-case handling, exact source ranges, complete metadata, committed
  TSX integration input, and documented custom/dynamic/accessibility-algorithm limitations.
- Twenty-five focused accessibility tests cover positive, negative, multiple, boundary,
  association, unsupported, metadata, and engine-integration behavior. Review-driven cases now
  prove conservative dynamic/spread association handling, exact ID equality, component isolation,
  explicit and null nested-label targets, known-null ARIA values, and the documented multi-control
  limit.
- The post-review full run passed all 286 tests with 96.85% statements, 92.01% branches, 99.65%
  functions, and 96.85% lines.
- Implemented M04-T04's two performance, two SEO, and one UX stable rules plus the explicit initial
  registry containing exactly eight rules across the reviewed three/two/two/one category
  distribution. Factories validate/capture configurable ambiguous-link phrases and the default
  12px inline-text threshold without expanding `RuleContext`.
- Independent category reviews drove regressions for known-invalid dimensions beside uncertainty,
  literal zero-by-zero, unsafe numeric dimensions, sparse/accessor/proxy configuration, invalid CSS
  numeric syntax/Unicode whitespace, inert or void text containers, and medium confidence for
  partial text. Final re-reviews exercised 19 dimension probes, hostile SEO configuration, and 14
  CSS-whitespace probes without finding a remaining blocker.
- Fifty-four focused T04 rule/registry tests passed. The full 340-test coverage run passed with
  97.14% statements, 92.79% branches, 99.70% functions, and 97.14% lines.
- Integrated M04-T05 through the production analysis-model and rule-engine boundaries with one
  inert controlled TSX project. The reviewed expected result contains exactly one finding for each
  of the eight stable rules; two evaluations serialize byte-identically and the target-code
  sentinel is never executed.
- Added complete catalog integration assertions for deterministic ordering/counters, category and
  ID filter intersections, metadata and limitations, safe and unsupported cases, canonical
  locations, and one injected throwing ninth rule that preserves all eight stable sibling findings.
  The pre-evidence gate passed all 343 tests across 38 files with no skips or todos.
- Defined an exact M04 evidence contract and finalizer with whole-header credential sanitization,
  source-path redaction, strict file/directory allowlisting, fail-before-mutation validation, and a
  SHA-256 manifest. Independent adversarial review confirmed that extra files, empty directories,
  Basic/Bearer authorization headers, and manifest mutation on rejection are all prevented.
- Collected the isolated `M04-RULES` evidence package twice under the pinned Node.js `24.18.0` and
  npm `11.16.0` runtimes. Locked install, the 343-test product gate, coverage, zero-skip/todo tests,
  six CLI smokes, the full-catalog scenario, harness validation, and moderate-threshold audit all
  passed; npm reported zero known vulnerabilities.
- The initial shell resolved Node.js 22 and the collector rejected it before running product checks
  or publishing evidence. The official pinned-runtime execution wrote 20 artifacts, and the second
  execution preserved the package after matching its source digest and stable scenario/measurement
  results. Every retained SHA-256 manifest entry verifies.
- Final self-review found that two auxiliary scenario JSON files were semantically valid and
  manifested but did not satisfy repository formatting. The initial package was moved intact out of
  the repository, the runner was corrected to canonicalize every retained JSON with the repository
  Prettier options, and a temporary eight-file reproduction passed formatting while retaining the
  reviewed expected/actual digest.
- The same review hardened the collector to reject noncanonical scenario JSON, source-snapshot
  mutation during gates, unsafe/symlinked evidence destinations, and destination changes before
  publication. The finalizer now verifies the exact preexisting 20-artifact manifest before adding
  the milestone report, so it cannot legitimize prior drift.
- Recollected an interim corrected package twice under Node.js `24.18.0`. The first execution passed
  the complete isolated gate and published 20 canonically formatted artifacts; the second matched
  its source digest and preserved the package. The repository-wide format check, evidence contract,
  sanitization, and all 20 manifest hashes passed before the later product-review correction.
- Final product review then found one accessibility false negative: surrounding whitespace was
  incorrectly stripped before matching excluded input types. HTML treats values such as
  `type=" hidden "` as invalid and therefore defaults them to a label-required text state. Removed
  that trimming and added two regression cases while preserving exact case-insensitive matches.
- Final evidence review also extended destination reauthorization to the finalizer, preventing a
  symlinked `evidence/` or `m04-rules/` directory, manifest, or report from redirecting manifest
  publication outside the repository.
- After both review findings were resolved, the final isolated package was collected twice. It
  records all 344 tests across 38 files with zero skips/todos, the unchanged coverage thresholds,
  zero known vulnerabilities, and source digest
  `sha256:2db86840585dfc1622c0abcad7ff00fea1bccdcd895b291b5d3c6b482f9edfb2`; the second execution
  preserved all 20 base artifacts.
- Three independent closure reviews collectively covered product semantics, evidence security and
  integrity, documentation, traceability, and harness transition readiness. The discovered
  canonical-JSON, padded-input-type, finalizer-symlink, and RNF-06/RNF-07 traceability gaps were
  corrected and revalidated; no blocking, high, or medium defect remains.
- Committed completed M04-T05 as `3afa4bb3eaab415a7792aa0c4f3862464bc89efb`.
  A non-interactive HTTPS push then failed because this process has no GitHub username/credential;
  the remote was unchanged and no pull request or hosted CI result is claimed.
- Finalized the 21-entry M04 SHA-256 manifest with `MILESTONE_REPORT.md`, marked the evidence index
  complete, and verified every retained hash after finalization.
- Closed M04 against verified task commit `3afa4bb3eaab415a7792aa0c4f3862464bc89efb`,
  moved its ExecPlan to `exec-plans/completed/`, and activated M05-T01. No M05 implementation work
  was started.

## M05 configuration and reporting — 2026-07-29

- Validated the active M05 harness, reconciled the clean `main` merge `1bc3e07` with the stale M04
  branch field, created `milestone/m05-configuration-reporting`, updated the state/ExecPlan before
  product work, and activated the installed Node.js `24.18.0`/npm `11.16.0` toolchain.
- Completed M05-T01 with schema-versioned immutable configuration defaults, fixed controlled report
  names, stable configuration errors/typed CLI overrides, a pure reporter contract, and one exact
  recursively frozen `AuditResult`.
- The result boundary copies and validates configuration, project/tool/timing metadata, exact
  discovered/selected/parsed/failed and M04 rule counters, canonical findings, discovery/source/rule
  errors, explicit category/severity/stage buckets, and pre-resolved project-relative report paths.
  Contradictory counters, malformed records, unsafe paths/references, and invalid timestamps collapse
  to one detail-free invariant error without mutating caller data.
- Contract tests include empty and populated results, null-versus-empty filters, error conversion,
  hostile/invalid boundaries, schema resolution against the local finding schema, recursive
  freezing, deterministic rebuilds, and exact one-result reporter delegation.
- Independent review found an absolute schema base that would redirect the local finding reference
  and a missing equality between failed-file count and parser errors. Both were corrected and
  regression-tested; the request for inventory/exclusion counters was rejected because the
  higher-precedence product contract specifies discovered/selected/parsed/failed while individual
  discovery issues already remain in the normalized error list.
- The final T01 Node.js `24.18.0` run passed formatting, strict lint, typecheck, build, all 372 tests
  across 41 files, and coverage at 95.88% statements, 90.76% branches, 99.19% functions, and 95.84%
  lines.
- Completed M05-T02 with bounded strict-UTF-8 JSON reading, conventional canonical-root discovery,
  explicit-file authority, regular-file/path/descriptor identity checks, closed version-1
  validation, stable errors, canonical selection order, portable output paths, and immutable
  `defaults < file < CLI` merging.
- The reader distinguishes an absent conventional file from a missing explicit file, accepts
  exactly 64 KiB and one initial UTF-8 BOM, rejects links/nonregular/changed/oversized inputs, uses
  no-follow/non-blocking POSIX flags where available, closes exactly once, and never retains native
  error details. The loader rejects unknown keys/rules, accessors, sparse/exotic arrays, duplicates,
  invalid primitives, and unsafe cross-platform paths without importing target code.
- Independent review exposed and regression-tested missing-root reauthorization on absent defaults,
  proxy trap execution, hostile native-error shapes, incomplete Windows reserved names, UTF-8 path
  limits, and duplicate top-level JSON-key ambiguity. The fixes fail closed without changing the
  public configuration vocabulary.
- T02 verification under Node.js `24.18.0` passed formatting, strict lint, typecheck, build, all 435
  tests across 43 files, and coverage at 95.77% statements, 91.08% branches, 99.29% functions, and
  95.72% lines. Final independent re-review found no remaining defect.
- Committed M05-T02 as `80f846f`. Its non-interactive HTTPS push was attempted immediately and
  failed because this process has no GitHub username/credential; the remote was unchanged and no
  hosted result is claimed.
- Completed M05-T03 with a pure frozen terminal reporter, complete deterministic summaries,
  inclusive minimum-severity detail filtering, canonical record order, one-based display columns,
  explicit empty/null states, and verbose normalized processing errors.
- Moved terminal sanitization to a neutral shared boundary while preserving the CLI re-export.
  Every dynamic value is escaped before fixed badge-only ANSI; C0/C1, terminal controls, bidi,
  isolates, BOM, injected lines, and unpaired surrogates become visible escapes while valid Unicode
  remains intact. Color output strips exactly to the no-color report.
- T03 verification under Node.js `24.18.0` passed 33 focused terminal/CLI tests, formatting, strict
  lint, typecheck, build, all 449 tests across 44 files, and coverage at 95.94% statements, 91.42%
  branches, 99.31% functions, and 95.90% lines. Independent adversarial re-review found no
  remaining defect.
- Committed M05-T03 as `0db6b5f`. Its non-interactive HTTPS push was attempted immediately and
  failed because this process has no GitHub username/credential; the remote was unchanged and no
  hosted result is claimed.
- Completed M05-T04 with a frozen lossless JSON reporter and one shared format-aware report writer.
  JSON retains the exact supplied schema, timing, zero-based coordinates, hostile strings, and empty
  buckets as two-space JSON with one final LF.
- The writer accepts only fixed JSON/HTML targets under a validated portable output directory,
  authorizes root and directory identities around segment creation, uses exclusive creation plus
  POSIX no-follow, performs bounded positional UTF-8 writes, sync/close and target/path snapshot
  checks, and returns a relative path only after final authorization. Failures are stable and never
  claim success; partial files are not unsafely unlinked after an identity race.
- T04 verification under Node.js `24.18.0` passed 41 focused JSON/writer tests, formatting, strict
  lint, typecheck, build, all 490 tests across 46 files, and coverage at 95.66% statements, 91.19%
  branches, 99.36% functions, and 95.62% lines.
- Independent final review confirmed the post-close target snapshot is the last asynchronous
  filesystem observation before success, the replacement race fails closed, and no blocking T04
  defect remains. Residual portable-filesystem and partial-target limits are recorded in D-032.
- Committed M05-T04 as `44195f4`. Its non-interactive HTTPS push was attempted immediately and
  failed because this process has no GitHub username/credential; the remote was unchanged and no
  hosted result is claimed.
- Reconciled M05-T05 before implementation: HTML will be a pure standalone no-script document over
  the same result, with visible hostile-Unicode neutralization, context-specific escaping, fixed
  summary groups, one-based display columns, safe-link revalidation, and reuse of the T04 writer.
  Retained evidence will distinguish structural CSP/escaping validation from browser execution and
  will not imply M06 CLI reporter integration.
- Implemented the pure HTML reporter and its shared-writer adapter. The standalone document exposes
  complete metadata, configuration, timing, report paths, counters, findings, and normalized errors
  in fixed severity/stage groups without applying terminal filters. It displays one-based columns,
  both UTF-16 offsets, and end-exclusive ranges.
- Every dynamic value is neutralized for controls/C1/bidi/BOM/lone surrogates before HTML escaping.
  Constant inline CSS plus a restrictive CSP require no script or external asset; forged references
  become links only after control-free credential-free HTTP(S) reparsing and otherwise remain inert.
- Independent review found the initial cross-reporter test and scenario overclaimed complete
  identity after comparing only a subset of fields. The tests now compare every finding field and
  error discriminator contextually and prove order within a shared bucket; the scenario records the
  exact format-specific coordinate projections and fields it verifies.
- Final HTML verification under Node.js `24.18.0` passed 77 focused reporter/writer tests and 512
  total tests across 47 files. Coverage measured 95.81% statements, 91.39% branches, 99.39%
  functions, and 95.77% lines globally, with 100% statements/functions/lines and 97.82% branches
  for the HTML module. Independent final review found no remaining reporter defect.
- Independent pre-collection review found that portable Node directory rename has no no-replace
  mode: on POSIX, a destination created empty after the final absence check can be replaced. M05
  limits publication to its dedicated absent/`.gitkeep` evidence target, rechecks immediately before
  same-filesystem rename, fails for non-empty concurrent data, and records the narrow residual in
  D-034 rather than claiming atomic no-clobber behavior.
- Collected the M05 package twice from an isolated, credential-free, symlink-free allowlisted
  snapshot. The first run published 22 base artifacts with a complete SHA-256 manifest; the second
  reproduced the same source/result and preserved the existing package after validating every
  artifact. The source-tree digest was
  `sha256:1755405d825a726b7eecf8ccbbb492131cd29f353a09340292a746e53df2b0a0`.
- Retained evidence records 512 passing tests across 47 files with zero skipped/todo tests, 95.81%
  statement / 91.39% branch / 99.39% function / 95.77% line coverage, zero known dependency
  vulnerabilities, five configuration cases, all five severities and processing stages, exact
  cross-reporter projections, deterministic rerenders, terminal ANSI equivalence, structural
  HTML/CSP/XSS checks, and safe-write failure cases.
- Independent evidence review verified the package contract, sanitization, source isolation,
  canonicity, manifest hashes, finalizer prevalidation, honest browser/CLI claims, and the bounded
  rename residual. It found no remaining blocking or medium defect.
- A separate adversarial security review then found that the base collector still permitted the
  optional milestone report and that finalizer/staging failure cleanup could follow a replaced
  ancestor. The collector now rejects the report and enforces the exact 22-artifact/23-file base
  contract at every boundary. The finalizer uses exclusive handle write/sync, handle/path identity,
  repeated parent/directory/file authorization immediately before rename, and no pathname cleanup;
  failed publication staging is also retained rather than recursively removed.
- The corrected tooling passed Node syntax, Prettier, and focused ESLint checks. Both isolated
  evidence passes were regenerated after the correction, and the security re-review approved the
  result with no remaining blocking or medium defect. Only the already documented portable
  pathname-to-rename interval remains.
- Completed M05-T05 in commit `c4c9959bb0c279cd368f50acee47eefb4ac75923`; its pre-commit
  Node.js 24 gate passed all 512 tests, formatting, strict lint, typecheck, and build.
- Attempted the required HTTPS push immediately after the T05 commit. GitHub requested credentials
  unavailable to this process, so the attempt was stopped without changing the remote; no hosted
  branch, pull request, or CI result is claimed.
- Created the factual M05 milestone report with commits, capability, exact measurements, evidence
  digests, review corrections, limitations, and publication status. Closed M05 with verified task
  commit `c4c9959bb0c279cd368f50acee47eefb4ac75923`, moved its ExecPlan to `completed/`, activated
  M06-T01, synchronized the generated state document, and restored harness validation to PASS.
- Finalized the retained evidence manifest with 23 valid SHA-256 entries, including the formatted
  milestone report. The final package passed its exact file contract, integrity, sanitization, and
  canonical-JSON checks.

## M06 integration and validation — 2026-07-30

- Validated the active harness, reconciled the merged M05 baseline `bd22ef5`, created
  `milestone/m06-integration-validation`, and activated Node.js `24.18.0`/npm `11.16.0`.
- Reconciled the M06 ExecPlan before implementation. The completed M05 configuration and reporters
  were independent of the production CLI, and the final harness lifecycle did not yet recognize a
  project with zero active milestones.
- Completed M06-T01 with one application audit facade that performs canonical validation,
  configuration loading, exactly one source analysis, stable-rule evaluation, one normalized
  `AuditResult`, and selected JSON/HTML persistence. Null filters remain omitted while explicit
  empty arrays intentionally select no rules.
- Extended `ux-audit scan` with configuration, format, output, category, rule, severity, color, and
  verbosity controls while preserving the three established progress lines. Commander value
  sources prevent defaults from overriding configuration-file values.
- Completed findings and recoverable discovery/source/rule errors return exit `0`; invalid
  command/path/configuration input returns `2`; fatal pipeline and report failures return `3`.
  Exit `1` remains reserved because the current configuration has no finding-failure policy.
- The CLI writes trusted terminal-reporter ANSI directly, sanitizes all dynamic progress and file
  claims, and reports only `WrittenReport` records returned after successful persistence.
  Configured `reportPaths` are targets rather than proof of a completed write.
- Added application, real-filesystem, CLI, and compiled-smoke coverage for filter semantics,
  precedence, recoverable parser/rule errors, root loss, hostile terminal data, report selection,
  overwrite refusal, partial persistence, and stable error boundaries. Independent reviews found
  no blocking defect; their renderer/writer attribution residual was corrected and regression
  tested.
- The final T01 Node.js 24 gate passed formatting, strict lint, typecheck, build, 548 tests across
  50 files, all 11 compiled CLI scenarios, harness validation, and V8 coverage at 95.88%
  statements, 91.46% branches, 99.80% functions, and 95.84% lines.
- The required T01 publication attempt failed non-interactively because no HTTPS GitHub credential
  is available. The remote was unchanged; the local conventional commit is `c5eb8bc`.
- Completed M06-T02 with a canonical closed manifest and committed valid, invalid, and mixed
  React/TypeScript projects. Exact candidates, exclusions, parser errors, rule counts, case IDs,
  volatile fields, and source/package non-execution sentinels are versioned.
- The invalid project produces exactly one finding for each of the eight stable rules. The mixed
  project selects five language candidates, parses four, retains one recoverable syntax error, and
  produces three controlled findings while default generated directories, a declaration file, and
  configuration remain excluded.
- The same contract generates a portable hostile/security project with internal, external, and
  cyclic links plus an HTML-relevant hostile path, and a 240-file safe project across 12
  directories. Bulk and platform-specific links are generated only at runtime.
- The shell-free M06 runner invoked the complete built CLI over all five projects twice in fresh
  roots. Expected result maps, exit `0`, exact JSON/HTML rendering, terminal consistency, writer
  claims, link exclusions when supported, stable projections, and absent sentinels all passed.
- Six focused tests lock the manifest schema, physical corpus, rule maps/case IDs, generator
  parameters, and absence of committed links, sentinels, or generated reports.
- Independent review found that the first runner projection ignored unexpected discovery/rule
  errors. The final contract now requires exact total errors and zero unversioned discovery issues,
  normalizes both raw and escaped roots in retained HTML samples, and uses non-overstated evidence
  field names.
- The final T02 Node.js 24 gate passed formatting, strict lint, typecheck, build, 554 tests across
  51 files, the five-project/two-run scenario, harness validation, and coverage at 95.88%
  statements, 91.46% branches, 99.80% functions, and 95.84% lines.
- The T02 HTTPS publication attempt again failed without a configured GitHub credential; no remote
  branch or hosted result is claimed.
- Completed M06-T03 with a closed ground-truth contract covering 27 explicit source instances:
  11 positives, one negative per stable rule, and one unsupported boundary per stable rule.
- Added a pure defensive metrics boundary that classifies positive detections/misses as TP/FN,
  negative detections/clear cases as FP/TN, adds duplicate/unmatched findings to FP, and reports
  unsupported cases outside precision/recall denominators. Safe integer, null denominator,
  duplicate identity, exotic input, immutability, and deterministic order behavior are tested.
- The shell-free accuracy runner executes the built JSON CLI on valid, invalid, and mixed projects,
  separately derives only model case ranges, and matches each finding by project, rule, portable
  file, and half-open containment. It retains exact case/finding identities, expected/actual JSON,
  per-rule and per-case CSV, unsupported observations, notes, and corrective-action status.
- Observed metrics matched ground truth for all eight rules: 11 TP, zero FP, eight TN, zero FN, no
  unmatched findings, and no unsupported detections. Precision and recall are 1.0 per rule only
  within this small controlled corpus; no real-world accuracy claim is made.
- Independent methodology and implementation reviews found no blocking/high/medium defect. Their
  safe-integer denominator residual was corrected, and failure-mode evidence now writes diagnostic
  artifacts before the runner exits nonzero.
- The final T03 Node.js 24 gate passed formatting, strict lint, typecheck, build, 577 tests across
  53 files, the complete system and accuracy scenarios, harness validation, and coverage at 95.84%
  statements, 91.39% branches, 99.81% functions, and 95.80% lines.

# Test Strategy

Testing supports both verification—building the product correctly—and validation—confirming that it
serves its intended use.

Every test case must identify:

1. objective;
2. inputs;
3. expected result;
4. environment;
5. execution;
6. observed result and conclusion.

## Unit tests

Target the smallest meaningful behavior:

- path validation;
- exclusions and discovery;
- inventory normalization and deduplication;
- source classification;
- parser configuration and location retention;
- model transformation;
- rule behavior;
- finding normalization and sorting;
- configuration validation;
- reporter escaping and serialization.

Each rule requires:

- positive fixture;
- negative fixture;
- boundary or unsupported-value fixture when relevant;
- exact expected finding count and important fields.

## Integration tests

Required boundaries:

- CLI options -> application request;
- discovery -> inventory -> classification;
- parser -> model;
- model -> rule loader -> evaluator;
- `AuditResult` -> each reporter;
- full application service without spawning a shell.

## System and end-to-end tests

Execute the installed/built CLI against controlled React/TypeScript projects and verify:

- exit code;
- console summary;
- generated files;
- finding identities and locations;
- recoverable parser errors;
- invalid path and invalid configuration behavior;
- deterministic reruns.

## Controlled validation projects

Maintain at least:

- `valid-project`: implementations that should produce no selected findings.
- `invalid-project`: one or more known violations for each stable rule.
- `mixed-project`: JavaScript/TypeScript, nested folders, excluded output, and syntax edge cases.
- `security-project`: malicious filenames/text, symlinks, and HTML injection strings.
- `large-project`: generated repeated components for performance measurement.

Expected results are versioned and reviewed.

## Accuracy measures

For each stable rule, record:

- true positives;
- false positives;
- true negatives where meaningful;
- false negatives;
- precision = TP / (TP + FP);
- recall = TP / (TP + FN).

Do not combine all rules into one score without preserving rule-level results.

## Usability

The CLI and reports are the user interface. Validate tasks such as:

- discover how to run a scan;
- analyze a project;
- identify the highest-priority finding;
- locate the source file;
- understand the recommendation;
- find the JSON/HTML report.

Record completion, time, errors, backtracking, comments, and a SUS questionnaire when participants
are available. If real participants are not available, clearly distinguish expert heuristic review from
user testing.

## Security and robustness

Execute the checklist in `07_SECURITY.md`, dependency audit, malicious report content tests, path
boundary tests, symlink tests, malformed source tests, output permission failures, and resource
limits.

## Evidence

Store commands, environment, tool versions, machine-readable results, selected output samples, and
human conclusions under `evidence/`. Never fabricate a result that was not executed.

## M01 executed baseline

- Focused Vitest tests cover product metadata, CLI help/version/delegation and exit mapping,
  application orchestration, project-root validation, and hostile terminal-control rendering.
- Filesystem integration uses controlled temporary directories; permission and race errors use an
  injected adapter instead of platform-dependent `chmod`.
- V8 coverage enforces 90% global thresholds for statements, branches, functions, and lines.
- A portable Node.js smoke runner executes help, version, valid directory, missing path, regular
  file, and missing-argument scenarios against the compiled CLI without a shell.
- The Node.js 24 CI matrix covers Ubuntu, Windows, and macOS. Linux additionally enforces coverage
  and rejects npm vulnerabilities of moderate severity or higher.

## M02 executed baseline

- Unit tests cover exact default/custom exclusions, ordinal traversal, fatal versus recoverable
  filesystem failures, default and opt-in symbolic-link behavior, external/cyclic/broken links,
  canonical-containment races, inventory invariants/deduplication, and the source-candidate matrix.
- The real-filesystem application integration test executes
  `validation → discovery → inventory → classification` twice over a mixed temporary project,
  asserts identical normalized results, and proves that its package script sentinel is not created.
- The compiled CLI smoke suite retains all six M01 scenarios and now asserts the stable empty-project
  discovery summary.
- The controlled M02 scenario versions expected and actual JSON for 10 canonical inventory entries,
  five candidates, exclusions, default and opt-in link policy, two byte-identical reruns, and no
  target-code execution.
- The isolated Node.js `24.18.0` evidence run executes a clean locked install, the full gate,
  coverage, smoke and controlled scenario, harness validation, and dependency audit. The measured
  suite contains 66 passing tests across nine files with 99.64% statements/lines, 100% functions,
  and 94.15% branches; the JSON test record must also prove zero skipped or todo tests.

## M03-T03 executed parser/extraction baseline

- Babel extraction tests cover PascalCase function declarations, arrow/function expressions,
  supported React class variants, anonymous default exports, inactive candidates, class-render and
  nested-function ownership boundaries, and JSX embedded in attributes.
- JSX cases cover intrinsic, custom, member/namespaced, shorthand-fragment, and `React.Fragment`
  forms; exact bidirectional parent/child/component/root relationships; named, shorthand, and spread
  attributes; finite primitive, static-template, bounded-object, dynamic, partial, non-finite, deep,
  and prototype-sensitive values.
- Text assertions distinguish exact, partial, and dynamic confidence, including primitive
  expression children, nested JSX, custom-child uncertainty, whitespace normalization, and the
  256-UTF-16-code-unit retention boundary.
- Location assertions verify whole files, multiline JSX, attributes, object properties, spreads,
  fragments, UTF-16 offsets, and end-exclusive ranges. Deterministic reruns and serialized-key scans
  prove that Babel nodes, native metadata, source text, and absolute fixture paths do not escape.
- Resource and robustness cases cover the 100,000-node maximum contract, invalid configured limits,
  missing required locations, and stable fatal normalization of unexpected traversal failures.
- The executed Node.js `24.18.0` gate passed 22 focused extraction tests and all 106 repository
  tests. Format, lint, typecheck, and build passed; global V8 coverage measured 97.17% statements,
  90.71% branches, 100% functions, and 97.13% lines.

## M03-T04 executed model-builder baseline

- Builder tests cover the canonical empty model, reverse multi-file input, ordinal portable-path
  ordering, deterministic global entity order, source-order retention for attributes and object
  properties, deep defensive projection, input immutability, and removal of AST/source extras.
- Path, ID, and coordinate cases reject duplicates, absolute/Windows/backslash/dot-segment paths,
  noncanonical IDs, invalid ranges, inconsistent offset/line/column mappings, mismatched file paths,
  and locations outside file/component/parent/attribute/property containers.
- Relationship cases exercise exact file and component membership, ownership, root sets,
  parent/child reciprocity and order, missing and cross-file references, self/cyclic graphs, and
  `usesJsx` consistency.
- Value cases cover supported discriminants, names and languages; exact/dynamic/partial text states;
  finite primitive literals; object confidence, property order and containment; prototype-sensitive
  keys; object cycles; and the depth/text bounds established by T03.
- Hostile control characters are preserved as inert model data, while every malformed-input case
  yields the same fatal `AnalysisModelInvariantError` without a cause, rejected value, sensitive
  path, or source detail.
- The executed Node.js `24.18.0` gate passed 26 focused builder tests and all 132 repository tests
  across 16 files. Format, lint, typecheck, and build passed; global V8 coverage measured 97.00%
  statements (973/1003), 90.31% branches (634/702), 100% functions, and 96.95% lines.

## M03-T05 executed integration/isolation baseline

- Secure-reader tests cover declared/canonical containment, root retarget and identity loss,
  path/handle snapshot changes, substituted non-regular files, POSIX no-follow/non-blocking flags,
  the Windows read-only path, exact close behavior, and stable error normalization without native
  path/message leakage.
- Byte-boundary cases accept exactly 1 MiB, reject initial or observed growth above it, limit every
  descriptor request to 64 KiB, detect short or invalid reads, reject malformed UTF-8, and prove that
  an initial BOM survives both injected and production filesystem paths.
- Composite tests prove strict `read → Babel parse → extraction` delegation, short-circuit each
  recoverable stage, propagate fatal failures, and serialize no source string or AST through the
  public parser result.
- Batch tests prove cloned ordinal input, sequential execution, deterministic output, duplicate and
  result-path invariants, fatal short-circuiting, and independent continuation after read, parse, and
  extraction failures.
- Application and real-filesystem integration tests preserve the complete `scanProject` result,
  keep discovery and parsing summaries separate, isolate malformed syntax while modeling safe
  siblings, retain locations, and prove that inert target-code sentinels are never executed. CLI
  tests preserve scan-only dependency compatibility and verify the production third summary line
  plus stable fatal-error exit mapping.
- The executed Node.js `24.18.0` gate passed all 208 repository tests across 21 files. Format, lint,
  typecheck, and build passed; global V8 coverage measured 97.63% statements, 91.86% branches, 100%
  functions, and 97.59% lines.

## M04 executed rule/catalog baseline

- Every stable rule has focused positive, negative, multiple, boundary, unsupported, metadata, and
  location assertions. Dynamic/spread values, custom abstractions, component ownership, literal
  syntax, configuration accessors/proxies, and advisory limitations have explicit cases.
- Registry/loader/evaluator tests cover malformed contracts, exact-once execution, category/ID
  intersection, experimental opt-in, deep model immutability, transactional output validation,
  canonical location provenance, deterministic sorting/counters, and recoverable sibling
  continuation.
- The controlled compiled scenario analyzes an inert TSX project without executing its sentinel and
  produces exactly one normalized finding per each of the eight stable rules. The complete result
  matches a reviewed expected JSON byte-for-byte on two runs.
- Retained scenario projections include a positive/safe/unsupported matrix, complete finding
  samples, metadata and limitations, default/category/intersection/ID/empty filters, unknown-ID
  rejection, and a thrown ninth rule whose stable error preserves all eight sibling findings.
- The isolated Node.js `24.18.0`/npm `11.16.0` evidence gate passed all 344 repository tests across
  38 files with zero known skips/todos. Clean locked install, format, lint, typecheck, build, six CLI
  smokes, harness validation, the compiled scenario, and a moderate-threshold audit passed; global
  V8 coverage measured 97.14% statements, 92.79% branches, 99.70% functions, and 97.14% lines.
- The package was collected twice. The second execution matched the source digest and stable
  measurements/scenario projections and preserved the initially published 20 artifacts.

## M05-T01 executed contract baseline

- Configuration tests verify the schema/version vocabulary, immutable defaults, fixed report names,
  stable errors, and the semantic difference between absent and explicit empty rule filters.
- Audit-result tests cover defensive recursive freezing, canonical finding/error order, complete
  zero-filled summaries, discovery/source/rule error normalization, terminal-only empty results,
  safe relative report targets, canonical timing, URL/path controls, and counter invariants.
- The exact closed JSON Schema is resolved with the local finding schema and validated against a
  complete prepared result; unexpected properties are rejected.
- A pure reporter-contract test proves that presentation receives exactly the supplied
  `AuditResult` without adding output state to the domain.
- The final task run under Node.js `24.18.0` passed all 372 tests across 41 files plus format, lint,
  typecheck, and build. Global V8 coverage passed at 95.88% statements, 90.76% branches, 99.19%
  functions, and 95.84% lines; final milestone metrics will be recollected with all M05 tasks.

## M05-T02 executed configuration baseline

- Real-filesystem cases distinguish an absent conventional file from a missing explicit path,
  accept one initial UTF-8 BOM and an explicitly authorized external regular file, and never execute
  configuration as code.
- Injected-filesystem cases cover nonregular and escaping paths, canonical-root identity change,
  exact 64 KiB acceptance, initial/observed oversize, bounded descriptor reads, malformed UTF-8,
  descriptor snapshot drift, invalid native byte counts, POSIX/Windows open flags, stable
  non-reflective failures, and exact close behavior.
- Loader cases cover defaults, partial file values, `defaults < file < CLI` precedence,
  null/empty filters, canonical ordering, malformed JSON, schema/key/value/rule rejection,
  duplicates, unsafe portable paths, accessors, sparse arrays, defensive copies, freezing, and
  byte-stable normalized results.
- The final task run under Node.js `24.18.0` passed all 435 tests across 43 files plus format, lint,
  typecheck, and build. Global V8 coverage passed at 95.77% statements, 91.08% branches, 99.29%
  functions, and 95.72% lines; final milestone metrics will be recollected with all M05 tasks.

## M05-T03 executed terminal baseline

- Exact no-color output covers complete file/rule/category/severity/error summaries, canonical
  findings, recommendations, limitations, references, display coordinates, and verbose discovery,
  source, and rule errors.
- Color tests prove that only fixed badges receive ANSI and stripping those sequences yields the
  no-color report byte-for-byte. The five inclusive thresholds preserve full totals and input order.
- Empty/hidden findings, null locations/references, non-verbose errors, every source stage, and
  repeat rendering have explicit cases. Frozen input remains unchanged.
- Hostile project, file, title, message, explanation, recommendation, limitation, reference, and
  tool strings cover C0/C1 controls, injected lines, ANSI/OSC, bidi/isolates, unpaired surrogates,
  and valid astral Unicode. Existing CLI hostile-output cases pass through the compatibility
  re-export.
- The final task run under Node.js `24.18.0` passed all 449 tests across 44 files plus format, lint,
  typecheck, and build. Global V8 coverage passed at 95.94% statements, 91.42% branches, 99.31%
  functions, and 95.90% lines; final milestone metrics will be recollected with all M05 tasks.

## M05-T04 executed JSON and persistence baseline

- JSON tests assert exact two-space/LF bytes, complete local-schema equality, retained timing and
  zero-based coordinates, hostile-string round trips, explicit empty buckets, deterministic repeat
  rendering, and input immutability.
- Shared-writer tests cover closed request validation, fixed JSON/HTML target selection, portable
  directory creation, exclusive/no-follow flags and modes, real-filesystem exact output and
  no-overwrite preservation, bounded partial writes, sync/close behavior, and stable native-error
  normalization.
- Injected races replace roots, ancestors, or targets before and after open/write/close. Symlink,
  escape, snapshot mismatch, invalid byte-count, proxy/accessor, and failed-operation paths never
  return success. The final successful observable filesystem operation is target authorization.
- The final task run under Node.js `24.18.0` passed all 490 tests across 46 files plus format, lint,
  typecheck, and build. Global V8 coverage passed at 95.66% statements, 91.19% branches, 99.36%
  functions, and 95.62% lines; final milestone metrics will be recollected with all M05 tasks.

## M05-T05 executed HTML baseline

- Standalone-document tests lock the exact deterministic digest, UTF-8/LF envelope, early CSP,
  constant inline styling, and absence of script, event-handler attributes, resource-bearing tags,
  external assets, `@import`, or CSS URLs.
- Complete-result cases cover metadata, configuration null versus empty selections, report paths,
  timing, all file/rule/category/severity/stage counters, every finding/error variant, null
  locations/references/URLs, both UTF-16 offsets, one-based display columns, and end-exclusive
  ranges. Terminal severity and verbosity settings do not suppress HTML records.
- Hostile values exercise closing tags, script/image/event payloads, C0/C1 and terminal controls,
  bidi/isolates, BOM, line separators, lone surrogates, metacharacters, and valid emoji. Forged URL
  tests keep non-HTTP(S), credential-bearing, malformed, controlled, and object values inert while
  canonical credential-free HTTP(S) becomes one escaped link.
- Cross-reporter assertions compare every finding field and processing-error discriminator in
  contextual records, account for JSON zero-based versus human one-based coordinates, and prove
  canonical order inside a shared severity bucket. Exact writer delegation, null selection, stable
  failure propagation, repeat rendering, and frozen-input immutability are covered.
- The final focused reporter/writer run passed 77 tests. The complete Node.js `24.18.0` product run
  passed 512 tests across 47 files. Global V8 coverage measured 95.81% statements, 91.39% branches,
  99.39% functions, and 95.77% lines; the HTML module measured 100% statements/functions/lines and
  97.82% branches. Final isolated M05 evidence recollects these metrics.

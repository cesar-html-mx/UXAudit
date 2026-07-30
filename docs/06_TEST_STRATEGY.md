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

## M06-T01 executed integration baseline

- Application tests compose validated input, configuration precedence, one normalized analysis,
  stable-rule loading/evaluation, exact audit counters, timing, and selected JSON/HTML persistence.
  They distinguish omitted from explicit empty filters, retain recoverable rule/source errors,
  reject root drift after authorization, preserve stable writer failures, and normalize unexpected
  stage or renderer failures without leaking native detail.
- Real-filesystem integration analyzes an inert React/TypeScript project with eight stable-rule
  findings and one malformed sibling, writes complete JSON and HTML reports, refuses overwrite, and
  proves that target code is not executed.
- CLI tests cover every documented option, Commander source-aware file/CLI precedence, canonical
  repeatable-value ordering, exit `0` for completed findings/recoverable errors, input exit `2`,
  fatal/report exit `3`, direct trusted terminal ANSI, escaped hostile progress/report claims, and
  claims derived only from successful writer results. Exit `1` remains reserved because no
  finding-failure policy exists.
- The compiled smoke suite now covers 11 complete scenarios: help, version, hostile unknown input,
  empty/default audit, all reporters with a recoverable malformed source, overwrite refusal,
  explicit empty filters and CLI precedence, invalid configuration, missing path, regular-file
  input, and missing arguments.
- The final task run under Node.js `24.18.0` passed format, lint, typecheck, build, all 548 tests
  across 50 files, and all 11 compiled smokes. Global V8 coverage measured 95.88% statements,
  91.46% branches, 99.80% functions, and 95.84% lines. Accuracy, performance, full security, and
  usability claims remain assigned to M06-T03 through M06-T05.

## M06-T02 executed controlled-project baseline

- A closed, canonical manifest versions the exact eight-rule vocabulary, source candidates,
  exclusions, parser errors, finding counts/case IDs, volatile result fields, non-execution
  sentinels, runtime links, and large-project generation parameters.
- The committed `valid-project` produces zero findings; `invalid-project` produces exactly one
  finding for each stable rule; and `mixed-project` selects five `.js`/`.jsx`/`.ts`/`.tsx`
  candidates, parses four, isolates one syntax error, and produces three reviewed findings while
  excluding declarations, configuration, and generated directories.
- The runtime hostile/security project adds three default-skipped internal, external, and cyclic
  links plus a portable hostile filename that reaches escaped HTML through one controlled finding.
  Link creation capability is recorded rather than assumed on platforms that prohibit symbolic
  links.
- The generated large project contains 240 safe TSX components across 12 directories. Its source
  template, paths, package-script sentinel, and five-run performance parameter are versioned rather
  than committing generated bulk.
- The shell-free built-CLI scenario audits all five projects twice in fresh roots, verifies exact
  expected results, terminal/JSON/HTML consistency, report claims, stable projections, and absent
  source/package sentinels. Six focused manifest/corpus tests lock the physical and semantic
  contract. The complete Node.js 24 gate passed 554 tests across 51 files; coverage remained at
  95.88% statements, 91.46% branches, 99.80% functions, and 95.84% lines.

## M06-T03 executed accuracy baseline

- A separate closed ground truth versions 27 instance-level cases: 11 positive, eight negative,
  and eight unsupported. Every stable rule has at least one positive plus exactly one explicit
  negative and one unsupported boundary; absent nodes and unrelated combinations are never counted
  as true negatives.
- The built CLI produces the observed JSON findings. A second analysis pass is used only to map
  `data-uxaudit-case` nodes to half-open model ranges; matching requires the same project, rule,
  portable file, and contained offsets. Duplicate or unassigned findings count as false positives.
- Positive detections/misses become TP/FN; negative detections/clear cases become FP/TN.
  Unsupported cases and their observed count are reported separately and excluded from both
  precision and recall denominators.
- The pure metrics boundary validates closed plain input, deterministic rule order, safe integer
  arithmetic, duplicate case identity per rule, null zero-denominator ratios, and input
  immutability. Twenty-one focused tests cover normal, adversarial, and overflow cases.
- All eight rules matched reviewed expectations: 11 TP, zero FP, eight TN, zero FN, and zero
  unsupported detections. Per-rule precision and recall were both 1.0 within this controlled
  synthetic corpus only; no aggregate or real-world generalization is claimed.
- The final Node.js 24 gate passed 577 tests across 53 files. Global V8 coverage measured 95.84%
  statements, 91.39% branches, 99.81% functions, and 95.80% lines.

## M06-T04 executed robustness, performance, and security baseline

- The shell-free robustness runner executed 15 built-CLI cases on Linux. All cases passed, including
  canonical and missing roots, a missing scan argument, malformed configuration, output path
  escape, symlinked output rejection, exclusive-write preservation, malformed-source isolation, a
  source below 32 nested directories, hostile reporting, deterministic reruns, real permission
  denial, and the generated large project.
- The real filesystem denied both the selected project root and report destination as intended.
  UXAudit returned the documented input and report-write failures without leaking native details;
  the runner retains portable fallback references for environments where permission denial cannot
  be reproduced.
- All three runtime links in the hostile project—internal, external, and cyclic—were created and
  excluded by the default policy. JSON remained valid, while structural HTML assertions confirmed
  hostile-path escaping, the restrictive CSP, and the absence of executable/resource-bearing
  markup, event handlers, raw controls, and CSS resource loading. This was not a browser exploit
  execution.
- Fresh hostile roots produced identical stable JSON and normalized HTML. Five complete built-CLI
  runs processed the generated 240-file project, retained exact expected results and absent
  execution sentinels, and recorded elapsed samples plus the maximum child `VmRSS` observed through
  5 ms `/proc` sampling. The performance record is a descriptive baseline with minimum, median, and
  maximum values and no machine-dependent pass threshold; the memory value is not claimed as an
  exact lifetime peak.
- The moderate-threshold dependency audit reported zero vulnerabilities. Lockfile and strict
  installation policy checks passed. Hosted CodeQL was not executed because no hosted result was
  retrieved; the local workflow inspection is recorded separately and is not presented as an
  analysis result.
- The Node.js 24 gate passed all 602 tests across 54 files, all 11 compiled CLI smokes, the
  controlled-project, accuracy, and 15-case robustness scenarios, and harness validation. Global V8
  coverage measured 95.84% statements, 91.50% branches, 99.82% functions, and 95.79% lines.

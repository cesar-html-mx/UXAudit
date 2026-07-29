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

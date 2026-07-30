[Español](es/06_TEST_STRATEGY.md) | **English**

# Test strategy

## Goals

Testing must show that UXAudit:

- produces correct normalized results for supported static cases;
- remains deterministic for stable inputs;
- isolates recoverable file and rule failures;
- rejects unsafe paths, malformed configuration, and broken invariants;
- never executes or modifies target code;
- renders equivalent facts through terminal, JSON, and HTML;
- can be installed and run from the package users receive.

## Test layers

| Layer               | Focus                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| Unit                | Pure validators, ordering, model construction, rules, summaries, escaping, and rendering.          |
| Integration         | Filesystem adapters, parser/model composition, configuration precedence, rule engine, and writers. |
| CLI                 | Arguments, help, progress, safe output, report announcements, and exit-code mapping.               |
| System              | Built executable against controlled valid, invalid, mixed, hostile, and larger projects.           |
| Distribution        | Packed file allowlist, metadata, executable bit, install, binary resolution, and consumer scan.    |
| Security/robustness | Links, traversal, permissions, malformed data, hostile values, size bounds, and non-execution.     |

Public behavior requires positive, negative, boundary, and error cases at the lowest useful layer,
plus an end-to-end case when composition can change the result.

## Focused repository commands

| Command                           | Scope                                                                      |
| --------------------------------- | -------------------------------------------------------------------------- |
| `npm test`                        | Complete focused Vitest suite.                                             |
| `npm run test:coverage`           | V8 coverage and global thresholds.                                         |
| `npm run test:smoke`              | Built CLI command and exit-code smoke cases.                               |
| `npm run test:scenario:discovery` | Deterministic traversal, inventory, classification, links, and exclusions. |
| `npm run test:scenario:parser`    | Safe reads, parsing, extraction, model building, and isolation.            |
| `npm run test:scenario:rules`     | Rule catalog, filters, ordering, findings, and failure isolation.          |
| `npm run test:scenario:reporting` | Configuration, reporters, escaping, and safe persistence.                  |
| `npm run test:scenario:system`    | Complete audits over controlled projects through the built CLI.            |
| `npm run test:accuracy`           | Reviewed per-rule detection cases and confusion-matrix calculation.        |
| `npm run test:robustness`         | Invalid input, security, determinism, and descriptive performance cases.   |
| `npm run test:usability`          | Repeatable expert review of core developer tasks.                          |
| `npm run test:package`            | npm tarball contents, installation, executable, and consumer workflow.     |

`npm run verify` is the normal contributor gate. `npm run release:check` composes the full local
public-release gate.

## Controlled projects

System fixtures cover:

- a valid project with no expected findings;
- an invalid project with one reviewed trigger for each built-in rule;
- a mixed JavaScript/TypeScript project with findings, safe exclusions, and a recoverable syntax
  failure;
- a hostile project for Unicode, links, HTML escaping, and target-code non-execution;
- a generated larger project for repeated full-pipeline observations.

Expected results are versioned at the semantic level. Comparisons normalize only documented volatile
fields such as canonical temporary roots, timestamps, duration, and machine-dependent memory
observations.

## Rule testing

Every rule needs:

- metadata validation and unique ID coverage;
- at least one supported positive case;
- at least one supported negative case;
- dynamic or unsupported cases that must not become unjustified findings;
- exact source location, message, severity, confidence, recommendation, and limitation assertions;
- isolated behavior when another rule fails.

Accuracy calculations use reviewed instances. Positive cases contribute to true-positive or
false-negative counts; negative cases contribute to true-negative or false-positive counts.
Unsupported cases stay outside precision and recall denominators and are reported separately. Scores
from a controlled corpus must not be generalized to arbitrary React projects.

## Security and robustness testing

Use real filesystem operations when portable and injected adapters for races or permission behavior
that cannot be reproduced safely. Cover:

- missing, empty, file, unreadable, and changed roots;
- in-root, outside-root, dangling, cyclic, and skipped symbolic links;
- malformed, oversized, invalid UTF-8, changed, and non-regular source candidates;
- unsafe, linked, existing, partially written, and inaccessible report targets;
- hostile terminal controls, bidirectional characters, HTML content, and link references;
- malformed, oversized, unknown, duplicate, and conflicting configuration values;
- target modules containing sentinels that would reveal accidental execution.

Security tests verify fail-closed behavior and stable safe messages, not native platform wording.

## Performance testing

Performance checks exercise the complete built CLI over a documented project size and environment.
Record repeated wall-clock durations and memory observations without turning one machine's values
into a portable pass threshold. Functional limits, deterministic output, and bounded resource
operations remain enforced independently of timing.

## Usability testing

Core developer tasks include installation, help discovery, default scan, file-report generation,
rule filtering, and interpreting a finding. Automated or expert review can identify friction, but it
must not be described as participant research. Participant results and standardized usability scores
are reported only when real participants completed the defined protocol.

## Coverage and release policy

Global coverage thresholds are at least 90% for statements, branches, functions, and lines. New code
should keep focused branches meaningful rather than satisfying coverage through incidental execution.

A release candidate passes formatting, bilingual documentation, lint, strict type checking, all
required tests, build, package installation, system scenarios, and a moderate dependency audit.
No required test may be skipped or marked todo. Platform-specific checks must state when they were
not executable instead of being presented as passed.

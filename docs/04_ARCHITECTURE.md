# Architecture

## Style

UXAudit uses a staged processing pipeline with application orchestration and domain contracts. The
main flow is intentionally directed:

```text
CLI
  -> AuditOrchestrator
  -> ProjectDiscovery
  -> FileInventory
  -> FileClassifier
  -> SourceParser
  -> AnalysisModelBuilder
  -> RuleLoader / RuleEvaluator
  -> AuditResult
  -> Terminal / JSON / HTML Reporters
```

## Packages

```text
src/
├── cli/
├── application/
├── project/
│   ├── discovery/
│   ├── inventory/
│   └── classification/
├── parsing/
├── domain/
│   ├── models/
│   ├── rules/
│   ├── findings/
│   └── errors/
├── rules/
│   ├── ux/
│   ├── accessibility/
│   ├── seo/
│   └── performance/
├── reporting/
│   ├── terminal/
│   ├── json/
│   └── html/
├── configuration/
└── shared/
```

The exact filenames may evolve, but the dependency direction and responsibility boundaries may not
be collapsed without an architecture decision.

## Implemented through M03

```text
src/cli/index.ts
  -> src/cli/run-cli.ts
       -> src/cli/sanitize-terminal.ts
  -> src/application/analyze-project.ts
  -> src/application/scan-project.ts
       -> src/project/validate-project-path.ts
       -> src/project/discovery/
       -> src/project/inventory/
       -> src/project/classification/
  -> src/parsing/analyze-source-candidates.ts
       -> src/parsing/babel/parse-source-candidate.ts
            -> src/parsing/read-source-candidate.ts
            -> src/parsing/babel/parse-babel-source.ts
            -> src/parsing/babel/extract-babel-analysis.ts
  -> src/domain/models/build-analysis-model.ts
```

- `cli/index.ts` is the only process boundary. It supplies arguments and streams and assigns
  `process.exitCode`.
- `run-cli.ts` owns Commander grammar and maps `ScanProjectError` application errors to terminal
  output and exit codes. It receives I/O, the preserved scan application function, and an optional
  analysis facade as dependencies. Existing injected scan-only callers keep their two-line behavior;
  the production entry point supplies `analyzeProject` and appends the stable parsing summary. It
  does not import project or parsing adapters. Its output boundary converts terminal control and
  bidirectional characters in untrusted values to visible Unicode escapes.
- `scan-project.ts` composes `validation → discovery → inventory → classification`, retains each
  normalized stage result, computes the discovery summary, and maps fatal stage failures into stable
  application errors. M03 does not change this completed M02 public contract.
- `analyze-project.ts` composes `scanProject → source-candidate analysis → model construction`.
  Recoverable parser errors remain separate from the model and discovery counters; fatal
  source-analysis and model failures map to distinct stable application errors without causes.
- `validate-project-path.ts` uses an injectable filesystem adapter to execute
  `resolve → realpath → stat → access(R_OK | X_OK)`.
- The focused project modules traverse with Node APIs, build an invariant-checked inventory, and
  classify parser candidates without reading or executing source code.

The current CLI slice still ends after parser-independent model construction. M04 adds a
report-independent domain rule engine that can evaluate an already constructed model and produce
normalized findings/errors in isolation, but application/CLI integration and `AuditResult`
construction remain M05 work.

## Core contracts

### ProjectDiscovery

Input: validated project root and discovery configuration.  
Output: discovered file records and recoverable discovery errors.

M02 implements this contract with an iterative, ordinally sorted traversal. The selected canonical
root remains the authorization boundary. Every candidate target is resolved canonically and checked
with path-relative containment; configured names are checked on both the observed entry and the
canonical target. Symbolic links are skipped by default, while the internal opt-in follows only
targets within the root and tracks visited canonical directories. Descendant operation failures are
normalized and isolated; losing the root is fatal.

### FileInventory

Normalizes canonical and project-relative paths, deduplicates entries, and returns deterministic
ordering.

M02 defines identity as the canonical absolute file path. Inventory entries retain that native
absolute path, derive a portable `/`-separated project-relative path, normalize the final extension
to lowercase, and carry only the justified `file` kind. Canonical aliases deduplicate and entries
sort ordinally by relative path. A non-descendant record is an internal invariant failure.

### FileClassifier

Selects supported source candidates. Classification may use extension and conservative source
signals. It must not falsely claim that every supported extension is a React component.

M02 derives the actual suffix from the inventory's portable relative path and maps supported files
only to JavaScript/TypeScript plus JSX/non-JSX parser kinds. It excludes declaration and
conventionally named configuration sources, reads no file content, and exposes no React component
field. Semantic detection remains exclusively in M03's parser and model stages.

### SourceParser

Parses one source file and returns either a parser result or a typed per-file error. Parser internals
must not leak to rules.

M03 defines this boundary as a discriminated `SourceParserResult`. A successful result contains one
AST-free `AnalyzedSourceFile`; an expected read, syntax, or extraction problem contains a stable
recoverable error with the portable file path, stage, code, and optional source position. Native
filesystem/Babel causes, code frames, absolute paths, source text, and AST values are not part of
the contract.

The Babel 8 adapter is isolated under `src/parsing/babel/`. It parses exactly one supplied string,
does not load project or host Babel configuration, and selects plugins from the classified source
kind: JavaScript, JavaScript with JSX, TypeScript, or TypeScript with JSX. It uses unambiguous
script/module detection, retains locations and the relative filename, disables partial error
recovery, and normalizes thrown parser failures before they leave the adapter boundary.

M03-T05 adds the source-opening and batch halves of the boundary:

- `read-source-candidate.ts` treats the M02 inventory as candidates, not authorization. It validates
  that the supplied root is its stable absolute canonical directory, checks declared and canonical
  candidate containment, and compares device/inode plus size, modification time, and change time
  across path and handle snapshots. A structurally non-portable candidate declaration is a generic
  fatal invariant, so it cannot be reflected into a recoverable path field.
- POSIX opens use read-only, no-follow, and non-blocking flags; Windows uses the portable read-only
  flag and the same post-open identity checks. The verified descriptor is the only source-content
  read path and is closed exactly once.
- Source size is limited to 1,048,576 bytes. Reads request at most 65,536 bytes and one bounded
  extra byte detects growth beyond the limit. Strict UTF-8 decoding rejects malformed bytes;
  `ignoreBOM: true` preserves an initial U+FEFF in the string supplied to Babel.
- `parse-source-candidate.ts` composes reader, Babel parser, and extractor in that order. A
  recoverable result stops only the remaining stages for that candidate; the transient source string
  and Babel AST never cross the composite boundary.
- `analyze-source-candidates.ts` clones and ordinally sorts candidates, rejects duplicate/mismatched
  paths as fatal invariants, and processes one candidate at a time. Expected read, parse, and
  extraction failures are collected in deterministic order while safe siblings continue.

M03-T03 adds the internal Babel-to-domain extraction adapter. It visits the AST once, up to 100,000
nodes, and then orders extracted records by source offset with ordinal tie-breakers. The adapter
recognizes syntactically justified PascalCase function declarations, arrow/function expressions,
supported `Component`/`PureComponent` class forms, and anonymous default exports. A class owns JSX
only through its instance `render` method; nested functions and class members form ownership
boundaries. JSX inside an attribute is retained as a separate relationship root rather than as a
rendered child of the receiving element.

Intrinsic, custom, member/namespaced, shorthand-fragment, and `React.Fragment` syntax is projected
to UXAudit names and node kinds. Named and spread attributes preserve source order. Finite primitive
and static-template values are exact; bounded object properties are retained as ordered data;
computed, spread, non-finite, deep, or otherwise unresolved values remain partial or dynamic.
Descendant text is whitespace-normalized with exact, partial, or dynamic confidence and retains at
most 256 UTF-16 code units per JSX node. Custom descendants and dynamic expressions cannot be
promoted to exact text.

Expected missing-location or resource-limit cases become stable recoverable extraction errors.
Broken internal traversal or relationship invariants are fatal and expose only the stable
`BabelAnalysisInvariantError`, not parser-native details. Babel nodes, source strings, native causes,
and absolute paths remain inside the adapter boundary.

### AnalysisModelBuilder

Converts parser output into UXAudit domain models containing only justified information needed by
rules. It preserves source locations and can be extended deliberately.

The M03 contracts use a flat serializable model of files, syntactically justified components, and
JSX nodes connected by deterministic IDs. Elements distinguish intrinsic from custom names;
fragments remain explicit; attributes distinguish named from spread values; and values/text carry
exact, partial, or dynamic confidence. Literal objects retain bounded named properties so the
initial catalog can inspect `style.fontSize` without retaining an expression tree.

Every location contains a portable project-relative file path and a half-open range. Lines are
one-based; columns and offsets are zero-based UTF-16 code-unit indexes. The model contains neither
the absolute project root nor complete source content.

M03-T03 implements the per-file extraction half of this boundary: file, component, JSX, attribute,
object-property, relationship, confidence, and location records are AST-free and deterministic.

M03-T04 implements the project half through `buildAnalysisModel`. The builder treats every
`AnalyzedSourceFile` as boundary input and recursively projects only documented fields into fresh
objects and arrays. It never retains input references or parser/source extras. Files are ordered
ordinally by canonical portable relative path; components and JSX nodes are rebuilt in file/source
order, and each supplied ID must equal the canonical value derived from that path and UTF-16 start
offset. Attribute and object-property order remains source-significant. The flat normalized arrays
already meet the documented rule needs, so no speculative query API is exposed.

Construction validates safe integer coordinates, cross-location consistency and containment;
canonical and unique IDs; exact file/component membership and ownership; non-empty component root
sets; reciprocal, same-owner parent/child links; and acyclic JSX graphs. It also validates supported
discriminants, finite literal values, exact/dynamic/partial confidence combinations, static-text
length, bounded object depth, and cyclic object input. `usesJsx` must match the JSX inventory.
Control and bidirectional characters in an otherwise portable file path remain untrusted data rather
than being normalized away; later presentation boundaries own escaping.

Any malformed builder input is an internal integrity failure. The boundary catches its details and
throws only the fatal `AnalysisModelInvariantError`, whose stable code and message contain no input,
native cause, absolute path, or source text.

### Rule

M04-T01 defines one immutable `Rule` as:

- `RuleMetadata`: stable ID, title, category, default severity, catalog status, explanation,
  actionable recommendation, nullable structured reference, and explicit limitations;
- `RuleContext`: the normalized `AnalysisModel` and no parser or reporter state;
- a synchronous `evaluate` operation that returns zero, one, or multiple rule-local observations
  containing a message, confidence, and nullable `SourceLocation`.

Categories are `accessibility`, `performance`, `seo`, and `ux`. Severities are `info`, `low`,
`medium`, `high`, and `critical`; finding confidence is independently `low`, `medium`, or `high`.
A rule is independent of report format, does not import Babel, and does not depend on another
rule's execution.

### Finding

M04-T01 normalizes a rule observation and its metadata into one self-contained `Finding`. It
retains rule ID/title, category, severity, message, explanation, recommendation, reference,
limitations, confidence, and a nullable defensive copy of the complete M03 half-open source
location.
Coordinates remain one-based for lines and zero-based for columns/offsets. Presentation-specific
line/column conversion belongs to reporters in M05.

Rule failures are not findings. A recoverable `RuleExecutionError` contains only the rule ID,
category, stable code/message, and recoverability flag; native causes and target-project content do
not cross this boundary. `RuleEvaluationResult` keeps findings, execution errors, and explicit
available/enabled/succeeded/failed/finding counters without any presentation state.
The executed counter records every attempted enabled rule and equals succeeded plus failed.

### RuleEvaluator

M04-T02 separates registry, loading, and evaluation:

- `createRuleRegistry` validates and defensively copies an explicit rule list, rejects malformed
  metadata, unsafe/non-HTTP(S) references, deferred executable rules, or duplicate IDs through
  stable fatal errors; it freezes the registered contracts and orders them ordinally by rule ID.
- `loadRules` validates optional category and rule-ID allowlists. When both exist they intersect;
  an empty allowlist selects no rules, an unknown rule ID is an error, and absent filters select the
  stable/required portion of the explicit registry. Experimental rules require exact rule-ID
  opt-in. Invalid containers, unknown keys, and throwing accessors fail closed.
- `evaluateRules` calls every loaded rule exactly once over the same trusted `AnalysisModel`.
  Thrown evaluation failures and malformed results become stable recoverable per-rule errors. A
  malformed rule's entire candidate batch is discarded before safe sibling results are accepted.

Every non-null finding location must exactly match a file, component, JSX node, attribute, or
retained object-property location in the model. This prevents a rule result from introducing an
absolute or otherwise untraceable path. Accepted findings sort by rule ID, portable file path,
start/end offset, and message; execution errors sort by rule ID. The result records
available, enabled, executed, succeeded, failed, and finding counts.

Isolation assumes the M03 model remains valid and rules respect the readonly contract. The engine
deep-freezes that model once before evaluation so an unsafe runtime cast cannot mutate it and
contaminate a later rule. It does not clone or reparse the project per rule.

`initialRuleRegistry` explicitly assembles the eight stable M04 rules: three accessibility, two
performance, two SEO, and one UX rule. Category modules remain independently testable; the registry
is the canonical default catalog and sorts their IDs before loading. Rule-specific factories
capture validated ambiguous-link phrases and the inline-text pixel threshold without adding mutable
configuration to `RuleContext`.

### Reporter

M05-T01 defines a pure reporter as a format identity plus `render(result): string`. It transforms
exactly one completed `AuditResult` into a representation and never discovers, parses, reevaluates
rules, mutates the result, or writes through the domain contract. Terminal/JSON/HTML adapters and
their optional filesystem writer remain presentation boundaries.

### Configuration

The normalized M05 configuration is a complete schema-versioned value with category/rule filters,
selected terminal/JSON/HTML formats, a portable project-relative output directory, minimum display
severity, color, and verbosity. `null` filters mean the stable default catalog; empty arrays
intentionally enable no rules. Defaults select terminal output, `info`, color, non-verbose detail,
and `uxaudit-reports`. Configuration-file and CLI values remain untrusted until T02 validates and
merges them; no project configuration module is imported or executed.

### AuditResult

M05-T01 defines `AuditResult` schema `1.0.0` as the single recursively frozen value consumed by
every reporter. It contains:

- the normalized configuration plus tool/schema versions;
- the canonical project root and canonical UTC start/completion timestamps with duration;
- discovered, selected, parsed, and failed-file counters;
- the complete M04 available/enabled/executed/succeeded/failed/finding counters and findings;
- normalized recoverable discovery, source read/parse/extract, and rule errors;
- explicit totals for every category, severity, and processing stage, including zero buckets; and
- nullable project-relative JSON/HTML paths resolved from the controlled output directory and fixed
  `audit-report.json`/`audit-report.html` names.

The builder defensively copies upstream data, derives summaries, restores canonical finding/error
order, rejects contradictory counters or malformed boundary data through one detail-free invariant
error, and freezes the result without freezing caller-owned input. Stored source coordinates keep
M03's one-based lines and zero-based UTF-16 columns/offsets. Human reporters may convert columns for
display; JSON must preserve the domain coordinates.

## Persistence

The initial version has no database. Configuration, JSON, HTML, and optional logs are local files.
Transient inventory, AST adapter output, model, and findings remain in memory during an audit.

## Error boundaries

- Invalid CLI/path/configuration: stop before analysis.
- Fatal discovery, inventory, or classification failure: stop with a stable application error.
- Descendant discovery or expected read/parse/extraction error: record it and continue other files
  when safe.
- Non-portable candidate declaration, canonical-root authorization loss, candidate-batch invariant,
  unexpected extraction invariant, or invalid normalized model: stop with a stable fatal error.
- Individual rule error: record it and continue other rules when model integrity remains valid.
- Report write failure: report the failure clearly; do not claim that output was generated.
- Internal invariant failure: stop with an unrecoverable error.

## Security boundaries

Analyzed projects are untrusted input. Never execute their code, import their modules, interpolate
their text into HTML without escaping, or traverse outside the approved root.

The user may explicitly select any root, including one reached through `..` or a symlink. UXAudit
uses that root's canonical `realpath` as the approved boundary. M02 checks each traversed canonical
descendant against that root before reading metadata outside the boundary and handles actual
operation failures. M03 reauthorizes the root and each source around a bounded descriptor read and
fails closed on observed changes. Portable filesystem APIs still cannot eliminate a replacement in
the interval between the final path check and later use; downstream behavior therefore consumes
only the already-read handle bytes and retains this residual TOCTOU limit explicitly.

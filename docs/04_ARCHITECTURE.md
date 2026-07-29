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

## Implemented through M02

```text
src/cli/index.ts
  -> src/cli/run-cli.ts
       -> src/cli/sanitize-terminal.ts
  -> src/application/scan-project.ts
       -> src/project/validate-project-path.ts
       -> src/project/discovery/
       -> src/project/inventory/
       -> src/project/classification/
```

- `cli/index.ts` is the only process boundary. It supplies arguments and streams and assigns
  `process.exitCode`.
- `run-cli.ts` owns Commander grammar and maps `ScanProjectError` application errors to terminal
  output and exit codes. It receives I/O and the scan application function as dependencies, prints
  the preserved canonical-root line plus a stable discovery summary, and does not import project
  adapters. Its output boundary converts terminal control and bidirectional characters in untrusted
  values to visible Unicode escapes.
- `scan-project.ts` composes `validation → discovery → inventory → classification`, retains each
  normalized stage result for M03, computes the summary, and maps fatal stage failures into stable
  application errors.
- `validate-project-path.ts` uses an injectable filesystem adapter to execute
  `resolve → realpath → stat → access(R_OK | X_OK)`.
- The focused project modules traverse with Node APIs, build an invariant-checked inventory, and
  classify parser candidates without reading or executing source code.

This slice ends after source-candidate classification. It does not parse files, infer components,
run rules, or create an `AuditResult`.

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

Contains metadata and an evaluation operation over the analysis model. A rule is independent of
report format and should not depend on another rule's execution.

### RuleEvaluator

Runs enabled rules in deterministic order, isolates rule failures when safe, and returns findings plus
execution errors.

### Reporter

Transforms one `AuditResult` into a representation. It never discovers, parses, or reevaluates rules.

## Persistence

The initial version has no database. Configuration, JSON, HTML, and optional logs are local files.
Transient inventory, AST adapter output, model, and findings remain in memory during an audit.

## Error boundaries

- Invalid CLI/path/configuration: stop before analysis.
- Fatal discovery, inventory, or classification failure: stop with a stable application error.
- Descendant file access or parser error: record it and continue other files when safe.
- Individual rule error: record it and continue other rules when model integrity remains valid.
- Report write failure: report the failure clearly; do not claim that output was generated.
- Internal invariant failure: stop with an unrecoverable error.

## Security boundaries

Analyzed projects are untrusted input. Never execute their code, import their modules, interpolate
their text into HTML without escaping, or traverse outside the approved root.

The user may explicitly select any root, including one reached through `..` or a symlink. UXAudit
uses that root's canonical `realpath` as the approved boundary. M02 checks each traversed canonical
descendant against that root before reading metadata outside the boundary and handles actual
operation failures; the access check remains a TOCTOU-susceptible preflight, and M03 must revalidate
each file when it is opened.

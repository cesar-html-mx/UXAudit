# M07 milestone report

## Decision: GO

M07 demonstrated before its six-hour deadline that UXAudit can conservatively connect supported
local React component uses to definitions and use the resulting parser-independent graph for a
composition-sensitive rule. The implementation is viable and authorizes the separately bounded M08
work; it does not by itself claim that every rule now understands arbitrary real-world composition.

The reviewed corpus contains 7 components, 17 JSX nodes, 10 custom uses, 8 exact links, 2 unresolved
uses, one stored cycle, and exactly 2 findings. `seo/multiple-h1` now detects the Page/Header/Hero
case at `src/App.tsx:9:5`; existing direct-local behavior remains stable. Repeated uses, child cause
ownership, cycles, ambiguity, 64/65-hop behavior, independent 100000-step budgets, reversed input,
and target non-execution are executable tests.

The complete Node.js 24.18.0 release gate passed 654 tests across 61 files. Coverage is 95.27%
statements, 90.26% branches, 99.50% functions, and 95.24% lines. All compiled scenarios, the clean
package consumer, and dependency audit passed. The built CLI produced byte-identical output across
two corpus runs. Independent acceptance review returned GO for all ten criteria, and independent
bilingual-documentation review found no overclaim or language-parity blocker.

## Safeguard status

Public `main` remains at `de540f0ec3d3a7d198905eccd06eae46bc3ac3e7`; published npm version
0.1.0, historical branches/tags/evidence, and the external demo were not modified. All M07 work is
isolated on `milestone/m07-component-graph`. The branch can still be discarded without changing the
academic fallback.

## Remaining boundary

M07 intentionally does not propagate arbitrary props or `children`, resolve packages/path aliases,
interpret runtime routes/conditions, or adapt the remaining catalog rules to component context.
Those items require the separately queued M08 contract and realistic consumer validation. Therefore
M07 is a GO for technical feasibility, not a release or merge authorization by itself.

# M07 acceptance self-review

|   # | Acceptance criterion                                                                | Result | Evidence                                                                     |
| --: | ----------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
|   1 | Default, named, and aliased direct relative imports link exactly                    | PASS   | extraction, resolver, and full corpus tests                                  |
|   2 | Local uses use binding identity and respect shadowing                               | PASS   | focused Babel binding tests                                                  |
|   3 | Missing, package, namespace, root escape, reexport, and ambiguity remain unresolved | PASS   | negative extraction/resolver tests and two manifest controls                 |
|   4 | Page importing Header and Hero reports the composed heading at an exact location    | PASS   | rule test and CLI location `src/App.tsx:9:5`                                 |
|   5 | Repeated use has explicit multiplicity without automatic duplicate child causes     | PASS   | repeated-use and invalid-child ownership tests                               |
|   6 | Cycles terminate safely and deterministically                                       | PASS   | A/B cycle model, rule, and full corpus tests                                 |
|   7 | Target code is never imported or executed                                           | PASS   | sentinel assertions before/after application and CLI analysis                |
|   8 | Reversed analyzed-file input preserves links and findings                           | PASS   | byte-identical forward/reverse model plus exact link/finding assertions      |
|   9 | Published behavior has no unintended regression and required tests are not skipped  | PASS   | 654/654 tests passed; no skipped/todo tests                                  |
|  10 | Product, coverage, package, and harness gates pass on the pinned runtime            | PASS   | release gate, coverage table, clean package consumer, and harness validation |

Architecture review confirmed that Babel scope objects remain inside extraction, rules consume only
`AnalysisModel`, model construction does not expand cycles, resolution fails closed, and output order
is deterministic. The initial independent review defects were corrected before this decision.

A final independent acceptance review rated all ten criteria GO with no functional blocker. A
separate bilingual-documentation review passed structure and semantics and confirmed that the public
text does not overstate this bounded static capability as complete React rendering or interpretation.

M07 does not claim general runtime React interpretation. It proves a bounded, static graph for exact
direct local imports and one composition-aware rule. Props, `children`, aliases, barrels, routers,
higher-order components, and broader contextual rule propagation remain M08 or explicitly
unsupported work.

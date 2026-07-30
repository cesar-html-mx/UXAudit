# UXAudit Evidence

Each milestone stores reproducible evidence here. Use the template in
`.github/harness/templates/TEST_EVIDENCE_TEMPLATE.md`.

Required structure:

```text
evidence/
├── m01-bootstrap/
├── m02-discovery/
├── m03-parsing/
├── m04-rules/
├── m05-reporting/
├── m06-validation/
├── usability/
└── security/
```

Do not commit secrets, private absolute paths, or modified raw output.

## Available packages

- `m01-bootstrap/`: completed Node.js 24 CLI-foundation evidence, including an isolated `npm ci`,
  product gate, coverage, compiled CLI scenarios, harness validation, dependency audit, and the
  SHA-256 digest of the exact source snapshot plus a per-artifact integrity manifest. Start with
  `m01-bootstrap/SUMMARY.md`.
- `m02-discovery/`: completed Node.js 24 discovery/inventory/classification evidence, including an
  isolated `npm ci`, the product gate, coverage, compiled CLI smokes, a reviewed expected/actual
  controlled project, deterministic reruns, symlink/exclusion proof, dependency audit, source
  snapshot digest, a zero-skip/todo test record, and a per-artifact SHA-256 manifest covering the
  finalized milestone report. Start with `m02-discovery/SUMMARY.md`.
- `m03-parsing/`: completed Node.js 24 source-reader, Babel pipeline, normalized-model, and
  error-isolation evidence, including an isolated `npm ci`, the product gate, coverage, compiled CLI
  smokes, a reviewed four-kind expected/actual scenario, byte-identical reruns, location and
  target-code non-execution proof, dependency audit, exact Babel dependency tree, source snapshot
  digest, zero-skip/todo record, bounded performance observations, and a per-artifact SHA-256
  manifest covering the finalized milestone report. Start with `m03-parsing/SUMMARY.md`.
- `m04-rules/`: completed Node.js 24 rule-engine and initial-catalog evidence, including an isolated
  `npm ci`, the 344-test product gate, coverage, compiled CLI smokes, reviewed expected/actual
  eight-rule findings, byte-identical reruns, category/ID filters, metadata and limitations,
  thrown-rule sibling isolation, target-code non-execution, dependency audit, source snapshot
  digest, zero-skip/todo record, and a per-artifact SHA-256 manifest covering the milestone report.
  Start with `m04-rules/SUMMARY.md`.
- `m05-reporting/`: completed normalized-result and terminal/JSON/HTML reporting evidence, including
  an isolated install, product gate, coverage, compiled smokes, exact cross-reporter projections,
  terminal color behavior, structural XSS/CSP checks, exclusive in-root report writes, dependency
  audit, zero-skip/todo record, source digest, and a finalized SHA-256 manifest. Start with
  `m05-reporting/SUMMARY.md`.
- `m06-validation/`: the completed M06-T05 base collection contains exactly 42 manifested Activity
  3 artifacts after an isolated locked install, complete gate, controlled projects, per-rule
  accuracy, robustness/security/performance execution, and expert heuristic review. A second
  execution matched stable results and preserved the first package.
  `npm run evidence:m06:finalize` adds only the factual milestone report to the final manifest.

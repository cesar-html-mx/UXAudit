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

# Glossary

- **Audit session**: one complete execution over one project and configuration.
- **Project root**: validated directory selected for analysis.
- **Discovered file**: filesystem entry found after exclusions.
- **Inventory**: normalized deterministic records for discovered files.
- **Source candidate**: supported file selected for parsing.
- **AST adapter output**: parser-boundary representation that may use Babel types internally.
- **Analyzed source file**: AST-free normalized result for one successfully processed source
  candidate; it is the input to the project analysis-model builder.
- **Analysis model**: parser-independent UXAudit domain representation used by rules.
- **Source location**: portable relative file path plus a half-open source range using one-based
  lines and zero-based UTF-16 columns/offsets.
- **Value confidence**: `exact`, `partial`, or `dynamic` statement of how much JSX value/text
  information can be justified without evaluating target code.
- **Rule**: one independently executable validation criterion.
- **Finding**: normalized evidence that a rule identified a reviewable situation.
- **Execution error**: recoverable or unrecoverable processing problem, distinct from a finding.
- **AuditResult**: complete normalized result used by every reporter.
- **Reporter**: terminal, JSON, HTML, or future output adapter.
- **Stable rule**: implemented, tested, documented, and validated within its stated scope.
- **Experimental rule**: implemented or prototyped without sufficient evidence for stable claims.
- **Deferred rule**: specified but intentionally outside the current implementation.
- **Controlled project**: fixture application with versioned expected findings.
- **ExecPlan**: self-contained living milestone plan.
- **Quality gate**: mandatory checks required to close a task or milestone.

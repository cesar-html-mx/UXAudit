[Español](es/10_DOCUMENTATION_POLICY.md) | **English**

# Documentation Policy

Documentation is part of the implementation, not a final cleanup task.

## Bilingual public documentation

- Public documents are maintained in English and Latin American Spanish in the same pull request.
- Spanish translations use neutral Latin American Spanish.
- Code, identifiers, commands, and exact output are not translated.
- Internal harness files and generated or finalized milestone evidence remain in English.
- The English originals at their established paths remain the operational reference for automation.
- Any divergence between an English public document and its Spanish mirror is a documentation
  defect.

## Always current

- `README.md`, `README.en.md`, and `README.es.md`
- `docs/00_INDEX.md`, every public English document, and its `docs/es/` peer
- public security, pull-request, evidence-entry, usability, and evidence-method guidance
- product behavior and CLI options
- architecture and public contracts
- rule catalog and limitations
- requirement traceability
- active ExecPlan
- state, decisions, risks, blockers, session log, and evidence index

## Component documentation

A new major component must document:

- responsibility;
- inputs and outputs;
- dependencies;
- error behavior;
- performance or security considerations;
- related requirements and tests.

## Rule documentation

A rule is not complete until the catalog includes its scope, trigger, valid examples, limitations,
severity, recommendation, and references.

## Change history

Use Git history for file-level change tracking and `DECISIONS.md` for reasons that future contributors
need to understand. Do not duplicate every commit into prose.

## Academic evidence

Implementation notes must be factual. Preserve commands and observed results so the TFM testing
chapter can distinguish plans from completed work.

# Documentation Policy

Documentation is part of the implementation, not a final cleanup task.

## Always current

- `README.md`
- `docs/00_INDEX.md`
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

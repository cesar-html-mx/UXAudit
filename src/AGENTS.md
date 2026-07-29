# Source Code Instructions

- Follow `docs/04_ARCHITECTURE.md` dependency direction.
- Do not import from reporting into domain, parsing, rules, or project processing.
- Rules never import Babel parser/traverse/types.
- Product code does not execute target project modules or shell commands.
- Add or update focused tests for every behavior change.
- Prefer arrow functions, strict types, explicit results, and deterministic ordering.

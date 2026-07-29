# Engineering Standards

## Runtime and language

- Node.js-compatible local CLI, with `engines` supporting Node 20 or later unless M01 proves a
  justified alternative.
- TypeScript strict mode.
- ESM modules.
- `npm` and a committed lockfile.
- Public contracts exported deliberately; avoid broad barrel exports that create cycles.

## Approved initial dependencies

Production:

- `commander`
- `@babel/parser`
- `@babel/traverse`
- `@babel/types` when required by traversal types

Development:

- `typescript`
- `tsx`
- `vitest`
- `@vitest/coverage-v8`
- `eslint` and TypeScript ESLint packages
- `prettier`
- `husky`

A new production dependency requires a decision record before installation.

## TypeScript and code style

- Prefer arrow functions.
- Prefer `async`/`await`.
- Do not use `any` without a written local justification; prefer `unknown` and validation.
- Keep side effects at boundaries.
- Use immutable or readonly domain data where practical.
- Avoid inheritance unless it materially improves a contract; prefer composition.
- Use typed error classes or discriminated results for expected failures.
- Do not hide failures with empty catches.
- Keep deterministic sorting explicit.
- Comments explain reasons, constraints, or non-obvious behavior, not syntax.

## Files and paths

- Use Node path APIs.
- Store project-relative report paths with `/` normalization when needed for stable output.
- Resolve and verify canonical roots.
- Track visited real paths when following symlinks.
- Never use shell commands for project traversal or parsing.

## Tests

- Every public behavior and bug fix requires tests.
- Positive, negative, and boundary cases are required for rules.
- Do not overuse snapshots; assert domain behavior explicitly.
- Fixtures must be minimal and state why they exist.
- Tests must be deterministic and isolated from the developer's real filesystem except controlled
  temporary directories.

## Git

- Conventional commits.
- Include the task ID in the scope: `feat(parser-0302): parse TSX source files`.
- One coherent commit per completed task; repair commits are allowed before milestone closure.
- Do not rewrite shared history or force-push.
- Milestone branches follow `.github/harness/HARNESS_CONFIG.yml`.

## Definition of done

Code, tests, documentation, traceability, evidence, and successful verification are one deliverable.

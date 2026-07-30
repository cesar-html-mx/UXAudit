[Español](es/05_ENGINEERING_STANDARDS.md) | **English**

# Engineering standards

## Runtime and package management

- Develop and release on Node.js `>=24.18.0 <25` with npm `>=11.16.0 <12`.
- Use `npm ci` for reproducible repository installs and commit `package-lock.json` changes.
- Keep direct dependency versions exact and review transitive and install-script changes.
- Production dependencies require a clear runtime need, security review, and documented rationale.
- The public package is a CLI distribution. Do not expose an importable library API accidentally.

## TypeScript and modules

- Use strict TypeScript and ESM.
- Avoid `any`; validate `unknown` values at boundaries before narrowing.
- Prefer arrow functions and `async`/`await`.
- Keep modules focused and contracts explicit.
- Use readonly input contracts and immutable domain results where practical.
- Parser-specific types remain inside the parsing adapter.
- Rules depend on the normalized analysis model; reporters depend on `AuditResult`.

## Determinism and errors

- Define canonical ordering for files, entities, rules, findings, errors, and report groups.
- Avoid locale-sensitive ordering in product behavior.
- Reject malformed, duplicate, sparse, proxied, or accessor-backed external values at closed
  boundaries.
- Use typed errors with stable public messages.
- Preserve recoverable failures in normalized results; never hide them to make a scan appear clean.
- Do not expose raw source, native parser objects, credentials, or uncontrolled absolute paths in
  terminal messages.

## Filesystem and process safety

- Do not invoke a shell for core product behavior.
- Treat discovered paths as candidates and reauthorize them at the point of use.
- Bound reads and writes, validate UTF-8 strictly, and verify file identity around descriptor I/O.
- Prevent symlink loops and path escape.
- Never execute, import, or automatically modify analyzed source.
- Escape untrusted content for its output context; terminal, JSON, and HTML have different needs.
- Refuse unsafe report paths and existing report targets.

## Public behavior

Any observable command, option, exit code, configuration field, schema, rule, finding, report, or
error behavior requires:

1. an explicit contract;
2. positive, negative, boundary, and failure-isolation tests as applicable;
3. English and Latin American Spanish documentation;
4. a compatibility review when the behavior already exists publicly.

Limitations must be stated next to the feature or rule they qualify.

## Quality commands

| Command                 | Purpose                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| `npm run format:check`  | Check repository formatting.                                           |
| `npm run docs:check`    | Check bilingual pairs, technical literals, structure, and local links. |
| `npm run lint`          | Run warning-free ESLint rules.                                         |
| `npm run typecheck`     | Run strict TypeScript checks without emission.                         |
| `npm test`              | Run focused Vitest tests once.                                         |
| `npm run test:coverage` | Run the suite with global V8 coverage thresholds.                      |
| `npm run build`         | Emit ESM JavaScript, declarations, and source maps to `dist/`.         |
| `npm run test:smoke`    | Exercise the built CLI.                                                |
| `npm run test:package`  | Inspect and install-test the npm tarball boundary.                     |
| `npm run verify`        | Run the main formatting, docs, lint, type, test, and build gate.       |
| `npm run release:check` | Run the complete local public-release gate.                            |

Coverage supports review but does not replace meaningful assertions. Required tests must not be
skipped or marked as future work.

## Git and contribution workflow

- Create a focused branch for each coherent change.
- Use conventional commits such as `feat(rules): add heading-order check` or
  `docs(cli): clarify JSON output`.
- Keep generated package output out of source commits unless the release process explicitly requires
  it.
- Do not mix unrelated formatting or refactoring into a functional change.
- Review the final diff, run checks proportional to risk, and document any unexecuted validation.
- Use `npm run setup:hooks` when local Git hooks are desired; package consumers are not enrolled in
  repository hooks.

## Documentation standard

Code, identifiers, paths, commands, configuration keys, and machine-readable formats remain in
English. Durable informational documentation is paired in English and natural Latin American
Spanish. The two versions must describe the same behavior; translation must not create a stronger
claim than the implementation supports.

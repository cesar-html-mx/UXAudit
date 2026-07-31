[Español](es/09_ACCEPTANCE_CRITERIA.md) | **English**

# Public release acceptance criteria

## Product behavior

- `ux-audit scan <project-path>` completes the documented end-to-end static audit.
- Supported `.js`, `.jsx`, `.ts`, and `.tsx` sources are discovered and processed deterministically.
- Target code is never imported, executed, or modified.
- Direct recognized component exports and local component uses link only through lexical binding
  identity. Direct relative `default` and named imports, including a named alias, link only when one
  supported target file and exported binding match exactly.
- Package imports, barrels and reexports, namespace syntax, TypeScript path aliases, higher-order or
  runtime abstractions, and missing or ambiguous references remain unknown without speculative links.
- All published stable rules evaluate the normalized model and expose documented limitations.
- Recoverable source and rule failures are isolated and included in the normalized result.
- Terminal, JSON, and HTML report the same underlying facts.
- Commands, options, configuration fields, filenames, and exit codes match the public specification.

## User experience

- Installation from the `@cesar-html-mx/uxaudit` package exposes the `ux-audit` executable.
- The root README provides a working install and two-command quick start without requiring a source
  checkout or build.
- Help describes every public option and invalid input returns a safe actionable message.
- Findings include rule identity, location when available, explanation, recommendation, and
  limitations.
- Default behavior is useful without configuration; advanced filters remain explicit.

## Safety and privacy

- Scans run locally without telemetry, upload, hosted service, or database.
- Traversal, source reads, configuration reads, and report writes stay within their documented
  authorization boundaries.
- Links, path escape, existing report targets, malformed input, invalid UTF-8, and oversized files
  fail safely.
- Untrusted terminal and HTML values cannot inject control records, markup, scripts, or unsafe links.
- Reports are not announced until their writes are confirmed.
- Dependency audit and security-sensitive regression cases pass at release time.

## Package distribution

- Package metadata names the license, repository, issue tracker, supported runtime, binary, and
  public access policy.
- `npm pack --dry-run` contains only the intended runtime output, schemas, license, and public
  README files.
- A fresh temporary consumer can install the tarball, resolve `ux-audit`, print help and version, and
  scan a controlled project outside the repository.
- The published package builds from a clean checkout and does not depend on ignored local artifacts.
- `dist/cli/index.js` retains its executable declaration and the tarball excludes source tests,
  internal fixtures, credentials, and development-only records.

## Engineering quality

- Formatting, bilingual docs, lint, strict type checking, tests, coverage, build, smoke, system,
  robustness, accuracy, and package checks pass.
- No required test is skipped or marked todo.
- Global statement, branch, function, and line coverage remain at or above 90%.
- Results and reports have deterministic ordering; documented volatile fields are the only normalized
  comparison exclusions.
- Public behavior has meaningful positive, negative, boundary, and failure assertions.
- The controlled intercomponent corpus covers direct `default` and named alias imports, local and
  repeated use, composed `Page -> Header + Hero` headings, a cycle, a missing local import, a package
  import, ambiguity, reversed input order, and target-code non-execution.
- Every announced supported intercomponent case contributes to supported accuracy expectations and
  is not reclassified as unsupported to make the release gate pass.
- The working tree contains only intentional reviewed changes.

## Documentation

- User and contributor documentation is available in English and Latin American Spanish.
- Installation, usage, configuration, reports, rules, exit codes, privacy, security, limitations, and
  source-development steps are clear and internally linked.
- Technical literals and code examples are identical across language pairs.
- Product guides stay focused on installation, use, contribution, and maintained product contracts.

## Release decision

Run `npm run release:check` from a clean supported environment. A release is ready only when every
criterion above is met or a documented limitation explicitly defines why an item is not applicable.
Missing credentials or registry permissions can block publication even when the local artifact is
ready; they do not justify weakening the artifact checks.

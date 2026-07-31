# M07 focused verification

## Contract and extraction

- M07-T01 passed 31 focused normalized-model contract tests, strict type checking, paired public
  documentation, and harness validation.
- M07-T02 passed 26 focused Babel extraction tests covering default, named, aliased, local,
  shadowed, type-only, namespace, package, missing, and unsupported bindings without leaking Babel
  values.
- M07-T03 passed 44 focused resolver/model/project tests. The repository then passed 643 tests
  across 59 files.

## Composition rule

The final focused command covered these five files:

- `tests/rules/seo/multiple-h1.test.ts`
- `tests/rules/seo/multiple-h1.intercomponent.test.ts`
- `tests/application/analyze-project.intercomponent.integration.test.ts`
- `tests/application/audit-project.intercomponent.integration.test.ts`
- `tests/rules/initial-catalog.integration.test.ts`

Result: 5 files and 21 tests passed. Formatting, bilingual documentation, lint, and strict type
checking also passed.

The cases prove sibling Header/Hero composition, repeated use, direct-local location precedence,
single child-cause ownership, cycles, unresolved uses, exactly 64 supported link hops, an unknown
65th hop, independent per-root exhaustion beyond 100000 traversal steps, a complete static
manifest, no target execution, and forward/reverse input stability.

Two independent read-only reviews initially found a shared project-wide traversal budget and an
incomplete forward/reverse manifest assertion. Both defects were corrected, re-tested, and
re-reviewed with no remaining T04 blocker.

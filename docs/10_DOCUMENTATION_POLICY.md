[Español](es/10_DOCUMENTATION_POLICY.md) | **English**

# Documentation policy

## Audiences

Documentation is organized for:

- users installing and running the CLI;
- maintainers integrating it into project scripts or CI;
- contributors changing architecture, rules, tests, packaging, or documentation;
- security reviewers evaluating local trust boundaries.

The user path comes first. Historical implementation records must not interrupt installation,
configuration, rule interpretation, or troubleshooting.

## Languages

Durable informational documentation is maintained in English and natural Latin American Spanish.
This includes the root README, product guides, contributor guides, security guidance, rule
documentation, and project history.

Code, source identifiers, rule IDs, configuration keys, commands, paths, filenames, package names,
schema values, and machine-readable formats remain in English. Translating those literals would make
examples incorrect.

## Document pairing

- `README.md` contains substantive Spanish and English entry sections.
- `README.en.md` and `README.es.md` are complete reciprocal guides.
- Each English document below `docs/` has a matching path below `docs/es/`.
- Every pair begins with a visible reciprocal language selector.
- Heading hierarchy, table shape, fenced examples, and technical literals stay structurally aligned.
- Relative links must remain inside the repository and point to existing files and headings.

`npm run docs:check` validates these mechanical guarantees. Human review remains responsible for
meaning, fluency, tone, and truthful equivalence.

## Content by document type

| Type             | Required content                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------ |
| User guide       | Installation, quick start, options, configuration, reports, rules, exits, privacy, limits. |
| Rule catalog     | Scope, trigger, non-trigger, recommendation, severity, confidence, and limitations.        |
| Architecture     | Current module boundaries, data flow, contracts, determinism, and error ownership.         |
| Test strategy    | Current layers, scenarios, safety cases, distribution checks, and release expectations.    |
| Security         | Threats, controls, privacy, residual risks, and private disclosure path.                   |
| Release criteria | Observable, testable conditions for a public artifact.                                     |
| History          | Concise archival context without turning internal process into product instructions.       |

## Source of truth

Observable CLI behavior is grounded in implementation and tests, then explained in the product
specification. Architecture documents define intended dependency boundaries. The rule catalog must
match the registered rules. Package commands and installation instructions must match
`package.json` and the tested tarball.

When sources disagree, do not silently copy the conflict across languages. Resolve the contract,
update implementation or tests when authorized, and then update both documents.

## Writing guidance

- Lead with the user outcome.
- Use plain language and short executable examples.
- Distinguish a static finding from a runtime fact.
- State limitations next to the claim they constrain.
- Do not advertise unimplemented commands, reports, policies, metrics, or integrations.
- Do not present an expert review as participant research.
- Avoid internal task IDs, one-time build chronology, or archival verification commands in product
  guides.
- Keep sensitive values, credentials, private paths, and raw untrusted source out of examples.

## Update checklist

When public behavior changes:

1. update tests and the relevant contract;
2. update English and Spanish in the same change;
3. preserve exact technical literals and byte-identical fenced examples;
4. update the index and traceability map when a durable page or contract changes;
5. run `npm run docs:check` and formatting checks;
6. review installation and links from a new user's perspective.

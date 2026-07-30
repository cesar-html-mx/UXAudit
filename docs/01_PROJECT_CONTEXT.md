[Español](es/01_PROJECT_CONTEXT.md) | **English**

# Project context

## Problem

React teams can introduce reviewable usability, accessibility, SEO, and performance risks directly
in JSX and TSX. General linters cover syntax and coding conventions well, but they do not always
present these cross-cutting concerns as one local, understandable audit.

## Product purpose

UXAudit gives developers an early, repeatable static review before browser and human validation. It
discovers `.js`, `.jsx`, `.ts`, and `.tsx` sources, builds a normalized model, evaluates independent
rules, and produces terminal, JSON, and HTML reports.

The product helps prioritize review. It does not certify compliance or replace testing with
browsers, assistive technologies, performance tooling, or participants.

## Intended users

- React and TypeScript developers who want feedback while coding.
- Maintainers who want a reproducible audit command in continuous integration.
- UX, accessibility, SEO, and performance specialists who need a portable report for review.
- Contributors extending the scanner, model, rules, or reporters.

## Product boundaries

- Local command-line tool; no hosted service, database, or telemetry.
- Static analysis only; target code is not imported, executed, or modified.
- Supported source extensions are `.js`, `.jsx`, `.ts`, and `.tsx`.
- Findings are deterministic observations with recommendations and explicit limitations.
- Runtime layout, behavior, styles, network activity, and real user experience remain outside scope.
- Reports stay on the local filesystem unless the user deliberately shares them.

## Product principles

Safety, determinism, honest limitations, actionable output, and a low-friction command are more
important than maximizing the number of speculative findings. Unsupported dynamic cases should
remain unknown instead of being presented as proven defects.

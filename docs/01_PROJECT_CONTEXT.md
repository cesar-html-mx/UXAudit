[Español](es/01_PROJECT_CONTEXT.md) | **English**

# Project Context

## Problem

Frontend quality depends on several related areas: UX, accessibility, technical SEO, and performance.
Standards and specialized tools exist, but knowledge and checks are distributed. Review quality can
depend too heavily on each developer's experience and memory.

## Contribution

UXAudit will provide a repeatable static-analysis process for React and TypeScript source code. It
will not replace expert review. It will help developers identify selected issues early, understand why
they matter, locate the relevant code, and receive a recommendation.

## Primary user

A frontend developer working on a React project from a terminal.

## Primary flow

1. The developer provides a project path.
2. UXAudit validates access to the project.
3. It discovers and classifies relevant files.
4. It parses source code and creates a normalized model.
5. Enabled rules evaluate the model.
6. Findings are normalized and sorted.
7. Terminal, JSON, and HTML reporters present the same result.

## Scope

- Local command-line execution.
- Static analysis.
- React and TypeScript projects, including mixed `.js`/`.jsx`.
- Initial rules in UX, accessibility, SEO, and performance.
- Explainable findings with source location and recommendation.
- Controlled and near-real validation projects.

## Exclusions

- Running the analyzed application.
- Browser automation or runtime performance measurement in the MVP.
- Automatic modification of analyzed code.
- A hosted service, user accounts, database, or telemetry.
- A claim of complete conformance with WCAG, SEO, UX, or Core Web Vitals.
- Support for every framework or programming language.

## Success

The first version is successful when it can reproducibly analyze controlled projects, produce the
expected findings with acceptable false-positive and false-negative behavior for the implemented
rules, and generate consistent terminal, JSON, and HTML outputs.

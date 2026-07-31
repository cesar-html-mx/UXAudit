[Español](../es/00_INDEX.md) | **English**

# Post-harness evidence index

## Purpose

This index covers work performed after the formal UXAudit M01–M06 harness reached `complete`. The
archival boundary is the annotated tag `harness-complete-v1`; the tag preserves the completed
harness, its evidence, and the post-M06 bilingual documentation before the public branch was
simplified.

## Documents

1. [Post-harness report](01_POST_HARNESS_REPORT.md) — scope, boundary, results, and chronology.
2. [Release and security](02_RELEASE_AND_SECURITY.md) — GitHub, npm, publication, provenance, OIDC,
   and maintainer-confirmed controls.
3. [Real consumer validation](03_REAL_CONSUMER_VALIDATION.md) — installation and execution in a
   clean React/TypeScript project.
4. [Future release runbook](04_FUTURE_RELEASE_RUNBOOK.md) — repeatable tokenless publication steps.
5. [Evidence catalog](05_EVIDENCE_CATALOG.md) — identifiers, links, evidence classes, and screenshot
   checklist.
6. [Machine-readable sources](../data/evidence-sources.json) — stable facts used by this dossier.

## Evidence classes

| Class | Meaning                                                                                |
| ----- | -------------------------------------------------------------------------------------- |
| `A`   | Reproducible public evidence available through GitHub or npm.                          |
| `B`   | Evidence preserved in Git history, refs, commits, tags, branches, or repository files. |
| `C`   | Maintainer-confirmed fact not independently reproducible through a public API.         |
| `D`   | Session-observed result from a temporary controlled environment.                       |

## Scope limitation

This dossier does not claim that `v0.1.0` was published through npm Trusted Publishing. The tagged
workflow publicly proves that it used an npm secret and generated provenance; the maintainer
separately confirmed that the secret held a short-lived granular token, a class `C` fact. Pull
request #12 subsequently migrated the current workflow to OIDC; the next real version will be the
first operational publication through that configuration.

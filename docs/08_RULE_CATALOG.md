[Español](es/08_RULE_CATALOG.md) | **English**

# Rule catalog

## Summary

UXAudit ships eight stable static-analysis rules. Each finding includes a rule ID, category, default
severity, confidence, source location when available, explanation, recommendation, and limitations.

| Rule ID                        | Category      | Severity | Static review                                                                 |
| ------------------------------ | ------------- | -------- | ----------------------------------------------------------------------------- |
| `accessibility/button-name`    | accessibility | high     | Intrinsic button without supported static accessible-name evidence.           |
| `accessibility/img-alt`        | accessibility | high     | Intrinsic image without an explicit, statically known alternative attribute.  |
| `accessibility/input-label`    | accessibility | high     | Supported intrinsic form control without supported static label evidence.     |
| `performance/img-dimensions`   | performance   | medium   | Intrinsic image without valid positive width and height reservation.          |
| `performance/img-lazy-loading` | performance   | low      | Intrinsic image not statically configured for lazy loading.                   |
| `seo/ambiguous-link-text`      | seo           | medium   | Intrinsic link whose retained text exactly matches a generic phrase.          |
| `seo/multiple-h1`              | seo           | medium   | Multiple intrinsic `h1` contributions owned or exactly linked by a component. |
| `ux/small-inline-text`         | ux            | medium   | Retained text with a literal inline pixel size below the threshold.           |

## Interpret findings

A finding is a review prompt, not proof of runtime behavior or complete compliance. Confidence
describes the quality of static evidence, while severity describes the default review priority.
Dynamic values and unresolved spreads often remain unknown instead of producing a speculative
finding.

Rule severity is fixed metadata in the current catalog. `--severity` and `minimumSeverity` filter
terminal detail; they do not rewrite finding severity, hide JSON/HTML records, or change the exit
code.

## Accessibility

### `accessibility/button-name`

Reports an intrinsic `button` when the retained static model establishes that supported accessible
name evidence is absent.

Review by providing descriptive visible text, `aria-label`, or `aria-labelledby` with a non-empty
name.

Limitations:

- it does not implement the complete accessible-name computation;
- dynamic-only content, unresolved JSX spreads, and custom icon components are unknown;
- referenced `aria-labelledby` targets and CSS-hidden content are not resolved.

### `accessibility/img-alt`

Reports an intrinsic `img` when an explicit effective `alt` attribute is statically absent. An empty
`alt` value is accepted because it can intentionally mark a decorative image.

Review by adding descriptive alternative text or `alt=""` for an intentionally decorative image.

Limitations:

- custom image components and aliases are not inferred;
- a later unresolved JSX spread can provide `alt` and remains unknown;
- the rule checks attribute presence, not descriptive quality.

### `accessibility/input-label`

Reviews supported intrinsic form controls for static label or accessible-name evidence. Supported
evidence includes applicable label nesting, a matching literal `htmlFor`/`id`, non-empty
`aria-label`, or non-empty `aria-labelledby`.

Limitations:

- dynamic IDs, labels, and spreads remain unknown;
- custom control or label abstractions are not resolved across component boundaries;
- referenced `aria-labelledby` targets and the complete accessible-name computation are not validated;
- hidden, button, submit, reset, and image input types are outside this label rule;
- nested labels are not validated for every HTML content-model constraint.

## Performance

### `performance/img-dimensions`

Reports an intrinsic `img` that lacks statically valid positive integer `width` and `height`
attributes or contains a reviewable invalid pair. A literal zero-by-zero image is treated as content
not intended for the user; zero paired with a positive dimension remains reviewable.

Review by providing dimensions that preserve the aspect ratio or verifying that CSS reserves
equivalent space.

Limitations:

- the rule describes layout-shift risk; it does not observe layout shift;
- CSS, `aspect-ratio`, and component-level layout may reserve equivalent space;
- dynamic dimensions and unresolved spreads remain unknown unless a sibling value proves a violation;
- custom image components and runtime metadata are not inferred.

### `performance/img-lazy-loading`

Reports an intrinsic `img` whose effective static `loading` value is absent, eager, or invalid rather
than `loading="lazy"`.

Review whether the image is below the fold and should use lazy loading. Keep eager loading when visual
priority requires it.

Limitations:

- static analysis cannot know whether an image is above the fold, so every finding is advisory;
- dynamic values and unresolved spreads remain unknown;
- custom components, preload behavior, and runtime priorities are not inferred.

## SEO

### `seo/ambiguous-link-text`

Reports an intrinsic `a` when its exact normalized retained text matches the default generic phrases:
“click here”, “here”, “read more”, “aquí”, or “ver más”.

Review by using visible text that identifies the destination or purpose.

Limitations:

- only exact retained text is compared; partial and dynamic text are not reported;
- custom link components are not inferred;
- surrounding text, ARIA naming, destination URL, and visual context are not evaluated.

### `seo/multiple-h1`

Reports at most one finding for each syntactically recognized component. When a component owns more
than one intrinsic `h1`, the rule preserves its source-local behavior and reports the second local
`h1`, even if a linked contribution appears earlier. Otherwise, the rule also evaluates composition
in JSX source order through exact direct local `ComponentLink` relationships. Each JSX use of a
linked child definition contributes at most one `h1` to its parent, so multiple headings inside that
child do not multiply the same cause in the parent. Repeated uses are evaluated separately and each
use can contribute once. When a child use supplies the second contribution, the finding is located at
that JSX use in the owning component.

Review the rendered page context and keep one primary heading when appropriate, using lower levels
for subordinate sections.

Limitations:

- only exact direct local relationships represented by `ComponentLink` are traversed; unresolved or
  ambiguous references, package imports, and paths that depend on cyclic edges are handled
  conservatively and do not supply inferred `h1` contributions;
- conditional rendering, routes, and whether headings appear together at runtime are not evaluated;
- exactly `64` `ComponentLink` hops from each evaluated root are supported; paths with more than `64`
  hops remain unknown and are not inferred;
- each root component receives an independent `100000`-step traversal budget; work requiring more
  than `100000` steps for that root remains unknown and is not inferred;
- custom heading syntax and heading roles are not inferred.

## UX

### `ux/small-inline-text`

Reports retained non-empty text on an intrinsic rendered element when an exact non-negative inline
`fontSize` literal resolves to fewer than 12 pixels.

Review by using at least 12 pixels or an equivalent readable size in the project's style system.

Limitations:

- external stylesheets, class names, inheritance, and the rendered cascade are not evaluated;
- dynamic styles, unresolved spreads, and objects with unknown properties remain unknown;
- relative units, percentages, calculations, browser zoom, and display settings are not resolved;
- only intrinsic elements with retained static text are evaluated.

## Select rules

Use categories, exact IDs, or both:

```bash
npm exec --offline -- ux-audit scan . --category accessibility
npm exec --offline -- ux-audit scan . --rule accessibility/img-alt
npm exec --offline -- ux-audit scan . --category performance --rule performance/img-dimensions
```

Repeat `--category` or `--rule` to select more values. When both filters are supplied, a rule must
match both. An empty array in configuration intentionally selects no rules for that filter; `null`
means no filter.

## Add or change a rule

A contribution must define scope, metadata, positive and negative fixtures, unsupported cases,
location behavior, limitations, documentation, deterministic ordering, and isolation behavior. Rules
consume only the normalized analysis model and must not read, execute, or modify target files.

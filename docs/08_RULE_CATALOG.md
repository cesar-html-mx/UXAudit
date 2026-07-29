# Initial Rule Catalog

Rule status:

- **required**: must be implemented and validated in M04.
- **experimental**: may be prototyped but cannot be presented as reliable without evidence.
- **deferred**: documented future work.

## Accessibility

### A11Y-001 — Image alternative text

- ID: `accessibility/img-alt`
- Status: required
- Severity: high
- Detect: intrinsic `<img>` without an `alt` attribute.
- Valid: descriptive `alt` or `alt=""` for a decorative image.
- Limitation: custom image components are not inferred unless the model later supports aliases.
- Reference: WCAG 1.1.1 concept.

### A11Y-002 — Form input label

- ID: `accessibility/input-label`
- Status: required
- Severity: high
- Detect: intrinsic form input without an associated `<label>`, `aria-label`, or `aria-labelledby`.
- Initial scope: `input`, `select`, and `textarea` may be phased separately if documented.
- Limitation: dynamic IDs and wrapper abstractions may require review.

### A11Y-003 — Button accessible name

- ID: `accessibility/button-name`
- Status: required
- Severity: high
- Detect: intrinsic `<button>` lacking non-empty text, `aria-label`, or `aria-labelledby`.
- Limitation: icon components with hidden accessible text require model support.

## Performance

### PERF-001 — Image lazy loading

- ID: `performance/img-lazy-loading`
- Status: required, advisory
- Severity: low
- Detect: intrinsic `<img>` without a literal `loading` attribute under the initial rule scope.
- Recommendation: use `loading="lazy"` when the image is not intentionally above the fold.
- Limitation: static analysis cannot know visual priority; wording must not claim certainty.

### PERF-002 — Image dimensions and layout-shift risk

- ID: `performance/img-dimensions`
- Status: required
- Severity: medium
- Detect: intrinsic `<img>` without sufficient literal `width` and `height` information.
- Limitation: CSS aspect ratio or component-level layout can reserve space; evidence should be
  reported conservatively.

## SEO

### SEO-001 — Multiple H1 elements

- ID: `seo/multiple-h1`
- Status: required, advisory
- Severity: medium
- Detect: more than one intrinsic `<h1>` inside the initial analysis scope defined by the implementation.
- Scope must be explicit: file/component or analyzed static project.
- Limitation: routed pages and conditionally rendered components can make project-wide counts
  misleading.

### SEO-002 — Ambiguous link text

- ID: `seo/ambiguous-link-text`
- Status: required
- Severity: medium
- Detect: intrinsic `<a>` with static text from a configurable ambiguous set, such as “click here”,
  “here”, “read more”, “aquí”, or “ver más”.
- Limitation: surrounding accessible context and dynamic text may require manual review.

## UX

### UX-001 — Very small literal inline text

- ID: `ux/small-inline-text`
- Status: required
- Severity: medium
- Detect: literal inline `fontSize` below the configured threshold.
- Limitation: external CSS, rem calculation, zoom, and rendered context are not evaluated.

### UX-002 — Ambiguous button text

- ID: `ux/ambiguous-button-text`
- Status: experimental
- Severity: low
- Detect: configurable generic static labels whose action cannot be inferred from the button itself.
- Promotion requirement: controlled examples and acceptable precision.

### UX-003 — Missing loading state

- ID: `ux/missing-loading-state`
- Status: deferred/experimental
- Severity: low
- Goal: identify narrow static patterns where an asynchronous user action has no visible loading
  feedback.
- Reason for status: a general reliable decision requires runtime and state-flow understanding beyond
  the initial model.

## Rule contract

Every implemented rule must provide:

- stable ID;
- title;
- category;
- default severity;
- catalog status;
- explanation;
- recommendation;
- nullable standard/reference with a label and optional URL;
- evaluation operation;
- one or more explicit limitations;
- positive and negative fixtures;
- boundary or unsupported fixture;
- traceability to tests and evidence.

The M04 domain contract distinguishes a rule's catalog status from finding confidence. Status
describes catalog maturity or delivery (`required`, `stable`, `experimental`, or `deferred`);
confidence (`high`, `medium`, or `low`) describes how strongly one finding is justified by the
available static evidence. Findings retain the complete half-open `SourceLocation` when available;
reporters may derive display coordinates later but rules do not flatten or convert them.

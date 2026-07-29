# Initial Rule Catalog

Rule status:

- **required**: must be implemented and validated in M04.
- **experimental**: may be prototyped but cannot be presented as reliable without evidence.
- **deferred**: documented future work.

## Accessibility

### A11Y-001 — Image alternative text

- ID: `accessibility/img-alt`
- Status: stable (required for M04)
- Severity: high
- Finding confidence: high when the effective `alt` attribute is provably absent.
- Scope and trigger: intrinsic `<img>` nodes only. Resolve JSX attributes from right to left; emit
  one finding at the element range when no named `alt` and no later unresolved spread exists.
- Valid examples: `<img alt="Quarterly revenue chart" />` and `<img alt="" />` for a decorative
  image.
- Unsupported/boundary behavior: an effective spread is unknown and produces no finding. Any
  explicit named `alt`, including a dynamic value, satisfies this initial presence-only check; the
  rule does not claim that its value is descriptive.
- Recommendation: add descriptive `alt`, or `alt=""` for an intentionally decorative image.
- Limitations: custom image components/aliases are not inferred, runtime spread values are not
  evaluated, and alternative-text quality is not scored.
- Reference: WCAG 1.1.1 concept.
- Verification: `tests/rules/accessibility/img-alt.test.ts` and the committed accessibility
  integration fixture.

### A11Y-002 — Form input label

- ID: `accessibility/input-label`
- Status: stable (required for M04)
- Severity: high
- Finding confidence: high inside the documented static association scope.
- Scope and trigger: intrinsic `input`, `select`, and `textarea` nodes. Emit when a label-required
  control has no intrinsic ancestor `<label>`, no exact same-component `htmlFor`/`for` plus `id`
  association, and no exact non-empty `aria-label` or `aria-labelledby`.
- Valid examples: `<label>Email <input /></label>`, `<label htmlFor="email">…</label>` plus
  `<input id="email" />`, and a control with a non-empty ARIA naming attribute.
- Exclusions: exact case-insensitive input types `hidden`, `button`, `submit`, `reset`, and `image`.
- Unsupported/boundary behavior: dynamic type/ID/ARIA values and effective JSX spreads produce no
  finding because association or label applicability cannot be proved. Empty IDs/ARIA strings and
  exact `null` ARIA values remain label-required. The default/null input type remains
  label-required. External labels require exact, untrimmed literal `htmlFor`/`for` and `id` equality
  inside one recognized component; labels are not paired across component boundaries or unowned JSX
  scopes.
- Recommendation: use intrinsic label nesting, exact `htmlFor`/`id`, or a non-empty ARIA name.
- Limitations: custom label/control abstractions, dynamic associations, referenced ARIA target
  existence, and the complete accessible-name algorithm are not resolved. The rule deliberately
  excludes `hidden`, `button`, `submit`, `reset`, and `image` input types and does not validate the
  one-labelable-descendant constraint of a nested label.
- Reference: WCAG 1.3.1 concept.
- Verification: `tests/rules/accessibility/input-label.test.ts` and the committed accessibility
  integration fixture.

### A11Y-003 — Button accessible name

- ID: `accessibility/button-name`
- Status: stable (required for M04)
- Severity: high
- Finding confidence: high when text and supported ARIA naming evidence are all provably empty or
  absent.
- Scope and trigger: intrinsic `<button>` nodes only. Emit at the button range when retained text is
  exactly empty and both `aria-label` and `aria-labelledby` are absent or exact empty strings.
- Valid examples: visible static text, known static text combined with dynamic content, or an exact
  non-empty supported ARIA naming attribute.
- Unsupported/boundary behavior: dynamic-only text, a custom icon child, dynamic ARIA values, or
  an effective JSX spread produces no finding. Exact `null` ARIA values are treated as absent.
  Custom `<Button>` components are not inferred.
- Recommendation: provide visible descriptive text or a non-empty supported ARIA name.
- Limitations: the complete accessible-name computation, referenced target existence, CSS-hidden
  content, and custom icon semantics are not resolved.
- Reference: WCAG 4.1.2 concept.
- Verification: `tests/rules/accessibility/button-name.test.ts` and the committed accessibility
  integration fixture.

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

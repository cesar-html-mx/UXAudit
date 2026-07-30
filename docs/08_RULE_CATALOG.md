# Initial Rule Catalog

Rule status:

- **required**: must be implemented and validated in M04.
- **stable**: implemented with a reviewed static scope and retained verification evidence.
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
- Status: stable, advisory (required for M04)
- Severity: low
- Finding confidence: medium because visual priority requires contextual review.
- Scope and trigger: intrinsic `<img>` nodes only. Emit at the image range when the effective
  `loading` attribute is absent, is `eager`, or has another known literal value. A case-insensitive
  exact `lazy` keyword is the supported non-finding.
- Unsupported/boundary behavior: dynamic values and effective JSX spreads are unknown and produce
  no finding. Custom image components are not inferred.
- Recommendation: use `loading="lazy"` when the image is not intentionally above the fold.
- Limitations: static analysis cannot know visual priority, preload behavior, or runtime fetch
  priority; every finding requests review and does not claim that eager loading is incorrect.
- Reference: HTML Standard lazy-loading attributes.
- Verification: `tests/rules/performance/img-lazy-loading.test.ts` and the performance integration
  suite.

### PERF-002 — Image dimensions and layout-shift risk

- ID: `performance/img-dimensions`
- Status: stable (required for M04)
- Severity: medium
- Finding confidence: medium because other layout mechanisms can reserve space.
- Scope and trigger: intrinsic `<img>` nodes only. Both effective `width` and `height` normally must
  be positive safe-integer number literals or ASCII decimal-integer strings. Emit at the image range
  when either is provably missing/invalid even if its sibling is unknown, or when zero is paired with
  a positive dimension.
- Unsupported/boundary behavior: a dynamic dimension or effective JSX spread produces no finding
  only when no sibling violation is already proved. Literal zero-by-zero is treated as content not
  intended for the user and is a non-finding. Custom image components are not inferred.
- Recommendation: provide positive integer dimensions preserving the image aspect ratio, or verify
  equivalent CSS space reservation.
- Limitations: external CSS, `aspect-ratio`, component layout, and runtime image metadata are not
  evaluated; a finding describes layout-shift risk rather than observed layout shift.
- Reference: HTML Standard dimension attributes.
- Verification: `tests/rules/performance/img-dimensions.test.ts` and the performance integration
  suite.

## SEO

### SEO-001 — Multiple H1 elements

- ID: `seo/multiple-h1`
- Status: stable, advisory (required for M04)
- Severity: medium
- Finding confidence: medium because static ownership is not rendered-page composition.
- Scope and trigger: count intrinsic `<h1>` nodes separately inside each syntactically recognized
  component. Emit one finding per affected component at its second `<h1>`, even when more headings
  follow. Unowned JSX is not combined into a file/project count.
- Valid/boundary behavior: zero or one intrinsic `<h1>` per component produces no finding. Custom
  heading components are ignored. Headings in mutually exclusive branches remain a medium-confidence
  advisory finding because runtime branch selection is not evaluated.
- Recommendation: review the component and retain one primary heading for each rendered page
  context.
- Limitations: routes, conditional rendering, component composition, custom headings, and heading
  roles can change the rendered hierarchy; the rule does not claim a project-wide page count.
- Verification: `tests/rules/seo/multiple-h1.test.ts` and the SEO integration suite.

### SEO-002 — Ambiguous link text

- ID: `seo/ambiguous-link-text`
- Status: stable (required for M04)
- Severity: medium
- Finding confidence: medium because surrounding accessible context is outside the initial scope.
- Scope and trigger: intrinsic `<a>` with exact retained text that, after deterministic NFKC,
  whitespace-collapse, trim, and lowercase normalization, completely matches the configured set.
  Defaults are `click here`, `here`, `read more`, `aquí`, and `ver más`.
- Configuration: `createAmbiguousLinkTextRule` accepts a validated non-empty string array; configured
  values replace the defaults and are normalized/deduplicated.
- Unsupported/boundary behavior: descriptive supersets, punctuation differences, partial/dynamic
  text, and custom link components produce no finding.
- Recommendation: use visible text that identifies the destination or purpose and review its
  accessible context.
- Limitations: surrounding content, ARIA naming, destination URLs, visual context, and rendered
  custom components are not evaluated.
- Verification: `tests/rules/seo/ambiguous-link-text.test.ts` and the SEO integration suite.

## UX

### UX-001 — Very small literal inline text

- ID: `ux/small-inline-text`
- Status: stable (required for M04)
- Severity: medium
- Finding confidence: high for exact retained text and medium for partial retained text inside the
  narrow literal inline-style scope.
- Scope and trigger: intrinsic elements with retained non-empty known static text and an effective
  exact object-literal `style`. Emit at the effective `fontSize` property when its last literal
  value is a finite non-negative number or `px` string below the configured threshold; the default
  is `12px` and equality is a non-finding.
- Configuration: `createSmallInlineTextRule` accepts one finite positive numeric `thresholdPx`.
- Unsupported/boundary behavior: custom elements, empty/dynamic-only text, dynamic/partial style
  objects, unknown object properties/spreads, negative sizes, and `rem`/`em`/`%`/`calc()` or
  non-numeric values produce no finding. Known partial text with a non-empty retained static portion
  is evaluated at medium confidence. Metadata, inert, void, and other intrinsically non-rendered text
  containers are excluded.
- Recommendation: use at least the configured pixel threshold or an equivalent readable size in
  the project style system.
- Limitations: external CSS, classes, inheritance, cascade, relative-unit calculation, zoom, user
  settings, and rendered context are not evaluated.
- Verification: `tests/rules/ux/small-inline-text.test.ts`.

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

import { writeFileSync } from 'node:fs';

writeFileSync(new URL('../TARGET_SOURCE_EXECUTED', import.meta.url), 'executed');

export const App = () => (
  <main>
    <h1>Mixed project</h1>
    <img
      alt="Release timeline"
      data-uxaudit-case="mixed-img-lazy-loading"
      height={180}
      loading="eager"
      src="/timeline.png"
      width={320}
    />
    <a data-uxaudit-case="mixed-ambiguous-link-text" href="/releases">
      Here
    </a>
    <span style={{ fontSize: 12 }}>Release details</span>
    <section aria-label="Unsupported static-analysis boundary cases">
      <ActionButton data-uxaudit-case="unsupported-button-name" />
      <ContentImage data-uxaudit-case="unsupported-img-alt" src="/abstract-image.png" />
      <FormField data-uxaudit-case="unsupported-input-label" name="abstract-field" />
      <ResponsiveImage data-uxaudit-case="unsupported-img-dimensions" src="/responsive-image.png" />
      <PriorityImage data-uxaudit-case="unsupported-img-lazy-loading" src="/priority-image.png" />
      <NavigationLink data-uxaudit-case="unsupported-ambiguous-link-text" href="/abstract">
        Here
      </NavigationLink>
      <PageHeading data-uxaudit-case="unsupported-multiple-h1" level={1}>
        Abstract heading
      </PageHeading>
      <BodyText data-uxaudit-case="unsupported-small-inline-text" style={{ fontSize: 8 }}>
        Abstract small text
      </BodyText>
    </section>
  </main>
);

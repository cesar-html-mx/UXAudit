import { writeFileSync } from 'node:fs';

writeFileSync(new URL('../TARGET_SOURCE_EXECUTED', import.meta.url), 'executed');

export const InvalidProject = () => (
  <main>
    <img
      data-uxaudit-case="invalid-img-alt"
      height={180}
      loading="lazy"
      src="/missing-alt.png"
      width={320}
    />
    <input data-uxaudit-case="invalid-input-label" type="email" />
    <button data-uxaudit-case="invalid-button-name" type="button" />
    <img
      alt="Reserved-space example"
      data-uxaudit-case="invalid-img-dimensions"
      height={100}
      loading="lazy"
      src="/invalid-dimensions.png"
      width={0}
    />
    <img
      alt="Lazy-loading example"
      data-uxaudit-case="invalid-img-lazy-loading"
      height={180}
      loading="eager"
      src="/eager.png"
      width={320}
    />
    <a data-uxaudit-case="invalid-ambiguous-link-text" href="/details">
      Read more
    </a>
    <section>
      <h1>Primary heading</h1>
      <h1 data-uxaudit-case="invalid-multiple-h1">Secondary heading</h1>
    </section>
    <span data-uxaudit-case="invalid-small-inline-text" style={{ fontSize: 10 }}>
      Supporting details
    </span>
  </main>
);

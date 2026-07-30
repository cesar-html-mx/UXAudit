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
  </main>
);

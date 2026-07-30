import { writeFileSync } from 'node:fs';

writeFileSync(new URL('../TARGET_EXCLUDED_SOURCE_EXECUTED', import.meta.url), 'executed');

export const ExcludedBuildOutput = () => (
  <main>
    <img src="/excluded.png" />
    <button />
    <h1>Excluded heading</h1>
    <h1>Excluded duplicate</h1>
  </main>
);

import { writeFileSync } from 'node:fs';

writeFileSync(new URL('../TARGET_SOURCE_EXECUTED', import.meta.url), 'executed');

export const App = () => (
  <main>
    <h1 data-uxaudit-case="valid-single-h1">Account overview</h1>
    <img
      alt="Account activity chart"
      data-uxaudit-case="valid-image"
      height={180}
      loading="lazy"
      src="/activity.png"
      width={320}
    />
    <label htmlFor="valid-email">Email address</label>
    <input data-uxaudit-case="valid-input-label" id="valid-email" type="email" />
    <button data-uxaudit-case="valid-button-name" type="button">
      Save account
    </button>
    <a data-uxaudit-case="valid-link-text" href="/account/security">
      Review account security
    </a>
    <span data-uxaudit-case="valid-inline-text" style={{ fontSize: 12 }}>
      Updated today
    </span>
  </main>
);

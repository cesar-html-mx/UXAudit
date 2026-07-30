import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const releaseWorkflowPath = new URL('../.github/workflows/release.yml', import.meta.url);

describe('npm release workflow', () => {
  it('publishes through GitHub OIDC without a long-lived npm token', async () => {
    const workflow = await readFile(releaseWorkflowPath, 'utf8');

    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('environment: npm');
    expect(workflow).toContain('npm publish --access public');
    expect(workflow).not.toMatch(/\b(?:NPM_TOKEN|NODE_AUTH_TOKEN)\b/u);
  });
});

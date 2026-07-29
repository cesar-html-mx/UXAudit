import { describe, expect, it } from 'vitest';

import { createScanProject } from '../../src/application/scan-project.js';

describe('scanProject', () => {
  it('delegates path validation and returns its canonical path', async () => {
    const requestedPaths: string[] = [];
    const scanProject = createScanProject((projectPath) => {
      requestedPaths.push(projectPath);
      return Promise.resolve('/canonical/project');
    });

    const result = await scanProject({ projectPath: 'relative-project' });

    expect(requestedPaths).toEqual(['relative-project']);
    expect(result).toEqual({ projectPath: '/canonical/project' });
  });
});

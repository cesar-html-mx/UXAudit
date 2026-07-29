import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { scanProject } from '../../src/application/scan-project.js';

describe('scanProject', () => {
  it('prepares an absolute project path without traversing it', async () => {
    const result = await scanProject({ projectPath: 'relative-project' });

    expect(result).toEqual({
      projectPath: resolve('relative-project'),
    });
  });
});

import { describe, expect, it } from 'vitest';

import {
  SCAN_PROJECT_ERROR_CODES,
  ScanProjectError,
  createScanProject,
} from '../../src/application/scan-project.js';
import {
  PROJECT_PATH_ERROR_CODES,
  ProjectPathError,
} from '../../src/project/validate-project-path.js';

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

  it('maps expected project-path errors to the application input boundary', async () => {
    const projectError = new ProjectPathError(PROJECT_PATH_ERROR_CODES.notFound);
    const scanProject = createScanProject(() => Promise.reject(projectError));

    await expect(scanProject({ projectPath: 'missing' })).rejects.toMatchObject({
      cause: projectError,
      code: SCAN_PROJECT_ERROR_CODES.invalidPath,
      message: 'Project path does not exist.',
    });
  });

  it('maps unclassified project validation errors to the application internal boundary', async () => {
    const projectError = new ProjectPathError(PROJECT_PATH_ERROR_CODES.validationFailed);
    const scanProject = createScanProject(() => Promise.reject(projectError));

    await expect(scanProject({ projectPath: 'project' })).rejects.toMatchObject({
      cause: projectError,
      code: SCAN_PROJECT_ERROR_CODES.validationFailed,
      message: 'Project path could not be validated.',
    });
  });

  it('sanitizes unexpected validator failures at the application boundary', async () => {
    const unexpectedError = new Error('native details must stay hidden');
    const scanProject = createScanProject(() => Promise.reject(unexpectedError));

    try {
      await scanProject({ projectPath: 'project' });
      throw new Error('Expected scan preparation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ScanProjectError);
      expect(error).toMatchObject({
        cause: unexpectedError,
        code: SCAN_PROJECT_ERROR_CODES.validationFailed,
        message: 'Project path could not be validated.',
      });
    }
  });
});

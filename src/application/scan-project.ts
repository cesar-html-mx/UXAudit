import { validateProjectPath, type ValidateProjectPath } from '../project/validate-project-path.js';

export interface ScanProjectRequest {
  readonly projectPath: string;
}

export interface ScanProjectResult {
  readonly projectPath: string;
}

export type ScanProject = (request: ScanProjectRequest) => Promise<ScanProjectResult>;

export const createScanProject =
  (validatePath: ValidateProjectPath): ScanProject =>
  async (request) => ({
    projectPath: await validatePath(request.projectPath),
  });

export const scanProject = createScanProject(validateProjectPath);

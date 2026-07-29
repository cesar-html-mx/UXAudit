import { resolve } from 'node:path';

export interface ScanProjectRequest {
  readonly projectPath: string;
}

export interface ScanProjectResult {
  readonly projectPath: string;
}

export type ScanProject = (request: ScanProjectRequest) => Promise<ScanProjectResult>;

export const scanProject: ScanProject = (request) =>
  Promise.resolve({
    projectPath: resolve(request.projectPath),
  });

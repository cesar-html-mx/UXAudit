export const createComponentId = (filePath: string, startOffset: number): string =>
  `component:${filePath}:${String(startOffset)}`;

export const createJsxNodeId = (filePath: string, startOffset: number): string =>
  `jsx:${filePath}:${String(startOffset)}`;

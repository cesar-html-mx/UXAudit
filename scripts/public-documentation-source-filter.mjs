const bilingualRootReadmeNames = new Set(['README.en.md', 'README.es.md']);
const publicEvidenceRootFileNames = new Set(['README.md', 'README.es.md']);
const publicEvidenceDirectoryFileNames = new Map([
  ['security', new Set(['SECURITY_CHECKLIST.md', 'SECURITY_CHECKLIST.es.md'])],
  [
    'usability',
    new Set(['SUS_EN.md', 'SUS_ES.md', 'USABILITY_PROTOCOL.md', 'USABILITY_PROTOCOL.es.md']),
  ],
]);

export const getPublicDocumentationCopyDecision = (segments) => {
  if (segments.length === 1 && bilingualRootReadmeNames.has(segments[0])) {
    return true;
  }

  if (segments[0] !== 'evidence') {
    return undefined;
  }

  if (segments.length === 1) {
    return true;
  }

  if (segments.length === 2 && publicEvidenceRootFileNames.has(segments[1])) {
    return true;
  }

  const allowedFileNames = publicEvidenceDirectoryFileNames.get(segments[1]);

  if (!allowedFileNames) {
    return false;
  }

  if (segments.length === 2) {
    return true;
  }

  return segments.length === 3 && allowedFileNames.has(segments[2]);
};

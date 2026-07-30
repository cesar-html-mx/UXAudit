import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

interface PublicDocumentationSourceFilter {
  readonly getPublicDocumentationCopyDecision: (segments: readonly string[]) => boolean | undefined;
}

const sourceModuleUrl = pathToFileURL(
  path.resolve(import.meta.dirname, '../../scripts/public-documentation-source-filter.mjs'),
).href;

const loadSourceFilter = async (): Promise<PublicDocumentationSourceFilter> =>
  (await import(sourceModuleUrl)) as PublicDocumentationSourceFilter;

describe('public documentation evidence-source filter', () => {
  it('includes the root bilingual readmes and exact public evidence documents', async () => {
    const { getPublicDocumentationCopyDecision } = await loadSourceFilter();
    const includedPaths = [
      ['README.en.md'],
      ['README.es.md'],
      ['evidence'],
      ['evidence', 'README.md'],
      ['evidence', 'README.es.md'],
      ['evidence', 'security'],
      ['evidence', 'security', 'SECURITY_CHECKLIST.md'],
      ['evidence', 'security', 'SECURITY_CHECKLIST.es.md'],
      ['evidence', 'usability'],
      ['evidence', 'usability', 'SUS_EN.md'],
      ['evidence', 'usability', 'SUS_ES.md'],
      ['evidence', 'usability', 'USABILITY_PROTOCOL.md'],
      ['evidence', 'usability', 'USABILITY_PROTOCOL.es.md'],
    ] as const;

    for (const segments of includedPaths) {
      expect(getPublicDocumentationCopyDecision(segments)).toBe(true);
    }
  });

  it('excludes historical evidence packages and non-public evidence files', async () => {
    const { getPublicDocumentationCopyDecision } = await loadSourceFilter();
    const excludedPaths = [
      ['evidence', 'AGENTS.md'],
      ['evidence', 'm01-bootstrap'],
      ['evidence', 'm06-validation', 'SUMMARY.md'],
      ['evidence', 'security', '.gitkeep'],
      ['evidence', 'security', 'PRIVATE.md'],
      ['evidence', 'usability', '.gitkeep'],
      ['evidence', 'usability', 'raw', 'participant.json'],
    ] as const;

    for (const segments of excludedPaths) {
      expect(getPublicDocumentationCopyDecision(segments)).toBe(false);
    }
  });

  it('defers non-evidence source paths to each collector policy', async () => {
    const { getPublicDocumentationCopyDecision } = await loadSourceFilter();

    expect(getPublicDocumentationCopyDecision(['README.md'])).toBeUndefined();
    expect(getPublicDocumentationCopyDecision(['docs', '03_REQUIREMENTS.md'])).toBeUndefined();
    expect(getPublicDocumentationCopyDecision(['src', 'cli', 'index.ts'])).toBeUndefined();
  });
});

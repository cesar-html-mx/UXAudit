import { access, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { auditProject, type AuditProjectResult } from '../../src/application/audit-project.js';
import { REPORT_FORMATS } from '../../src/configuration/configuration.js';

interface ExpectedIntercomponentAudit {
  readonly counts: {
    readonly resolvedComponentUses: number;
  };
  readonly findings: readonly {
    readonly filePath: string;
    readonly line: number;
    readonly ruleId: string;
  }[];
}

const fixtureUrl = new URL('../fixtures/intercomponent/static-composition/', import.meta.url);
const fixturePath = fileURLToPath(fixtureUrl);

const normalizeCanonicalPath = (value: string, projectRoot: string): string => {
  const relativePath = relative(projectRoot, value);

  if (relativePath === '') {
    return '<PROJECT_ROOT>';
  }

  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    return value;
  }

  return `<PROJECT_ROOT>/${relativePath.split(sep).join('/')}`;
};

const createStableProjection = (result: AuditProjectResult): Readonly<Record<string, unknown>> => {
  const projectRoot = result.auditResult.projectRoot;

  return {
    analysis: {
      ...result.analysis,
      discovery: {
        ...result.analysis.discovery,
        files: result.analysis.discovery.files.map((file) => ({
          ...file,
          absolutePath: normalizeCanonicalPath(file.absolutePath, projectRoot),
          observedPath: normalizeCanonicalPath(file.observedPath, projectRoot),
        })),
        projectRoot: '<PROJECT_ROOT>',
      },
      inventory: {
        ...result.analysis.inventory,
        entries: result.analysis.inventory.entries.map((entry) => ({
          ...entry,
          absolutePath: normalizeCanonicalPath(entry.absolutePath, projectRoot),
        })),
        projectRoot: '<PROJECT_ROOT>',
      },
      projectPath: '<PROJECT_ROOT>',
      sourceCandidates: result.analysis.sourceCandidates.map((candidate) => ({
        ...candidate,
        absolutePath: normalizeCanonicalPath(candidate.absolutePath, projectRoot),
      })),
    },
    auditResult: {
      ...result.auditResult,
      projectRoot: '<PROJECT_ROOT>',
      timing: {
        completedAt: '<TIMESTAMP>',
        durationMs: 0,
        startedAt: '<TIMESTAMP>',
      },
    },
    writtenReports: result.writtenReports,
  };
};

describe('auditProject intercomponent integration', () => {
  it('reports the exact reviewed composition findings deterministically without executing target code', async () => {
    const projectRoot = await realpath(fixturePath);
    const sentinelPath = join(projectRoot, 'TARGET_CODE_EXECUTED');
    const expected = JSON.parse(
      await readFile(new URL('expected.json', fixtureUrl), 'utf8'),
    ) as ExpectedIntercomponentAudit;
    const request = {
      overrides: {
        color: false,
        formats: [REPORT_FORMATS.terminal],
        verbose: true,
      },
      projectPath: projectRoot,
    } as const;

    await expect(access(sentinelPath)).rejects.toBeDefined();

    const first = await auditProject(request);
    const second = await auditProject(request);
    const findingProjection = first.auditResult.findings.map((finding) => ({
      filePath: finding.location?.filePath,
      line: finding.location?.start.line,
      ruleId: finding.ruleId,
    }));

    expect(first.writtenReports).toEqual([]);
    expect(first.analysis.parserErrors).toEqual([]);
    expect(first.auditResult.errors).toEqual([]);
    expect(first.auditResult.summary.rules.failedRuleCount).toBe(0);
    expect(first.auditResult.findings).toHaveLength(expected.findings.length);
    expect(findingProjection).toEqual(expected.findings);
    expect(first.analysis.model.componentLinks).toHaveLength(expected.counts.resolvedComponentUses);
    expect(createStableProjection(second)).toEqual(createStableProjection(first));
    await expect(access(sentinelPath)).rejects.toBeDefined();
  });
});

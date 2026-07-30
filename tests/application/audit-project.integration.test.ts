import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { auditProject } from '../../src/application/audit-project.js';
import {
  REPORT_WRITE_ERROR_CODES,
  ReportWriteError,
} from '../../src/reporting/files/write-report-file.js';

const createdDirectories: string[] = [];

const createControlledProject = async (): Promise<string> => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'uxaudit-audit-integration-'));
  createdDirectories.push(temporaryDirectory);
  const projectRoot = await realpath(temporaryDirectory);
  const sourceDirectory = join(projectRoot, 'src');
  const catalogSource = await readFile(
    new URL('../fixtures/rule-catalog/catalog-cases.tsx.fixture', import.meta.url),
    'utf8',
  );

  await mkdir(sourceDirectory, { recursive: true });
  await Promise.all([
    writeFile(join(sourceDirectory, 'Catalog.tsx'), catalogSource, 'utf8'),
    writeFile(
      join(sourceDirectory, 'Broken.tsx'),
      'export const Broken = () => <section><span>Missing</section>;\n',
      'utf8',
    ),
    writeFile(
      join(projectRoot, 'uxaudit.config.json'),
      `${JSON.stringify(
        {
          color: false,
          formats: ['terminal', 'json', 'html'],
          outputDirectory: 'reports',
          schemaVersion: 1,
          verbose: true,
        },
        null,
        2,
      )}\n`,
      'utf8',
    ),
  ]);

  return projectRoot;
};

afterEach(async () => {
  await Promise.all(
    createdDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('auditProject integration', () => {
  it('runs the complete pipeline, isolates malformed syntax, writes both reports, and refuses overwrite', async () => {
    const projectRoot = await createControlledProject();
    const result = await auditProject({ projectPath: projectRoot });

    expect(result.analysis.sourceCandidates.map((candidate) => candidate.relativePath)).toEqual([
      'src/Broken.tsx',
      'src/Catalog.tsx',
    ]);
    expect(result.analysis.parsingSummary).toEqual({
      components: 2,
      failedFiles: 1,
      jsxNodes: 25,
      parsedFiles: 1,
    });
    expect(result.auditResult.summary.files).toEqual({
      discovered: 2,
      failed: 1,
      parsed: 1,
      selected: 2,
    });
    expect(result.auditResult.summary.rules).toEqual({
      availableRuleCount: 8,
      enabledRuleCount: 8,
      executedRuleCount: 8,
      failedRuleCount: 0,
      findingCount: 8,
      succeededRuleCount: 8,
    });
    expect(result.auditResult.findings.map((finding) => finding.ruleId)).toEqual([
      'accessibility/button-name',
      'accessibility/img-alt',
      'accessibility/input-label',
      'performance/img-dimensions',
      'performance/img-lazy-loading',
      'seo/ambiguous-link-text',
      'seo/multiple-h1',
      'ux/small-inline-text',
    ]);
    expect(result.auditResult.summary.errors).toEqual({
      byStage: {
        discovery: 0,
        extract: 0,
        parse: 1,
        read: 0,
        rule: 0,
      },
      total: 1,
    });
    expect(result.writtenReports).toEqual([
      { format: 'json', relativePath: 'reports/audit-report.json' },
      { format: 'html', relativePath: 'reports/audit-report.html' },
    ]);

    const jsonPath = join(projectRoot, 'reports', 'audit-report.json');
    const htmlPath = join(projectRoot, 'reports', 'audit-report.html');
    const [jsonContent, htmlContent] = await Promise.all([
      readFile(jsonPath, 'utf8'),
      readFile(htmlPath, 'utf8'),
    ]);

    expect(JSON.parse(jsonContent)).toEqual(result.auditResult);
    expect(htmlContent).toContain('<!doctype html>');
    expect(htmlContent).toContain('Findings <code>8</code>');
    expect(htmlContent).toContain('Recoverable processing errors <code>1</code>');
    await expect(access(join(projectRoot, 'src', 'TARGET_CODE_EXECUTED'))).rejects.toBeDefined();

    try {
      await auditProject({ projectPath: projectRoot });
      expect.unreachable('The existing JSON target must prevent a second report set.');
    } catch (error) {
      expect(error).toBeInstanceOf(ReportWriteError);
      expect(error).toMatchObject({
        code: REPORT_WRITE_ERROR_CODES.targetExists,
      });
    }

    await expect(readFile(jsonPath, 'utf8')).resolves.toBe(jsonContent);
    await expect(readFile(htmlPath, 'utf8')).resolves.toBe(htmlContent);
  });
});

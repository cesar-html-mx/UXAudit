import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  access,
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';

import { format } from 'prettier';

import { renderHtmlReport } from '../dist/reporting/html/html-reporter.js';
import { renderJsonReport } from '../dist/reporting/json/json-reporter.js';
import { createPerformanceSummary } from '../dist/validation/performance-summary.js';

const schemaVersion = 1;
const scenarioId = 'M06-SYSTEM-ROBUSTNESS-SECURITY-PERFORMANCE';
const repositoryRoot = process.cwd();
const fixtureRoot = path.join(repositoryRoot, 'fixtures', 'm06-validation');
const manifestPath = path.join(fixtureRoot, 'manifest.json');
const cliPath = path.join(repositoryRoot, 'dist', 'cli', 'index.js');
const unsupportedLinkCodes = new Set(['EACCES', 'EINVAL', 'ENOSYS', 'ENOTSUP', 'EPERM']);
const jsonFormatOptions = {
  endOfLine: 'lf',
  parser: 'json',
  printWidth: 100,
};

const toCanonicalJson = (value) => format(JSON.stringify(value, null, 2), jsonFormatOptions);
const digest = (content) => `sha256:${createHash('sha256').update(content).digest('hex')}`;

const parseOutputDirectory = (argumentsList) => {
  if (argumentsList.length === 0) {
    return undefined;
  }

  assert.deepEqual(
    argumentsList.slice(0, 1),
    ['--output'],
    'Only the optional --output <directory> argument is supported.',
  );
  assert.equal(argumentsList.length, 2, '--output requires exactly one directory.');
  assert.ok(argumentsList[1]?.trim(), '--output requires a non-empty directory.');

  return path.resolve(argumentsList[1]);
};

const pathExists = async (targetPath) => {
  try {
    await access(targetPath);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
};

const readPeakRssBytes = async (pid) => {
  if (process.platform !== 'linux') {
    return null;
  }

  try {
    const status = await readFile(`/proc/${String(pid)}/status`, 'utf8');
    const match = /^VmRSS:\s+([0-9]+)\s+kB$/mu.exec(status);

    if (match?.[1] === undefined) {
      return null;
    }

    const kibibytes = Number(match[1]);
    return Number.isSafeInteger(kibibytes) ? kibibytes * 1024 : null;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'ESRCH')
    ) {
      return null;
    }

    throw error;
  }
};

const executeCli = (argumentsList, { observePeakRss = false } = {}) =>
  new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const child = spawn(process.execPath, [cliPath, ...argumentsList], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
      },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    let peakRssBytes = null;
    let sampleInFlight;
    const sample = async () => {
      if (!observePeakRss || child.pid === undefined) {
        return undefined;
      }

      if (sampleInFlight !== undefined) {
        return sampleInFlight;
      }

      sampleInFlight = (async () => {
        try {
          const observed = await readPeakRssBytes(child.pid);

          if (observed !== null && (peakRssBytes === null || observed > peakRssBytes)) {
            peakRssBytes = observed;
          }
        } finally {
          sampleInFlight = undefined;
        }
      })();

      return sampleInFlight;
    };
    const timer = observePeakRss ? setInterval(() => void sample(), 5) : undefined;

    void sample();
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr.push(chunk);
    });
    child.once('error', (error) => {
      if (timer !== undefined) {
        clearInterval(timer);
      }

      reject(error);
    });
    child.once('close', async (code, signal) => {
      const completedAt = performance.now();

      if (timer !== undefined) {
        clearInterval(timer);
      }

      await sampleInFlight;
      resolve({
        durationMs: Math.round((completedAt - startedAt) * 1000) / 1000,
        exitCode: code,
        peakRssBytes,
        signal,
        stderr: stderr.join(''),
        stdout: stdout.join(''),
      });
    });
  });

const executeNpmAudit = () =>
  new Promise((resolve, reject) => {
    const npmCliPath =
      process.env.npm_execpath ??
      path.resolve(
        path.dirname(process.execPath),
        '..',
        'lib',
        'node_modules',
        'npm',
        'bin',
        'npm-cli.js',
      );
    const child = spawn(
      process.execPath,
      [npmCliPath, 'audit', '--audit-level=moderate', '--json'],
      {
        cwd: repositoryRoot,
        env: process.env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const stdout = [];
    const stderr = [];

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr.push(chunk);
    });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      resolve({
        exitCode: code,
        signal,
        stderr: stderr.join(''),
        stdout: stdout.join(''),
      });
    });
  });

const replaceTemplateValue = (template, replacements) => {
  let rendered = template;

  for (const [name, value] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(`{{${name}}}`, value);
  }

  assert.equal(/\{\{[A-Z_]+\}\}/u.test(rendered), false, `Unresolved template: ${rendered}`);
  return rendered;
};

const createLargeProject = async (projectRoot, definition) => {
  const { generation } = definition;

  assert.equal(
    generation.directoryCount * generation.filesPerDirectory,
    generation.sourceFileCount,
  );
  await mkdir(projectRoot, { recursive: true });
  await writeFile(
    path.join(projectRoot, 'package.json'),
    await toCanonicalJson({
      name: 'uxaudit-m06-large-fixture',
      private: true,
      scripts: {
        [generation.packageScriptName]: generation.packageScriptCommand,
      },
      version: '1.0.0',
    }),
    'utf8',
  );

  for (let offset = 0; offset < generation.sourceFileCount; offset += 1) {
    const index = generation.indexOrigin + offset;
    const indexPadded = String(index).padStart(generation.paddingWidth, '0');
    const batch = Math.floor(offset / generation.filesPerDirectory);
    const batchPadded = String(batch).padStart(generation.paddingWidth, '0');
    const replacements = {
      BATCH_PADDED: batchPadded,
      COMPONENT_NAME: replaceTemplateValue(generation.componentNamePattern, {
        INDEX_PADDED: indexPadded,
      }),
      INDEX: String(index),
      INDEX_PADDED: indexPadded,
    };
    const relativeDirectory = replaceTemplateValue(generation.directoryNamePattern, replacements);
    const relativeFile = path.join(
      relativeDirectory,
      replaceTemplateValue(generation.fileNamePattern, replacements),
    );
    const source = generation.sourceTemplateLines
      .map((line) => replaceTemplateValue(line, replacements))
      .join('\n');

    await mkdir(path.join(projectRoot, relativeDirectory), { recursive: true });
    await writeFile(path.join(projectRoot, relativeFile), source, 'utf8');
  }
};

const createRuntimeLinks = async (projectRoot, temporaryRoot, definitions) => {
  const externalTarget = path.join(temporaryRoot, 'external-violation.tsx');

  await writeFile(externalTarget, 'export const External = () => <button />;\n', 'utf8');
  const observations = [];

  for (const definition of definitions) {
    const linkPath = path.join(projectRoot, definition.path);
    const target =
      definition.target === 'runtime-external-file' ? externalTarget : definition.target;

    try {
      await symlink(target, linkPath, definition.type === 'directory' ? 'dir' : 'file');
      observations.push({
        created: true,
        expectedDefaultDisposition: definition.expectedDefaultDisposition,
        path: definition.path,
        targetAuthority: definition.targetAuthority,
        type: definition.type,
      });
    } catch (error) {
      if (error && typeof error === 'object' && unsupportedLinkCodes.has(error.code)) {
        observations.push({
          created: false,
          expectedDefaultDisposition: definition.expectedDefaultDisposition,
          path: definition.path,
          targetAuthority: definition.targetAuthority,
          type: definition.type,
          unsupportedReason: error.code,
        });
        continue;
      }

      throw error;
    }
  }

  return observations;
};

const createHostileProject = async (projectRoot, temporaryRoot, definition, manifest) => {
  const base = manifest.committedProjects[definition.baseProject];

  assert.ok(base, `Unknown hostile base: ${definition.baseProject}`);
  await cp(path.join(fixtureRoot, base.directory), projectRoot, {
    errorOnExist: true,
    force: false,
    recursive: true,
  });
  await writeFile(
    path.join(projectRoot, definition.portableHostileFilePath),
    definition.sourceTemplateLines.join('\n'),
    'utf8',
  );

  return createRuntimeLinks(projectRoot, temporaryRoot, definition.runtimeLinks);
};

const copyCommittedProject = async (projectId, projectRoot, manifest) => {
  const definition = manifest.committedProjects[projectId];

  assert.ok(definition, `Unknown project: ${projectId}`);
  await cp(path.join(fixtureRoot, definition.directory), projectRoot, {
    errorOnExist: true,
    force: false,
    recursive: true,
  });
  return definition;
};

const assertSentinelsAbsent = async (projectRoot, definition) => {
  for (const sentinelPath of definition.sentinelPaths) {
    assert.equal(
      await pathExists(path.join(projectRoot, sentinelPath)),
      false,
      `Target code executed: ${sentinelPath}`,
    );
  }
};

const stableResult = (result) => {
  const projection = structuredClone(result);

  Reflect.deleteProperty(projection, 'projectRoot');
  Reflect.deleteProperty(projection, 'timing');
  return projection;
};

const escapeHtmlValue = (value) =>
  value.replace(
    /[&<>"']/gu,
    (character) =>
      ({
        '&': '&amp;',
        "'": '&#39;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
      })[character] ?? '',
  );

const containsRawControlOrBidiCharacter = (value) =>
  [...value].some((character) => {
    const codePoint = character.codePointAt(0);

    return (
      codePoint !== undefined &&
      ((codePoint <= 0x1f && codePoint !== 0x09 && codePoint !== 0x0a && codePoint !== 0x0d) ||
        codePoint === 0x7f ||
        (codePoint >= 0x202a && codePoint <= 0x202e) ||
        (codePoint >= 0x2066 && codePoint <= 0x2069))
    );
  });

const normalizeHtml = (html, result) =>
  html
    .replaceAll(escapeHtmlValue(result.projectRoot), '&lt;PROJECT_ROOT&gt;')
    .replaceAll(result.projectRoot, '&lt;PROJECT_ROOT&gt;')
    .replaceAll(result.timing.completedAt, '&lt;COMPLETED_AT&gt;')
    .replaceAll(result.timing.startedAt, '&lt;STARTED_AT&gt;')
    .replace(
      /(<th scope="row">Duration \(ms\)<\/th>\s*<td><code>)[^<]+(<\/code>)/u,
      '$1&lt;DURATION_MS&gt;$2',
    );

const assertExpected = (result, definition, label) => {
  const expected = definition.expected;
  const findingCounts = Object.fromEntries(
    Object.keys(expected.findingCounts).map((ruleId) => [
      ruleId,
      result.findings.filter((finding) => finding.ruleId === ruleId).length,
    ]),
  );
  const parserErrors = result.errors.filter(
    ({ stage }) => stage === 'extract' || stage === 'parse' || stage === 'read',
  );

  assert.equal(result.summary.files.selected, expected.sourceCandidateCount, `${label} selected`);
  assert.equal(result.summary.files.parsed, expected.parsedFileCount, `${label} parsed`);
  assert.equal(result.summary.files.failed, expected.failedFileCount, `${label} failed`);
  assert.equal(result.summary.findings.total, expected.totalFindings, `${label} findings`);
  assert.deepEqual(findingCounts, expected.findingCounts, `${label} rule counts`);
  assert.equal(parserErrors.length, expected.parserErrors.length, `${label} parser errors`);
};

const executeJsonAudit = async (projectRoot, outputDirectory = 'robustness-report') => {
  const execution = await executeCli([
    'scan',
    projectRoot,
    '--format',
    'json',
    '--output',
    outputDirectory,
    '--no-color',
    '--verbose',
  ]);

  assert.equal(execution.signal, null);
  assert.equal(execution.exitCode, 0);
  assert.equal(execution.stderr, '');
  const reportPath = path.join(projectRoot, outputDirectory, 'audit-report.json');
  const reportText = await readFile(reportPath, 'utf8');

  return { execution, report: JSON.parse(reportText), reportPath, reportText };
};

const runHostileAudit = async (projectRoot, temporaryRoot, definition, manifest) => {
  const links = await createHostileProject(projectRoot, temporaryRoot, definition, manifest);
  const execution = await executeCli([
    'scan',
    projectRoot,
    '--format',
    'all',
    '--output',
    'hostile-reports',
    '--no-color',
    '--verbose',
  ]);

  assert.equal(execution.signal, null);
  assert.equal(execution.exitCode, 0);
  assert.equal(execution.stderr, '');
  const [jsonText, html] = await Promise.all([
    readFile(path.join(projectRoot, 'hostile-reports', 'audit-report.json'), 'utf8'),
    readFile(path.join(projectRoot, 'hostile-reports', 'audit-report.html'), 'utf8'),
  ]);
  const result = JSON.parse(jsonText);

  assertExpected(result, definition, 'hostile project');
  assert.equal(renderJsonReport(result), jsonText, 'The hostile JSON report is not exact.');
  assert.equal(renderHtmlReport(result), html, 'The hostile HTML report is not exact.');
  await assertSentinelsAbsent(projectRoot, definition);

  return { execution, html, jsonText, links, result };
};

const createCase = (id, objective, status, observation) => ({
  id,
  objective,
  observation,
  status,
});

const writeCsv = async (filePath, rows, fields) => {
  const escapeCell = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  };
  const lines = [
    fields.map(escapeCell).join(','),
    ...rows.map((row) => fields.map((field) => escapeCell(row[field])).join(',')),
    '',
  ];

  await writeFile(filePath, lines.join('\n'), 'utf8');
};

const writeArtifacts = async (outputDirectory, artifacts, temporaryRoot) => {
  if (outputDirectory === undefined) {
    return;
  }

  await mkdir(outputDirectory, { recursive: true });

  for (const [fileName, value] of Object.entries(artifacts)) {
    const content = await toCanonicalJson(value);

    assert.equal(content.includes(repositoryRoot), false, `${fileName} retained repository root.`);
    assert.equal(content.includes(temporaryRoot), false, `${fileName} retained temporary root.`);
    await writeFile(path.join(outputDirectory, fileName), content, 'utf8');
  }

  await writeCsv(
    path.join(outputDirectory, 'robustness-cases.csv'),
    artifacts['system-robustness.json'].cases.map((testCase) => ({
      id: testCase.id,
      objective: testCase.objective,
      status: testCase.status,
    })),
    ['id', 'objective', 'status'],
  );
  await writeCsv(
    path.join(outputDirectory, 'performance-runs.csv'),
    artifacts['performance-baseline.json'].samples,
    ['run', 'durationMs', 'peakRssBytes'],
  );
};

const main = async () => {
  const outputDirectory = parseOutputDirectory(process.argv.slice(2));
  const manifestContent = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);

  assert.equal(manifest.schemaVersion, schemaVersion);
  assert.equal(manifest.corpusId, 'M06-CONTROLLED-PROJECTS');
  assert.equal(await pathExists(cliPath), true, 'Build the CLI before running the scenario.');
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'uxaudit-m06-robustness-'));
  const cases = [];
  const securityChecks = [];

  try {
    const canonicalRoot = path.join(temporaryRoot, 'canonical-root');
    const canonicalDefinition = await copyCommittedProject(
      'valid-project',
      canonicalRoot,
      manifest,
    );
    const canonicalExecution = await executeCli([
      'scan',
      `${canonicalRoot}${path.sep}src${path.sep}..`,
      '--no-color',
    ]);

    assert.equal(canonicalExecution.exitCode, 0);
    assert.equal(canonicalExecution.stderr, '');
    assert.equal(
      canonicalExecution.stdout.includes(`Project: ${await realpath(canonicalRoot)}\n`),
      true,
    );
    await assertSentinelsAbsent(canonicalRoot, canonicalDefinition);
    cases.push(
      createCase(
        'canonical-project-root',
        'Resolve an explicitly selected equivalent root.',
        'passed',
        {
          exitCode: canonicalExecution.exitCode,
          canonicalRootMatched: true,
        },
      ),
    );
    securityChecks.push({
      id: 'project-root-canonicalization',
      evidence: 'canonical-project-root',
      status: 'passed',
    });

    const missingExecution = await executeCli([
      'scan',
      path.join(temporaryRoot, 'missing-project'),
      '--no-color',
    ]);

    assert.equal(missingExecution.exitCode, 2);
    assert.equal(missingExecution.stdout, '');
    assert.equal(missingExecution.stderr, 'Project path does not exist.\n');
    cases.push(
      createCase('missing-project-root', 'Reject a missing project path.', 'passed', {
        exitCode: missingExecution.exitCode,
        stderr: missingExecution.stderr.trim(),
      }),
    );

    const missingArgumentExecution = await executeCli(['scan']);

    assert.equal(missingArgumentExecution.exitCode, 2);
    assert.equal(missingArgumentExecution.stdout, '');
    assert.equal(
      missingArgumentExecution.stderr.includes("missing required argument 'project-path'"),
      true,
    );
    cases.push(
      createCase('missing-project-argument', 'Reject scan without a project argument.', 'passed', {
        exitCode: missingArgumentExecution.exitCode,
        stableCommanderDiagnostic: true,
      }),
    );

    const invalidConfigRoot = path.join(temporaryRoot, 'invalid-config');
    const invalidConfigDefinition = await copyCommittedProject(
      'valid-project',
      invalidConfigRoot,
      manifest,
    );
    await writeFile(path.join(invalidConfigRoot, 'uxaudit.config.json'), '{', 'utf8');
    const invalidConfigExecution = await executeCli(['scan', invalidConfigRoot, '--no-color']);

    assert.equal(invalidConfigExecution.exitCode, 2);
    assert.equal(invalidConfigExecution.stdout, '');
    assert.equal(invalidConfigExecution.stderr, 'The configuration file is not valid JSON.\n');
    assert.equal(await pathExists(path.join(invalidConfigRoot, 'uxaudit-reports')), false);
    await assertSentinelsAbsent(invalidConfigRoot, invalidConfigDefinition);
    cases.push(
      createCase('invalid-configuration', 'Reject malformed JSON configuration.', 'passed', {
        exitCode: invalidConfigExecution.exitCode,
        reportsCreated: false,
      }),
    );

    const unsafeOutputRoot = path.join(temporaryRoot, 'unsafe-output');
    await copyCommittedProject('valid-project', unsafeOutputRoot, manifest);
    const escapedOutput = path.join(temporaryRoot, 'escaped-output');
    const unsafeOutputExecution = await executeCli([
      'scan',
      unsafeOutputRoot,
      '--format',
      'json',
      '--output',
      '../escaped-output',
      '--no-color',
    ]);

    assert.equal(unsafeOutputExecution.exitCode, 2);
    assert.equal(unsafeOutputExecution.stderr, 'Configuration contains an unsafe local path.\n');
    assert.equal(await pathExists(escapedOutput), false);
    cases.push(
      createCase('output-path-escape', 'Reject a project-relative output escape.', 'passed', {
        exitCode: unsafeOutputExecution.exitCode,
        outsideReportCreated: false,
      }),
    );
    securityChecks.push({
      id: 'output-path-boundary',
      evidence: 'output-path-escape',
      status: 'passed',
    });

    const linkOutputRoot = path.join(temporaryRoot, 'symlink-output');
    await copyCommittedProject('valid-project', linkOutputRoot, manifest);
    const outsideOutput = path.join(temporaryRoot, 'outside-output');
    await mkdir(outsideOutput);
    const outsideSentinelPath = path.join(outsideOutput, 'PREEXISTING_EXTERNAL_DATA');
    const outsideSentinelContent = 'must remain unchanged\n';

    await writeFile(outsideSentinelPath, outsideSentinelContent, 'utf8');
    let symlinkOutputCase;

    try {
      await symlink(outsideOutput, path.join(linkOutputRoot, 'report-link'), 'dir');
      const linkOutputExecution = await executeCli([
        'scan',
        linkOutputRoot,
        '--format',
        'json',
        '--output',
        'report-link',
        '--no-color',
      ]);

      assert.equal(
        linkOutputExecution.exitCode,
        3,
        `Unexpected symlink-output execution: ${JSON.stringify(linkOutputExecution)}`,
      );
      assert.equal(
        linkOutputExecution.stderr,
        'The report path could not be authorized within the project root.\n',
      );
      assert.equal((await access(outsideOutput), undefined), undefined);
      assert.equal(await pathExists(path.join(outsideOutput, 'audit-report.json')), false);
      assert.equal(await readFile(outsideSentinelPath, 'utf8'), outsideSentinelContent);
      symlinkOutputCase = createCase(
        'symlink-output-escape',
        'Reject an output ancestor linked outside the project.',
        'passed',
        {
          exitCode: linkOutputExecution.exitCode,
          outsideReportCreated: false,
          outsideSentinelUnchanged: true,
        },
      );
    } catch (error) {
      if (error && typeof error === 'object' && unsupportedLinkCodes.has(error.code)) {
        symlinkOutputCase = createCase(
          'symlink-output-escape',
          'Reject an output ancestor linked outside the project.',
          'unsupported',
          { reason: error.code },
        );
      } else {
        throw error;
      }
    }

    cases.push(symlinkOutputCase);
    securityChecks.push({
      id: 'symlink-output-authorization',
      evidence: 'symlink-output-escape',
      status: symlinkOutputCase.status,
    });

    const overwriteRoot = path.join(temporaryRoot, 'overwrite');
    const overwriteDefinition = await copyCommittedProject(
      'valid-project',
      overwriteRoot,
      manifest,
    );
    const firstOverwrite = await executeJsonAudit(overwriteRoot, 'reports');
    const beforeDigest = digest(firstOverwrite.reportText);
    const secondOverwrite = await executeCli([
      'scan',
      overwriteRoot,
      '--format',
      'json',
      '--output',
      'reports',
      '--no-color',
    ]);
    const afterText = await readFile(firstOverwrite.reportPath, 'utf8');

    assert.equal(secondOverwrite.exitCode, 3);
    assert.equal(
      secondOverwrite.stderr,
      'The report target already exists and was not overwritten.\n',
    );
    assert.equal(secondOverwrite.stdout.includes('Report generated:'), false);
    assert.equal(digest(afterText), beforeDigest);
    await assertSentinelsAbsent(overwriteRoot, overwriteDefinition);
    cases.push(
      createCase(
        'exclusive-report-write',
        'Refuse overwrite and preserve report bytes.',
        'passed',
        {
          digestUnchanged: true,
          exitCode: secondOverwrite.exitCode,
        },
      ),
    );
    securityChecks.push({
      id: 'exclusive-report-write',
      evidence: 'exclusive-report-write',
      status: 'passed',
    });

    const mixedRoot = path.join(temporaryRoot, 'mixed');
    const mixedDefinition = await copyCommittedProject('mixed-project', mixedRoot, manifest);
    const mixed = await executeJsonAudit(mixedRoot);

    assertExpected(mixed.report, mixedDefinition, 'mixed project');
    assert.deepEqual(
      mixed.report.errors
        .filter(({ stage }) => stage === 'parse')
        .map(({ code, filePath, message, recoverable, stage }) => ({
          code,
          filePath,
          message,
          recoverable,
          stage,
        })),
      mixedDefinition.expected.parserErrors,
    );
    await assertSentinelsAbsent(mixedRoot, mixedDefinition);
    cases.push(
      createCase(
        'malformed-source-isolation',
        'Retain one recoverable parse failure while auditing siblings.',
        'passed',
        {
          failedFiles: mixed.report.summary.files.failed,
          findings: mixed.report.summary.findings.total,
          parsedFiles: mixed.report.summary.files.parsed,
        },
      ),
    );
    securityChecks.push({
      id: 'malformed-source-isolation',
      evidence: 'malformed-source-isolation',
      status: 'passed',
    });

    const deepRoot = path.join(temporaryRoot, 'deep-project');
    const deepSegments = Array.from(
      { length: 32 },
      (_, index) => `level-${String(index).padStart(2, '0')}`,
    );
    const deepSourceDirectory = path.join(deepRoot, 'src', ...deepSegments);

    await mkdir(deepSourceDirectory, { recursive: true });
    await writeFile(
      path.join(deepRoot, 'package.json'),
      await toCanonicalJson({
        name: 'uxaudit-m06-deep-fixture',
        private: true,
        scripts: {
          'uxaudit:sentinel':
            "node -e \"require('node:fs').writeFileSync('TARGET_PACKAGE_SCRIPT_EXECUTED', 'executed')\"",
        },
        version: '1.0.0',
      }),
      'utf8',
    );
    await writeFile(
      path.join(deepSourceDirectory, 'DeepComponent.tsx'),
      [
        'export const DeepComponent = () => (',
        '  <main>',
        '    <h1>Deep project</h1>',
        '    <button type="button">Save</button>',
        '  </main>',
        ');',
        '',
      ].join('\n'),
      'utf8',
    );
    const deep = await executeJsonAudit(deepRoot);

    assert.equal(deep.report.summary.files.selected, 1);
    assert.equal(deep.report.summary.files.parsed, 1);
    assert.equal(deep.report.summary.files.failed, 0);
    assert.equal(deep.report.summary.findings.total, 0);
    assert.equal(await pathExists(path.join(deepRoot, 'TARGET_PACKAGE_SCRIPT_EXECUTED')), false);
    cases.push(
      createCase(
        'deep-project-traversal',
        'Audit a safe source below 32 nested project directories.',
        'passed',
        {
          findingCount: deep.report.summary.findings.total,
          nestedDirectoryCount: deepSegments.length,
          parsedFiles: deep.report.summary.files.parsed,
        },
      ),
    );
    securityChecks.push({
      id: 'deep-project-behavior',
      evidence: 'deep-project-traversal',
      status: 'passed',
    });

    const hostileDefinition = manifest.generatedProjects['hostile-project'];
    const hostileRootOne = path.join(temporaryRoot, 'hostile-one');
    const hostileRootTwo = path.join(temporaryRoot, 'hostile-two');
    const hostileOne = await runHostileAudit(
      hostileRootOne,
      temporaryRoot,
      hostileDefinition,
      manifest,
    );
    const hostileTwo = await runHostileAudit(
      hostileRootTwo,
      temporaryRoot,
      hostileDefinition,
      manifest,
    );
    const createdLinks = hostileOne.links.filter(({ created }) => created).length;
    const discoverySummary = /^Discovery summary:.*\sexclusions=(\d+)\s/mu.exec(
      hostileOne.execution.stdout,
    );

    if (createdLinks > 0) {
      assert.ok(discoverySummary?.[1], 'The hostile discovery summary is missing.');
      assert.ok(Number(discoverySummary[1]) >= createdLinks);
    }

    assert.deepEqual(stableResult(hostileOne.result), stableResult(hostileTwo.result));
    assert.equal(
      normalizeHtml(hostileOne.html, hostileOne.result),
      normalizeHtml(hostileTwo.html, hostileTwo.result),
    );
    const hostileFilePath = hostileDefinition.portableHostileFilePath;
    const escapedHostileFilePath = escapeHtmlValue(hostileFilePath);

    assert.equal(hostileOne.jsonText.includes(hostileFilePath), true);
    assert.equal(hostileOne.html.includes(hostileFilePath), false);
    assert.equal(hostileOne.html.includes(escapedHostileFilePath), true);
    assert.equal(
      hostileOne.html.includes(
        "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'none'",
      ),
      true,
    );
    assert.equal(/<(?:script|iframe|object|embed|link|img)\b/iu.test(hostileOne.html), false);
    assert.equal(/\son[a-z]+\s*=/iu.test(hostileOne.html), false);
    assert.equal(/@import|url\s*\(/iu.test(hostileOne.html), false);
    assert.equal(containsRawControlOrBidiCharacter(hostileOne.html), false);
    cases.push(
      createCase(
        'symlink-policy',
        'Exclude internal, external, and cyclic runtime links when supported.',
        hostileOne.links.every(({ created }) => created) ? 'passed' : 'unsupported',
        {
          createdLinks,
          linkObservations: hostileOne.links,
          findings: hostileOne.result.summary.findings.total,
        },
      ),
      createCase(
        'hostile-html-structure',
        'Keep hostile project content inert in the standalone HTML report.',
        'passed',
        {
          cspMatched: true,
          escapedHostilePath: true,
          structuralValidationOnly: true,
        },
      ),
      createCase(
        'deterministic-hostile-rerun',
        'Match stable JSON and normalized HTML across fresh hostile roots.',
        'passed',
        { htmlMatched: true, stableJsonMatched: true },
      ),
    );
    securityChecks.push(
      {
        id: 'symlink-loop-and-escape',
        evidence: 'symlink-policy',
        status: hostileOne.links.every(({ created }) => created) ? 'passed' : 'unsupported',
      },
      {
        id: 'html-injection-and-csp',
        evidence: 'hostile-html-structure',
        status: 'passed',
      },
      {
        id: 'deterministic-rerun',
        evidence: 'deterministic-hostile-rerun',
        status: 'passed',
      },
      {
        id: 'target-code-non-execution',
        evidence: 'malformed-source-isolation, hostile-html-structure, performance-large-project',
        status: 'passed',
      },
    );

    let rootPermissionCase;
    let outputPermissionCase;
    const canAttemptPermissions =
      process.platform !== 'win32' &&
      typeof process.getuid === 'function' &&
      process.getuid() !== 0;

    if (canAttemptPermissions) {
      const deniedRoot = path.join(temporaryRoot, 'denied-root');
      await copyCommittedProject('valid-project', deniedRoot, manifest);

      try {
        await chmod(deniedRoot, 0o000);
        let denied = false;

        try {
          await access(deniedRoot, fsConstants.R_OK | fsConstants.X_OK);
        } catch {
          denied = true;
        }

        if (denied) {
          const execution = await executeCli(['scan', deniedRoot, '--no-color']);

          assert.equal(execution.exitCode, 2);
          assert.equal(execution.stderr, 'Project path cannot be accessed.\n');
          rootPermissionCase = createCase(
            'inaccessible-project-root',
            'Reject a project root denied by the real filesystem.',
            'passed',
            { exitCode: execution.exitCode },
          );
        }
      } finally {
        await chmod(deniedRoot, 0o755);
      }

      const deniedOutputRoot = path.join(temporaryRoot, 'denied-output-project');
      await copyCommittedProject('valid-project', deniedOutputRoot, manifest);
      const deniedOutput = path.join(deniedOutputRoot, 'denied-reports');
      await mkdir(deniedOutput);

      try {
        await chmod(deniedOutput, 0o500);
        let denied = false;

        try {
          await access(deniedOutput, fsConstants.W_OK);
        } catch {
          denied = true;
        }

        if (denied) {
          const execution = await executeCli([
            'scan',
            deniedOutputRoot,
            '--format',
            'json',
            '--output',
            'denied-reports',
            '--no-color',
          ]);

          assert.equal(execution.exitCode, 3);
          assert.equal(execution.stderr, 'The report file could not be written.\n');
          outputPermissionCase = createCase(
            'unwritable-report-output',
            'Surface a real filesystem report-write denial.',
            'passed',
            { exitCode: execution.exitCode },
          );
        }
      } finally {
        await chmod(deniedOutput, 0o755);
      }
    }

    rootPermissionCase ??= createCase(
      'inaccessible-project-root',
      'Reject a project root denied by the real filesystem.',
      'not-executed',
      {
        reason: 'Real denial was not portable in this environment.',
        substituteEvidence: 'tests/project/validate-project-path.test.ts',
      },
    );
    outputPermissionCase ??= createCase(
      'unwritable-report-output',
      'Surface a real filesystem report-write denial.',
      'not-executed',
      {
        reason: 'Real denial was not portable in this environment.',
        substituteEvidence: 'tests/reporting/files/write-report-file.test.ts',
      },
    );
    cases.push(rootPermissionCase, outputPermissionCase);
    securityChecks.push(
      {
        id: 'project-root-permission-failure',
        evidence: 'inaccessible-project-root',
        status: rootPermissionCase.status,
      },
      {
        id: 'report-output-permission-failure',
        evidence: 'unwritable-report-output',
        status: outputPermissionCase.status,
      },
    );

    const largeDefinition = manifest.generatedProjects['large-project'];
    const samples = [];

    for (let run = 1; run <= largeDefinition.generation.repeatRuns; run += 1) {
      const largeRoot = path.join(temporaryRoot, `large-run-${String(run)}`);

      await createLargeProject(largeRoot, largeDefinition);
      const execution = await executeCli(
        ['scan', largeRoot, '--format', 'all', '--output', 'performance-reports', '--no-color'],
        { observePeakRss: true },
      );

      assert.equal(execution.exitCode, 0, `Performance run ${String(run)} failed.`);
      assert.equal(execution.signal, null);
      assert.equal(execution.stderr, '');
      const report = JSON.parse(
        await readFile(path.join(largeRoot, 'performance-reports', 'audit-report.json'), 'utf8'),
      );

      assertExpected(report, largeDefinition, `performance run ${String(run)}`);
      await assertSentinelsAbsent(largeRoot, largeDefinition);
      samples.push({
        durationMs: execution.durationMs,
        peakRssBytes: process.platform === 'linux' ? execution.peakRssBytes : null,
        run,
      });
    }

    const performanceSummary = createPerformanceSummary({
      environment: `Node.js ${process.versions.node} / ${process.platform} ${process.arch}`,
      samples,
      scale: {
        componentCount:
          largeDefinition.generation.sourceFileCount * largeDefinition.generation.componentsPerFile,
        sourceFileCount: largeDefinition.generation.sourceFileCount,
      },
    });

    cases.push(
      createCase(
        'performance-large-project',
        'Measure five complete built-CLI runs without a machine-dependent pass threshold.',
        'passed',
        {
          durationMaxMs: performanceSummary.durations.max,
          durationMedianMs: performanceSummary.durations.median,
          durationMinMs: performanceSummary.durations.min,
          runCount: performanceSummary.runCount,
          sourceFileCount: performanceSummary.scale.sourceFileCount,
        },
      ),
    );

    const lockContent = await readFile(path.join(repositoryRoot, 'package-lock.json'), 'utf8');
    const npmrc = await readFile(path.join(repositoryRoot, '.npmrc'), 'utf8');
    const packageDocument = JSON.parse(
      await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
    );

    assert.equal(npmrc.includes('engine-strict=true'), true);
    assert.equal(npmrc.includes('strict-allow-scripts=true'), true);
    assert.equal(npmrc.includes('strict-peer-deps=true'), true);
    assert.equal(
      Object.values(packageDocument.dependencies).every(
        (version) => typeof version === 'string' && /^[0-9]/u.test(version),
      ),
      true,
    );
    const auditExecution = await executeNpmAudit();
    const auditResult = JSON.parse(auditExecution.stdout);
    const vulnerabilityCounts = auditResult.metadata?.vulnerabilities;

    assert.equal(auditExecution.signal, null);
    assert.equal(auditExecution.exitCode, 0);
    assert.equal(auditExecution.stderr, '');
    assert.ok(vulnerabilityCounts, 'npm audit did not return vulnerability metadata.');
    assert.equal(vulnerabilityCounts.moderate, 0);
    assert.equal(vulnerabilityCounts.high, 0);
    assert.equal(vulnerabilityCounts.critical, 0);
    securityChecks.push(
      {
        id: 'dependency-lock-and-install-policy',
        evidence: 'package-lock.json, .npmrc',
        lockDigest: digest(lockContent),
        status: 'passed',
      },
      {
        id: 'dependency-audit-moderate',
        evidence: 'npm audit --audit-level=moderate --json',
        status: 'passed',
      },
      {
        id: 'codeql-hosted-analysis',
        evidence: '.github/workflows/codeql.yml exists; no hosted result was retrieved locally.',
        status: 'unexecuted',
      },
      {
        id: 'secrets-telemetry-production-services',
        evidence:
          'Repository-scope architecture/change review; this is not a runtime security assertion.',
        status: 'reviewed',
      },
    );

    const failedCases = cases.filter(({ status }) => status === 'failed');

    assert.equal(failedCases.length, 0);
    const common = {
      generatedAt: '<COLLECTED_AT>',
      manifestDigest: digest(manifestContent),
      scenarioId,
      schemaVersion,
    };
    const artifacts = {
      'deterministic-security-comparison.json': {
        ...common,
        hostileHtmlMatched: true,
        hostileStableJsonMatched: true,
        volatilityRemoved: ['/projectRoot', '/timing'],
      },
      'html-injection-validation.json': {
        ...common,
        conclusion:
          'Structural escaping and CSP checks passed; this was not a browser exploit execution.',
        contentSecurityPolicyMatched: true,
        executableOrResourceTagsAbsent: true,
        hostilePathEscaped: true,
        rawControlCharactersAbsent: true,
      },
      'performance-baseline.json': {
        ...common,
        conclusion: 'Measured baseline only; no machine-dependent pass threshold was applied.',
        memoryMethod:
          process.platform === 'linux'
            ? 'Maximum observed child VmRSS from /proc/<pid>/status sampled every 5 ms; not an exact lifetime peak.'
            : 'Unavailable: no portable child peak-RSS API.',
        samples,
        summary: performanceSummary,
      },
      'security-checklist.json': {
        ...common,
        dependencyAudit: {
          exitCode: auditExecution.exitCode,
          reportDigest: digest(auditExecution.stdout),
          vulnerabilities: vulnerabilityCounts,
        },
        checks: securityChecks,
        codeqlConclusion: 'Unexecuted locally because no hosted CodeQL result was retrieved.',
      },
      'system-robustness.json': {
        ...common,
        cases,
        conclusion: 'All executable assertions passed; portable exceptions are labelled.',
      },
    };

    await writeArtifacts(outputDirectory, artifacts, temporaryRoot);
    process.stdout.write(
      await toCanonicalJson({
        cases: cases.length,
        codeql: 'unexecuted',
        performance: {
          maxMs: performanceSummary.durations.max,
          medianMs: performanceSummary.durations.median,
          minMs: performanceSummary.durations.min,
          peakRssMeasurement: performanceSummary.peakRss.measurement,
          runs: performanceSummary.runCount,
          sourceFiles: performanceSummary.scale.sourceFileCount,
        },
        scenarioId,
        statuses: Object.fromEntries(
          [...new Set(cases.map(({ status }) => status))]
            .sort()
            .map((status) => [
              status,
              cases.filter((testCase) => testCase.status === status).length,
            ]),
        ),
      }),
    );
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
};

await main();

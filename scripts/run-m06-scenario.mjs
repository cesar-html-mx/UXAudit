import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  access,
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
import process from 'node:process';

import { format } from 'prettier';

import { renderHtmlReport } from '../dist/reporting/html/html-reporter.js';
import { renderJsonReport } from '../dist/reporting/json/json-reporter.js';
import { renderTerminalReport } from '../dist/reporting/terminal/terminal-reporter.js';

const schemaVersion = 1;
const scenarioId = 'M06-CONTROLLED-PROJECTS';
const repositoryRoot = process.cwd();
const fixtureRoot = path.join(repositoryRoot, 'fixtures', 'm06-validation');
const manifestPath = path.join(fixtureRoot, 'manifest.json');
const cliPath = path.join(repositoryRoot, 'dist', 'cli', 'index.js');
const reportDirectory = 'uxaudit-reports';
const jsonReportPath = `${reportDirectory}/audit-report.json`;
const htmlReportPath = `${reportDirectory}/audit-report.html`;
const jsonFormatOptions = {
  endOfLine: 'lf',
  parser: 'json',
  printWidth: 100,
};
const unsupportedLinkCodes = new Set(['EACCES', 'ENOTSUP', 'EPERM']);

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

const assertExactKeys = (value, expectedKeys, label) => {
  assert.deepEqual(
    Object.keys(value).sort(),
    [...expectedKeys].sort(),
    `${label} has unknown keys.`,
  );
};

const readManifest = async () => {
  const content = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(content);

  assert.equal(content, await toCanonicalJson(manifest), 'M06 manifest must use canonical JSON.');
  assertExactKeys(
    manifest,
    [
      'schemaVersion',
      'corpusId',
      'contract',
      'stableRuleIds',
      'committedProjects',
      'generatedProjects',
      'volatileFields',
      'nonExecutionSentinels',
    ],
    'M06 manifest',
  );
  assert.equal(manifest.schemaVersion, schemaVersion);
  assert.equal(manifest.corpusId, scenarioId);
  assert.equal(manifest.stableRuleIds.length, 8);

  return { content, manifest };
};

const executeCli = (argumentsList) =>
  new Promise((resolve, reject) => {
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

  assert.equal(
    /\{\{[A-Z_]+\}\}/u.test(rendered),
    false,
    `Unresolved generated template: ${rendered}`,
  );
  return rendered;
};

const createLargeProject = async (projectRoot, definition) => {
  const { generation } = definition;

  assert.equal(
    generation.directoryCount * generation.filesPerDirectory,
    generation.sourceFileCount,
    'Large-project generation counts are inconsistent.',
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
  const externalTarget = path.join(temporaryRoot, 'runtime-external-file.tsx');

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

  assert.ok(base, `Unknown hostile base project: ${definition.baseProject}`);
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

const projectDefinitions = (manifest) => [
  ...Object.entries(manifest.committedProjects).map(([id, definition]) => ({
    construction: 'committed',
    definition,
    id,
  })),
  ...Object.entries(manifest.generatedProjects).map(([id, definition]) => ({
    construction: id === 'hostile-project' ? 'runtime-security' : 'generated-large',
    definition,
    id,
  })),
];

const createProject = async (
  { construction, definition, id },
  projectRoot,
  temporaryRoot,
  manifest,
) => {
  if (construction === 'committed') {
    await cp(path.join(fixtureRoot, definition.directory), projectRoot, {
      errorOnExist: true,
      force: false,
      recursive: true,
    });
    return [];
  }

  if (construction === 'runtime-security') {
    return createHostileProject(projectRoot, temporaryRoot, definition, manifest);
  }

  assert.equal(id, 'large-project');
  await createLargeProject(projectRoot, definition);
  return [];
};

const parseProgress = (stdout) => {
  const discovery = stdout.match(
    /^Discovery summary: discovered=(\d+) inventory=(\d+) candidates=(\d+) exclusions=(\d+) issues=(\d+)$/mu,
  );
  const parsing = stdout.match(
    /^Parsing summary: parsed=(\d+) failed=(\d+) components=(\d+) jsx=(\d+)$/mu,
  );

  assert.ok(discovery, 'CLI discovery summary is missing or malformed.');
  assert.ok(parsing, 'CLI parsing summary is missing or malformed.');

  return {
    discovery: {
      candidates: Number(discovery[3]),
      discovered: Number(discovery[1]),
      exclusions: Number(discovery[4]),
      inventory: Number(discovery[2]),
      issues: Number(discovery[5]),
    },
    parsing: {
      components: Number(parsing[3]),
      failed: Number(parsing[2]),
      jsx: Number(parsing[4]),
      parsed: Number(parsing[1]),
    },
  };
};

const countFindings = (findings, stableRuleIds) =>
  Object.fromEntries(
    stableRuleIds.map((ruleId) => [
      ruleId,
      findings.filter((finding) => finding.ruleId === ruleId).length,
    ]),
  );

const projectParserErrors = (result) =>
  result.errors
    .filter(({ stage }) => stage === 'extract' || stage === 'parse' || stage === 'read')
    .map(({ code, filePath, message, recoverable, stage }) => ({
      code,
      filePath,
      message,
      recoverable,
      stage,
    }));

const assertExpectedResult = ({ definition, id, links, manifest, progress, result }) => {
  const { expected } = definition;
  const findingRuleIds = result.findings.map(({ ruleId }) => ruleId);
  const findingCounts = countFindings(result.findings, manifest.stableRuleIds);

  assert.equal(result.schemaVersion, '1.0.0');
  assert.deepEqual(result.configuration.formats, ['terminal', 'json', 'html']);
  assert.equal(result.configuration.color, false);
  assert.equal(result.configuration.verbose, true);
  assert.deepEqual(result.reportPaths, {
    html: htmlReportPath,
    json: jsonReportPath,
  });
  assert.equal(result.summary.files.selected, expected.sourceCandidateCount, `${id} candidates`);
  assert.equal(result.summary.files.parsed, expected.parsedFileCount, `${id} parsed files`);
  assert.equal(result.summary.files.failed, expected.failedFileCount, `${id} failed files`);
  assert.equal(result.summary.findings.total, expected.totalFindings, `${id} findings`);
  assert.equal(result.summary.rules.availableRuleCount, manifest.stableRuleIds.length);
  assert.equal(result.summary.rules.enabledRuleCount, manifest.stableRuleIds.length);
  assert.equal(result.summary.rules.executedRuleCount, manifest.stableRuleIds.length);
  assert.equal(result.summary.rules.failedRuleCount, 0);
  assert.deepEqual(findingRuleIds, expected.findingRuleIds, `${id} finding IDs`);
  assert.deepEqual(findingCounts, expected.findingCounts, `${id} finding counts`);
  assert.equal(
    result.errors.length,
    expected.parserErrors.length,
    `${id} retained an unversioned processing error.`,
  );
  assert.equal(
    result.summary.errors.total,
    expected.parserErrors.length,
    `${id} error summary differs from the manifest.`,
  );
  assert.deepEqual(projectParserErrors(result), expected.parserErrors, `${id} parser errors`);
  assert.equal(progress.discovery.candidates, expected.sourceCandidateCount);
  assert.equal(progress.discovery.issues, 0, `${id} retained an unversioned discovery issue.`);
  assert.equal(progress.parsing.parsed, expected.parsedFileCount);
  assert.equal(progress.parsing.failed, expected.failedFileCount);

  const createdLinkCount = links.filter(({ created }) => created).length;

  if (createdLinkCount > 0) {
    assert.ok(
      progress.discovery.exclusions >= createdLinkCount,
      `${id} must report every created runtime link as excluded.`,
    );
  }
};

const assertSentinelsAbsent = async (projectRoot, definition) => {
  for (const relativePath of definition.sentinelPaths) {
    assert.equal(
      await pathExists(path.join(projectRoot, relativePath)),
      false,
      `Target code executed and created ${relativePath}.`,
    );
  }
};

const findingIdentity = (finding) => ({
  category: finding.category,
  confidence: finding.confidence,
  filePath: finding.location?.filePath ?? null,
  location: finding.location,
  message: finding.message,
  ruleId: finding.ruleId,
  severity: finding.severity,
});

const errorIdentity = (error) => ({ ...error });

const runProject = async (descriptor, runNumber, temporaryRoot, manifest) => {
  const projectRoot = path.join(temporaryRoot, `${descriptor.id}-run-${String(runNumber)}`);
  const links = await createProject(descriptor, projectRoot, temporaryRoot, manifest);
  const canonicalProjectRoot = await realpath(projectRoot);
  const argumentsList = [
    'scan',
    projectRoot,
    '--format',
    'all',
    '--output',
    reportDirectory,
    '--no-color',
    '--verbose',
  ];
  const execution = await executeCli(argumentsList);

  assert.equal(execution.signal, null, `${descriptor.id} CLI was terminated by a signal.`);
  assert.equal(execution.exitCode, 0, `${descriptor.id} CLI did not complete successfully.`);
  assert.equal(execution.stderr, '', `${descriptor.id} emitted stderr.`);

  const jsonPath = path.join(projectRoot, jsonReportPath);
  const htmlPath = path.join(projectRoot, htmlReportPath);
  const [json, html] = await Promise.all([readFile(jsonPath, 'utf8'), readFile(htmlPath, 'utf8')]);
  const result = JSON.parse(json);
  const progress = parseProgress(execution.stdout);
  const terminal = renderTerminalReport(result);
  const jsonClaim = `Report generated: json=${jsonReportPath}\n`;
  const htmlClaim = `Report generated: html=${htmlReportPath}\n`;

  assert.equal(result.projectRoot, canonicalProjectRoot);
  assert.equal(renderJsonReport(result), json, `${descriptor.id} JSON report is not exact.`);
  assert.equal(renderHtmlReport(result), html, `${descriptor.id} HTML report is not exact.`);
  assert.equal(
    execution.stdout.includes(terminal),
    true,
    `${descriptor.id} terminal report differs from the shared AuditResult.`,
  );
  assert.equal(execution.stdout.split(jsonClaim).length - 1, 1);
  assert.equal(execution.stdout.split(htmlClaim).length - 1, 1);
  assert.equal(Number.isFinite(result.timing.durationMs), true);
  assert.ok(result.timing.durationMs >= 0);
  assert.equal(new Date(result.timing.startedAt).toISOString(), result.timing.startedAt);
  assert.equal(new Date(result.timing.completedAt).toISOString(), result.timing.completedAt);
  await assertSentinelsAbsent(projectRoot, descriptor.definition);
  assertExpectedResult({
    definition: descriptor.definition,
    id: descriptor.id,
    links,
    manifest,
    progress,
    result,
  });

  if (descriptor.id === 'hostile-project') {
    assert.equal(
      html.includes(descriptor.definition.portableHostileFilePath),
      false,
      'The hostile file path must not remain raw in HTML.',
    );
  }

  const normalizedStdout = execution.stdout.replaceAll(canonicalProjectRoot, '<PROJECT_ROOT>');
  assert.equal(normalizedStdout.includes(temporaryRoot), false);

  return {
    projection: {
      audit: {
        configuration: result.configuration,
        errors: result.errors.map(errorIdentity),
        findings: result.findings.map(findingIdentity),
        reportPaths: result.reportPaths,
        schemaVersion: result.schemaVersion,
        summary: result.summary,
        tool: result.tool,
      },
      cli: {
        arguments: argumentsList.map((argument) =>
          argument === projectRoot ? '<PROJECT_ROOT>' : argument,
        ),
        exitCode: execution.exitCode,
        progress,
        reportClaims: [jsonReportPath, htmlReportPath],
        stderr: execution.stderr,
      },
      construction: descriptor.construction,
      id: descriptor.id,
      reports: {
        htmlExact: true,
        htmlPath: htmlReportPath,
        jsonExact: true,
        jsonPath: jsonReportPath,
        terminalExact: true,
      },
      safety: {
        links,
        projectRootMatched: true,
        targetCodeExecuted: false,
      },
    },
    samples: {
      html,
      json: result,
      stdout: normalizedStdout,
    },
  };
};

const expectedProjection = (manifest) => ({
  schemaVersion,
  scenarioId,
  projects: projectDefinitions(manifest).map(({ construction, definition, id }) => ({
    construction,
    expected: definition.expected,
    id,
  })),
});

const assertPortableContent = (content, volatilePaths, label) => {
  assert.equal(content.includes('\r'), false, `${label} must use LF.`);
  assert.equal(content.isWellFormed(), true, `${label} must use well-formed Unicode.`);

  for (const volatilePath of volatilePaths) {
    assert.equal(content.includes(volatilePath), false, `${label} retained a volatile path.`);
  }
};

const normalizeResultSample = (result) => ({
  ...result,
  projectRoot: '<PROJECT_ROOT>',
  timing: {
    completedAt: '<COMPLETED_AT>',
    durationMs: '<DURATION_MS>',
    startedAt: '<STARTED_AT>',
  },
});

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

const normalizeHtmlSample = (html, result) =>
  html
    .replaceAll(escapeHtmlValue(result.projectRoot), '&lt;PROJECT_ROOT&gt;')
    .replaceAll(result.projectRoot, '&lt;PROJECT_ROOT&gt;')
    .replaceAll(result.timing.completedAt, '&lt;COMPLETED_AT&gt;')
    .replaceAll(result.timing.startedAt, '&lt;STARTED_AT&gt;')
    .replace(
      /(<th scope="row">Duration \(ms\)<\/th>\s*<td><code>)[^<]+(<\/code>)/u,
      '$1&lt;DURATION_MS&gt;$2',
    );

const writeOutputs = async ({
  comparison,
  expected,
  first,
  manifest,
  manifestContent,
  outputDirectory,
  temporaryRoot,
}) => {
  if (outputDirectory === undefined) {
    return;
  }

  const invalidSample = first.samples.get('invalid-project');
  assert.ok(invalidSample, 'Invalid-project report samples are missing.');

  const artifacts = {
    'controlled-projects-actual.json': first.projection,
    'controlled-projects-expected.json': expected,
    'controlled-projects-manifest.json': manifest,
    'deterministic-comparison.json': comparison,
    'invalid-audit-report.normalized.json': normalizeResultSample(invalidSample.json),
  };

  await mkdir(outputDirectory, { recursive: true });

  for (const [fileName, value] of Object.entries(artifacts)) {
    const content = await toCanonicalJson(value);
    assertPortableContent(content, [repositoryRoot, temporaryRoot], fileName);
    await writeFile(path.join(outputDirectory, fileName), content, 'utf8');
  }

  const terminalSample = invalidSample.stdout;
  const htmlSample = normalizeHtmlSample(invalidSample.html, invalidSample.json);

  assert.equal(
    htmlSample.split('&lt;DURATION_MS&gt;').length - 1,
    1,
    'The retained HTML sample must normalize exactly one duration value.',
  );
  assertPortableContent(terminalSample, [repositoryRoot, temporaryRoot], 'terminal sample');
  assertPortableContent(htmlSample, [repositoryRoot, temporaryRoot], 'HTML sample');
  await writeFile(
    path.join(outputDirectory, 'invalid-terminal-report.normalized.txt'),
    terminalSample,
  );
  await writeFile(path.join(outputDirectory, 'invalid-audit-report.normalized.html'), htmlSample);
  assert.equal(digest(manifestContent), first.projection.manifestDigest);
};

const outputDirectory = parseOutputDirectory(process.argv.slice(2));
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'uxaudit-m06-scenario-'));

try {
  const { content: manifestContent, manifest } = await readManifest();
  const descriptors = projectDefinitions(manifest);
  const firstProjects = [];
  const secondProjects = [];
  const firstSamples = new Map();

  assert.deepEqual(
    descriptors.map(({ id }) => id),
    ['valid-project', 'invalid-project', 'mixed-project', 'hostile-project', 'large-project'],
  );

  for (const descriptor of descriptors) {
    const first = await runProject(descriptor, 1, temporaryRoot, manifest);
    const second = await runProject(descriptor, 2, temporaryRoot, manifest);

    firstProjects.push(first.projection);
    secondProjects.push(second.projection);
    firstSamples.set(descriptor.id, first.samples);
  }

  const manifestDigest = digest(manifestContent);
  const firstProjection = {
    manifestDigest,
    projects: firstProjects,
    scenarioId,
    schemaVersion,
  };
  const secondProjection = {
    manifestDigest,
    projects: secondProjects,
    scenarioId,
    schemaVersion,
  };
  const [firstJson, secondJson] = await Promise.all([
    toCanonicalJson(firstProjection),
    toCanonicalJson(secondProjection),
  ]);

  assert.equal(firstJson, secondJson, 'M06 repeated stable projections must be byte-identical.');

  const expected = expectedProjection(manifest);
  const comparison = {
    byteIdentical: firstJson === secondJson,
    manifestExpectationsAsserted: true,
    projectOrderMatched: firstProjects.every(
      ({ id }, index) => id === expected.projects[index]?.id,
    ),
    firstDigest: digest(firstJson),
    manifestDigest,
    scenarioId,
    schemaVersion,
    secondDigest: digest(secondJson),
  };

  await writeOutputs({
    comparison,
    expected,
    first: {
      projection: firstProjection,
      samples: firstSamples,
    },
    manifest,
    manifestContent,
    outputDirectory,
    temporaryRoot,
  });

  process.stdout.write(
    await toCanonicalJson({
      deterministic: comparison.byteIdentical,
      findings: Object.fromEntries(
        firstProjects.map(({ audit, id }) => [id, audit.summary.findings.total]),
      ),
      parserErrors: Object.fromEntries(
        firstProjects.map(({ audit, id }) => [
          id,
          audit.errors.filter(({ stage }) => stage === 'parse').length,
        ]),
      ),
      projects: firstProjects.length,
      scenarioId,
      targetCodeExecuted: firstProjects.some(({ safety }) => safety.targetCodeExecuted),
    }),
  );
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}

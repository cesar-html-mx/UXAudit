import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { format } from 'prettier';

import { analyzeProject } from '../dist/application/analyze-project.js';
import { calculateRuleDetectionMetrics } from '../dist/validation/detection-metrics.js';

const schemaVersion = 1;
const scenarioId = 'M06-RULE-ACCURACY';
const repositoryRoot = process.cwd();
const fixtureRoot = path.join(repositoryRoot, 'fixtures', 'm06-validation');
const groundTruthPath = path.join(fixtureRoot, 'ground-truth.json');
const manifestPath = path.join(fixtureRoot, 'manifest.json');
const cliPath = path.join(repositoryRoot, 'dist', 'cli', 'index.js');
const reportRelativePath = 'uxaudit-accuracy/audit-report.json';
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

const readCanonicalJson = async (filePath, label) => {
  const content = await readFile(filePath, 'utf8');
  const value = JSON.parse(content);

  assert.equal(content, await toCanonicalJson(value), `${label} must use canonical JSON.`);
  return { content, value };
};

const exactCaseId = (node) => {
  if (node.kind !== 'element') {
    return undefined;
  }

  const attribute = node.attributes.find(
    (candidate) =>
      candidate.kind === 'named' &&
      candidate.name === 'data-uxaudit-case' &&
      candidate.value.kind === 'literal' &&
      typeof candidate.value.value === 'string',
  );

  return attribute?.kind === 'named' &&
    attribute.value.kind === 'literal' &&
    typeof attribute.value.value === 'string'
    ? attribute.value.value
    : undefined;
};

const locationContains = (container, location) =>
  location !== null &&
  container.filePath === location.filePath &&
  container.start.offset <= location.start.offset &&
  container.end.offset >= location.end.offset;

const findingIdentity = (projectId, finding, index) => ({
  category: finding.category,
  confidence: finding.confidence,
  filePath: finding.location?.filePath ?? null,
  findingIndex: index,
  location: finding.location,
  message: finding.message,
  projectId,
  ruleId: finding.ruleId,
  severity: finding.severity,
});

const stableReportProjection = (report) => {
  const stable = { ...report };

  Reflect.deleteProperty(stable, 'projectRoot');
  Reflect.deleteProperty(stable, 'timing');
  return stable;
};

const runProject = async (projectId, projectDefinition, temporaryRoot) => {
  const projectRoot = path.join(temporaryRoot, projectId);

  await cp(path.join(fixtureRoot, projectDefinition.directory), projectRoot, {
    errorOnExist: true,
    force: false,
    recursive: true,
  });

  const argumentsList = [
    'scan',
    projectRoot,
    '--format',
    'json',
    '--output',
    'uxaudit-accuracy',
    '--no-color',
  ];
  const execution = await executeCli(argumentsList);

  assert.equal(execution.signal, null, `${projectId} CLI was terminated by a signal.`);
  assert.equal(execution.exitCode, 0, `${projectId} CLI did not complete.`);
  assert.equal(execution.stderr, '', `${projectId} CLI emitted stderr.`);
  assert.equal(
    execution.stdout.includes(`Report generated: json=${reportRelativePath}\n`),
    true,
    `${projectId} did not return the exact JSON writer claim.`,
  );

  const reportText = await readFile(path.join(projectRoot, reportRelativePath), 'utf8');
  const report = JSON.parse(reportText);
  const canonicalProjectRoot = await realpath(projectRoot);

  assert.equal(report.projectRoot, canonicalProjectRoot);
  assert.deepEqual(report.configuration.formats, ['json']);

  const analysis = await analyzeProject({ projectPath: projectRoot });

  assert.equal(analysis.projectPath, canonicalProjectRoot);

  for (const sentinelPath of projectDefinition.sentinelPaths) {
    assert.equal(
      await pathExists(path.join(projectRoot, sentinelPath)),
      false,
      `${projectId} executed target code and created ${sentinelPath}.`,
    );
  }

  const stableReport = stableReportProjection(report);
  const stableReportText = await toCanonicalJson(stableReport);

  return {
    analysis,
    report,
    summary: {
      cliExitCode: execution.exitCode,
      findingCount: report.findings.length,
      id: projectId,
      parserErrorCount: report.errors.filter(
        ({ stage }) => stage === 'extract' || stage === 'parse' || stage === 'read',
      ).length,
      stableReportDigest: digest(stableReportText),
    },
  };
};

const buildCaseNodeIndex = (projectRuns, groundTruth) => {
  const nodesByProjectAndCase = new Map();

  for (const [projectId, run] of projectRuns) {
    for (const node of run.analysis.model.jsxNodes) {
      const caseId = exactCaseId(node);

      if (caseId === undefined) {
        continue;
      }

      const key = `${projectId}\u0000${caseId}`;
      assert.equal(nodesByProjectAndCase.has(key), false, `Duplicate source case: ${key}`);
      nodesByProjectAndCase.set(key, node);
    }
  }

  for (const instance of groundTruth.instances) {
    const key = `${instance.projectId}\u0000${instance.caseId}`;
    const node = nodesByProjectAndCase.get(key);

    assert.ok(node, `Ground-truth case is absent from the model: ${key}`);
    assert.equal(node.location.filePath, instance.sourcePath, `${key} source path differs.`);
  }

  return nodesByProjectAndCase;
};

const matchFindings = (projectRuns, groundTruth, nodesByProjectAndCase) => {
  const matchesByInstance = new Map(
    groundTruth.instances.map((instance) => [
      `${instance.projectId}\u0000${instance.ruleId}\u0000${instance.caseId}`,
      [],
    ]),
  );
  const unmatchedFindings = [];
  const findingIdentities = [];

  for (const [projectId, run] of projectRuns) {
    run.report.findings.forEach((finding, findingIndex) => {
      const identity = findingIdentity(projectId, finding, findingIndex);
      const candidates = groundTruth.instances.filter((instance) => {
        if (instance.projectId !== projectId || instance.ruleId !== finding.ruleId) {
          return false;
        }

        const node = nodesByProjectAndCase.get(`${projectId}\u0000${instance.caseId}`);
        assert.ok(node);
        return locationContains(node.location, finding.location);
      });

      assert.ok(
        candidates.length <= 1,
        `Finding ${projectId}/${finding.ruleId}/${String(findingIndex)} matches multiple cases.`,
      );
      findingIdentities.push(identity);

      const candidate = candidates[0];

      if (candidate === undefined) {
        unmatchedFindings.push(identity);
        return;
      }

      const key = `${candidate.projectId}\u0000${candidate.ruleId}\u0000${candidate.caseId}`;
      const existing = matchesByInstance.get(key);

      assert.ok(existing);

      if (existing.length > 0) {
        unmatchedFindings.push(identity);
        return;
      }

      existing.push(identity);
    });
  }

  const observations = groundTruth.instances.map((instance) => {
    const key = `${instance.projectId}\u0000${instance.ruleId}\u0000${instance.caseId}`;
    const matches = matchesByInstance.get(key);
    const node = nodesByProjectAndCase.get(`${instance.projectId}\u0000${instance.caseId}`);

    assert.ok(matches);
    assert.ok(node);

    const detected = matches.length === 1;
    const outcome =
      instance.classification === 'positive'
        ? detected
          ? 'true-positive'
          : 'false-negative'
        : instance.classification === 'negative'
          ? detected
            ? 'false-positive'
            : 'true-negative'
          : detected
            ? 'unsupported-observed'
            : 'unsupported-clear';

    return {
      caseId: instance.caseId,
      classification: instance.classification,
      detected,
      expectedDetected: instance.expectedDetected,
      matchedFindings: matches,
      nodeLocation: node.location,
      outcome,
      projectId: instance.projectId,
      rationale: instance.rationale,
      ruleId: instance.ruleId,
      sourcePath: instance.sourcePath,
    };
  });

  return {
    findingIdentities,
    observations,
    unmatchedFindings,
  };
};

const abbreviateMetrics = (metrics) => ({
  fn: metrics.falseNegativeCount,
  fp: metrics.falsePositiveCount,
  precision: metrics.precision,
  recall: metrics.recall,
  tn: metrics.trueNegativeCount,
  tp: metrics.truePositiveCount,
  unsupported: metrics.unsupportedCount,
});

const abbreviatedMetricsMatch = (actual, expected) =>
  ['tp', 'fp', 'tn', 'fn', 'unsupported', 'precision', 'recall'].every((field) =>
    Object.is(actual[field], expected[field]),
  );

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const toCsv = (rows) => `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;

const buildMetricsCsv = (metrics, expectedMatched) =>
  toCsv([
    [
      'rule_id',
      'true_positives',
      'false_positives',
      'true_negatives',
      'false_negatives',
      'precision',
      'recall',
      'unsupported',
      'unsupported_detected',
      'unmatched_findings',
      'notes',
      'corrective_action',
    ],
    ...metrics.map((row) => [
      row.ruleId,
      row.truePositiveCount,
      row.falsePositiveCount,
      row.trueNegativeCount,
      row.falseNegativeCount,
      row.precision === null ? null : row.precision.toFixed(6),
      row.recall === null ? null : row.recall.toFixed(6),
      row.unsupportedCount,
      row.unsupportedDetectedCount,
      row.unmatchedFindingCount,
      'Controlled instance-level static cases; unsupported cases are excluded from denominators.',
      expectedMatched
        ? 'None; observed findings matched the reviewed ground truth.'
        : 'Review the retained case and metric mismatches before changing implementation or ground truth.',
    ]),
  ]);

const buildCasesCsv = (observations) =>
  toCsv([
    [
      'project_id',
      'rule_id',
      'case_id',
      'classification',
      'detected',
      'expected_detected',
      'outcome',
      'matched_finding_count',
      'rationale',
    ],
    ...observations.map((observation) => [
      observation.projectId,
      observation.ruleId,
      observation.caseId,
      observation.classification,
      observation.detected,
      observation.expectedDetected,
      observation.outcome,
      observation.matchedFindings.length,
      observation.rationale,
    ]),
  ]);

const assertPortable = (content, volatilePaths, label) => {
  assert.equal(content.includes('\r'), false, `${label} must use LF.`);
  assert.equal(content.isWellFormed(), true, `${label} must use well-formed Unicode.`);

  for (const volatilePath of volatilePaths) {
    assert.equal(content.includes(volatilePath), false, `${label} retained a volatile path.`);
  }
};

const writeOutputs = async ({
  artifacts,
  casesCsv,
  groundTruthContent,
  metricsCsv,
  outputDirectory,
  temporaryRoot,
}) => {
  if (outputDirectory === undefined) {
    return;
  }

  await mkdir(outputDirectory, { recursive: true });

  for (const [fileName, value] of Object.entries(artifacts)) {
    const content = await toCanonicalJson(value);
    assertPortable(content, [repositoryRoot, temporaryRoot], fileName);
    await writeFile(path.join(outputDirectory, fileName), content, 'utf8');
  }

  assertPortable(groundTruthContent, [repositoryRoot, temporaryRoot], 'accuracy ground truth');
  assertPortable(metricsCsv, [repositoryRoot, temporaryRoot], 'accuracy metrics CSV');
  assertPortable(casesCsv, [repositoryRoot, temporaryRoot], 'accuracy cases CSV');
  await writeFile(
    path.join(outputDirectory, 'accuracy-ground-truth.json'),
    groundTruthContent,
    'utf8',
  );
  await writeFile(path.join(outputDirectory, 'accuracy-by-rule.csv'), metricsCsv, 'utf8');
  await writeFile(path.join(outputDirectory, 'accuracy-cases.csv'), casesCsv, 'utf8');
};

const outputDirectory = parseOutputDirectory(process.argv.slice(2));
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'uxaudit-m06-accuracy-'));

try {
  const [{ content: groundTruthContent, value: groundTruth }, { value: manifest }] =
    await Promise.all([
      readCanonicalJson(groundTruthPath, 'M06 accuracy ground truth'),
      readCanonicalJson(manifestPath, 'M06 controlled-project manifest'),
    ]);

  assert.equal(groundTruth.schemaVersion, schemaVersion);
  assert.equal(groundTruth.groundTruthId, 'M06-RULE-ACCURACY-GROUND-TRUTH');
  assert.deepEqual(groundTruth.stableRuleIds, manifest.stableRuleIds);

  const projectRuns = new Map();

  for (const projectId of groundTruth.committedProjectIds) {
    const definition = manifest.committedProjects[projectId];
    assert.ok(definition, `Unknown ground-truth project: ${projectId}`);
    projectRuns.set(projectId, await runProject(projectId, definition, temporaryRoot));
  }

  const nodesByProjectAndCase = buildCaseNodeIndex(projectRuns, groundTruth);
  const matched = matchFindings(projectRuns, groundTruth, nodesByProjectAndCase);
  const unmatchedFindingsByRule = Object.fromEntries(
    groundTruth.stableRuleIds.map((ruleId) => [
      ruleId,
      matched.unmatchedFindings.filter((finding) => finding.ruleId === ruleId).length,
    ]),
  );
  const metrics = calculateRuleDetectionMetrics({
    cases: matched.observations.map(({ caseId, classification, detected, ruleId }) => ({
      caseId,
      classification,
      detected,
      ruleId,
    })),
    ruleIds: groundTruth.stableRuleIds,
    unmatchedFindingsByRule,
  });
  const actualMetricsByRule = Object.fromEntries(
    metrics.map((row) => [row.ruleId, abbreviateMetrics(row)]),
  );
  const caseMismatches = matched.observations
    .filter(({ detected, expectedDetected }) => detected !== expectedDetected)
    .map(({ caseId, detected, expectedDetected, projectId, ruleId }) => ({
      caseId,
      detected,
      expectedDetected,
      projectId,
      ruleId,
    }));
  const metricMismatches = groundTruth.stableRuleIds
    .filter(
      (ruleId) =>
        !abbreviatedMetricsMatch(
          actualMetricsByRule[ruleId],
          groundTruth.expectedMetricsByRule[ruleId],
        ),
    )
    .map((ruleId) => ({
      actual: actualMetricsByRule[ruleId],
      expected: groundTruth.expectedMetricsByRule[ruleId],
      ruleId,
    }));
  const unsupportedDetectedCount = metrics.reduce(
    (total, row) => total + row.unsupportedDetectedCount,
    0,
  );
  const expectedMatched =
    caseMismatches.length === 0 &&
    metricMismatches.length === 0 &&
    matched.unmatchedFindings.length === 0 &&
    unsupportedDetectedCount === 0;

  const results = {
    caseCounts: {
      negative: matched.observations.filter(({ classification }) => classification === 'negative')
        .length,
      positive: matched.observations.filter(({ classification }) => classification === 'positive')
        .length,
      unsupported: matched.observations.filter(
        ({ classification }) => classification === 'unsupported',
      ).length,
    },
    expectedMatched,
    findingIdentities: matched.findingIdentities,
    instanceObservations: matched.observations,
    metrics,
    projects: [...projectRuns.values()].map(({ summary }) => summary),
    scenarioId,
    schemaVersion,
    unmatchedFindings: matched.unmatchedFindings,
  };
  const comparison = {
    caseMismatches,
    expectedMatched,
    expectedMetricsByRule: groundTruth.expectedMetricsByRule,
    groundTruthDigest: digest(groundTruthContent),
    metricMismatches,
    observedMetricsByRule: actualMetricsByRule,
    scenarioId,
    schemaVersion,
    unmatchedFindingCount: matched.unmatchedFindings.length,
    unsupportedDetectedCount,
  };
  const metricsCsv = buildMetricsCsv(metrics, expectedMatched);
  const casesCsv = buildCasesCsv(matched.observations);

  await writeOutputs({
    artifacts: {
      'accuracy-comparison.json': comparison,
      'accuracy-results.json': results,
      'accuracy-unsupported.json': {
        cases: matched.observations.filter(
          ({ classification }) => classification === 'unsupported',
        ),
        detectedCount: unsupportedDetectedCount,
        policy: groundTruth.contract.unsupportedMetricPolicy,
        scenarioId,
        schemaVersion,
      },
    },
    casesCsv,
    groundTruthContent,
    metricsCsv,
    outputDirectory,
    temporaryRoot,
  });

  assert.equal(expectedMatched, true, 'Observed rule accuracy differs from reviewed ground truth.');

  process.stdout.write(
    await toCanonicalJson({
      cases: results.caseCounts,
      expectedMatched,
      falseNegatives: metrics.reduce((total, row) => total + row.falseNegativeCount, 0),
      falsePositives: metrics.reduce((total, row) => total + row.falsePositiveCount, 0),
      rules: metrics.length,
      scenarioId,
      unsupportedDetected: unsupportedDetectedCount,
    }),
  );
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';

import { format } from 'prettier';

const schemaVersion = 1;
const reviewId = 'M06-EXPERT-HEURISTIC-REVIEW';
const repositoryRoot = process.cwd();
const fixtureRoot = path.join(repositoryRoot, 'fixtures', 'm06-validation');
const contractPath = path.join(fixtureRoot, 'heuristic-review.json');
const cliPath = path.join(repositoryRoot, 'dist', 'cli', 'index.js');
const expectedTaskIds = [
  'discover-scan',
  'analyze-project',
  'identify-highest-priority',
  'locate-source',
  'understand-recommendation',
  'find-json-html-reports',
];
const severityPriority = {
  critical: 4,
  high: 3,
  info: 0,
  low: 1,
  medium: 2,
};
const jsonFormatOptions = {
  endOfLine: 'lf',
  parser: 'json',
  printWidth: 100,
};

const toCanonicalJson = (value) => format(JSON.stringify(value, null, 2), jsonFormatOptions);

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

const readContract = async () => {
  const text = await readFile(contractPath, 'utf8');
  const contract = JSON.parse(text);

  assert.equal(text, await toCanonicalJson(contract), 'The heuristic contract is not canonical.');
  assert.equal(contract.schemaVersion, schemaVersion);
  assert.equal(contract.reviewId, reviewId);
  assert.equal(contract.method.kind, 'expert-heuristic-review');
  assert.equal(contract.method.participantTestingStatus, 'unexecuted');
  assert.equal(contract.method.participantCount, 0);
  assert.equal(contract.method.susStatus, 'not-applicable');
  assert.equal(contract.method.susScore, null);
  assert.deepEqual(
    contract.tasks.map(({ id }) => id),
    expectedTaskIds,
  );

  return contract;
};

const measureTask = async (task, helpUsed, operation) => {
  const startedAt = performance.now();
  const evidence = await operation();
  const completedAt = performance.now();

  return {
    backtrackingCount: 0,
    completed: true,
    correctiveAction: task.review.correctiveAction,
    errors: [],
    evidence,
    expertProcedureDurationMs: Math.round((completedAt - startedAt) * 1000) / 1000,
    helpUsed,
    id: task.id,
    objective: task.objective,
    observation: task.review.observation,
    order: task.order,
    severity: task.review.severity,
  };
};

const writeCsv = async (filePath, tasks) => {
  const fields = [
    'order',
    'id',
    'completed',
    'expertProcedureDurationMs',
    'errors',
    'backtrackingCount',
    'helpUsed',
    'severity',
    'observation',
    'correctiveAction',
  ];
  const escapeCell = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = tasks.map((task) => ({
    ...task,
    errors: task.errors.join(' | '),
  }));
  const lines = [
    fields.map(escapeCell).join(','),
    ...rows.map((row) => fields.map((field) => escapeCell(row[field])).join(',')),
    '',
  ];

  await writeFile(filePath, lines.join('\n'), 'utf8');
};

const writeArtifacts = async (outputDirectory, review, status, temporaryRoot) => {
  if (outputDirectory === undefined) {
    return;
  }

  await mkdir(outputDirectory, { recursive: true });
  const reviewText = await toCanonicalJson(review);
  const statusText = await toCanonicalJson(status);

  for (const [label, content] of [
    ['heuristic-review.json', reviewText],
    ['usability-status.json', statusText],
  ]) {
    assert.equal(content.includes(repositoryRoot), false, `${label} retained repository root.`);
    assert.equal(content.includes(temporaryRoot), false, `${label} retained temporary root.`);
    await writeFile(path.join(outputDirectory, label), content, 'utf8');
  }

  await writeCsv(path.join(outputDirectory, 'heuristic-review.csv'), review.tasks);
};

const main = async () => {
  const outputDirectory = parseOutputDirectory(process.argv.slice(2));
  const contract = await readContract();

  assert.equal(await pathExists(cliPath), true, 'Build the CLI before running the review.');
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'uxaudit-m06-usability-'));

  try {
    const projectRoot = path.join(temporaryRoot, contract.controlledProject.projectId);

    await cp(path.join(fixtureRoot, contract.controlledProject.directory), projectRoot, {
      errorOnExist: true,
      force: false,
      recursive: true,
    });

    const tasksById = new Map(contract.tasks.map((task) => [task.id, task]));
    const requireTask = (id) => {
      const task = tasksById.get(id);

      assert.ok(task, `Missing heuristic task: ${id}`);
      return task;
    };
    const taskResults = [];
    let scanExecution;
    let report;
    let selectedFinding;

    taskResults.push(
      await measureTask(requireTask('discover-scan'), true, async () => {
        const [rootHelp, scanHelp] = await Promise.all([
          executeCli(['--help']),
          executeCli(['scan', '--help']),
        ]);
        const expected = requireTask('discover-scan').expected;

        assert.equal(rootHelp.signal, null);
        assert.equal(scanHelp.signal, null);
        assert.equal(rootHelp.exitCode, 0);
        assert.equal(scanHelp.exitCode, 0);
        assert.equal(rootHelp.stderr, '');
        assert.equal(scanHelp.stderr, '');
        assert.equal(rootHelp.stdout.includes(expected.rootHelpFragment), true);
        assert.equal(scanHelp.stdout.includes(expected.scanHelpFragment), true);

        return {
          requiredProjectPathVisible: true,
          rootHelpExposesScan: true,
          scanHelpExposesReportOptions: ['--format <format>', '--output <directory>'].every(
            (fragment) => scanHelp.stdout.includes(fragment),
          ),
        };
      }),
    );

    taskResults.push(
      await measureTask(requireTask('analyze-project'), false, async () => {
        const expected = requireTask('analyze-project').expected;

        scanExecution = await executeCli([
          'scan',
          projectRoot,
          '--format',
          'all',
          '--output',
          contract.controlledProject.reportDirectory,
          '--no-color',
          '--verbose',
        ]);
        assert.equal(scanExecution.signal, null);
        assert.equal(scanExecution.exitCode, expected.exitCode);
        assert.equal(scanExecution.stderr, '');
        const jsonText = await readFile(
          path.join(projectRoot, contract.controlledProject.jsonReportPath),
          'utf8',
        );

        report = JSON.parse(jsonText);
        assert.equal(report.summary.findings.total, expected.findingCount);
        assert.equal(report.summary.files.selected, expected.selectedFileCount);
        assert.equal(report.summary.files.failed, expected.failedFileCount);
        assert.equal(await pathExists(path.join(projectRoot, 'TARGET_SOURCE_EXECUTED')), false);
        assert.equal(
          await pathExists(path.join(projectRoot, 'TARGET_PACKAGE_SCRIPT_EXECUTED')),
          false,
        );

        return {
          exitCode: scanExecution.exitCode,
          failedFileCount: report.summary.files.failed,
          findingCount: report.summary.findings.total,
          progressLinesPresent: [
            'Project path validated:',
            'Discovery summary:',
            'Parsing summary:',
          ].every((fragment) => scanExecution.stdout.includes(fragment)),
          selectedFileCount: report.summary.files.selected,
        };
      }),
    );

    taskResults.push(
      await measureTask(requireTask('identify-highest-priority'), false, async () => {
        assert.ok(report, 'The audit report is unavailable.');
        const expected = requireTask('identify-highest-priority').expected;
        const maximumPriority = Math.max(
          ...report.findings.map(({ severity }) => severityPriority[severity]),
        );
        const highestFindings = report.findings.filter(
          ({ severity }) => severityPriority[severity] === maximumPriority,
        );
        const tiedRuleIds = highestFindings.map(({ ruleId }) => ruleId);

        assert.equal(highestFindings[0]?.severity, expected.maximumSeverity);
        assert.deepEqual(tiedRuleIds, expected.tiedRuleIds);
        selectedFinding = highestFindings.find(({ ruleId }) => ruleId === expected.selectedRuleId);
        assert.ok(selectedFinding, 'The reviewed highest-priority finding is unavailable.');

        return {
          maximumSeverity: expected.maximumSeverity,
          selectedRuleId: selectedFinding.ruleId,
          tiedFindingCount: highestFindings.length,
          tiedRuleIds,
        };
      }),
    );

    taskResults.push(
      await measureTask(requireTask('locate-source'), false, async () => {
        assert.ok(selectedFinding, 'The selected finding is unavailable.');
        const expected = requireTask('locate-source').expected;
        const location = selectedFinding.location;

        assert.ok(location, 'The selected finding has no location.');
        assert.equal(selectedFinding.ruleId, expected.ruleId);
        assert.equal(location.filePath, expected.filePath);
        assert.equal(location.start.line, expected.line);
        const source = await readFile(path.join(projectRoot, location.filePath), 'utf8');
        const sourceLine = source.split('\n')[location.start.line - 1];

        assert.ok(sourceLine?.includes(expected.sourceFragment));

        return {
          displayColumn: location.start.column + 1,
          filePath: location.filePath,
          line: location.start.line,
          sourceFragmentMatched: true,
        };
      }),
    );

    taskResults.push(
      await measureTask(requireTask('understand-recommendation'), false, async () => {
        assert.ok(selectedFinding, 'The selected finding is unavailable.');
        const expected = requireTask('understand-recommendation').expected;

        assert.equal(selectedFinding.ruleId, expected.ruleId);
        assert.equal(selectedFinding.message, expected.message);
        assert.equal(selectedFinding.recommendation, expected.recommendation);
        assert.ok(selectedFinding.explanation.length > 0);
        assert.ok(selectedFinding.limitations.length > 0);

        return {
          explanationPresent: true,
          limitationCount: selectedFinding.limitations.length,
          messageMatched: true,
          recommendationMatched: true,
          ruleId: selectedFinding.ruleId,
        };
      }),
    );

    taskResults.push(
      await measureTask(requireTask('find-json-html-reports'), false, async () => {
        assert.ok(scanExecution, 'The scan execution is unavailable.');
        const expected = requireTask('find-json-html-reports').expected;
        const [jsonText, htmlText] = await Promise.all([
          readFile(path.join(projectRoot, contract.controlledProject.jsonReportPath), 'utf8'),
          readFile(path.join(projectRoot, contract.controlledProject.htmlReportPath), 'utf8'),
        ]);
        const parsed = JSON.parse(jsonText);

        assert.equal(scanExecution.stdout.includes(`${expected.jsonClaim}\n`), true);
        assert.equal(scanExecution.stdout.includes(`${expected.htmlClaim}\n`), true);
        assert.equal(
          parsed.summary.findings.total,
          contract.controlledProject.expectedFindingCount,
        );
        assert.equal(htmlText.includes('<!doctype html>'), true);
        assert.equal(htmlText.includes('id="high-findings"'), true);

        return {
          htmlClaimMatched: true,
          htmlReportOpened: true,
          htmlReportPath: contract.controlledProject.htmlReportPath,
          jsonClaimMatched: true,
          jsonReportOpened: true,
          jsonReportPath: contract.controlledProject.jsonReportPath,
        };
      }),
    );

    assert.deepEqual(
      taskResults.map(({ id }) => id),
      expectedTaskIds,
    );
    assert.equal(
      taskResults.every(({ completed }) => completed),
      true,
    );
    const executedAt = new Date().toISOString();
    const severityCounts = Object.fromEntries(
      contract.severityVocabulary.map((severity) => [
        severity,
        taskResults.filter((task) => task.severity === severity).length,
      ]),
    );
    const review = {
      executedAt,
      method: contract.method,
      reviewId,
      schemaVersion,
      summary: {
        completedTaskCount: taskResults.filter(({ completed }) => completed).length,
        severityCounts,
        taskCount: taskResults.length,
      },
      tasks: taskResults,
    };
    const status = {
      expertHeuristicReview: {
        completedTaskCount: taskResults.length,
        status: 'executed',
        timingInterpretation: contract.method.timingInterpretation,
      },
      participantTesting: {
        participantCount: 0,
        reason: contract.method.participantReason,
        status: 'unexecuted',
      },
      reviewId,
      schemaVersion,
      sus: {
        reason: 'SUS requires responses from real participants; no responses were collected.',
        responseCount: 0,
        score: null,
        status: 'not-applicable',
      },
    };

    await writeArtifacts(outputDirectory, review, status, temporaryRoot);
    process.stdout.write(
      await toCanonicalJson({
        completedTasks: taskResults.length,
        participantTesting: status.participantTesting.status,
        reviewId,
        severityCounts,
        sus: status.sus.status,
      }),
    );
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
};

await main();

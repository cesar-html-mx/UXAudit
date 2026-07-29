import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { analyzeProject } from '../dist/application/analyze-project.js';
import { scanProject } from '../dist/application/scan-project.js';
import { runCli } from '../dist/cli/run-cli.js';

const repositoryRoot = process.cwd();
const fixtureDirectory = path.join(repositoryRoot, 'tests', 'fixtures', 'm03-parsing');
const manifestPath = path.join(fixtureDirectory, 'manifest.json');
const expectedPath = path.join(fixtureDirectory, 'expected-controlled-analysis.json');
const argumentsList = process.argv.slice(2);
const outputIndex = argumentsList.indexOf('--output');
const outputDirectory =
  outputIndex >= 0 && argumentsList[outputIndex + 1]
    ? path.resolve(argumentsList[outputIndex + 1])
    : undefined;
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'uxaudit-m03-scenario-'));
const projectRoot = path.join(temporaryRoot, 'project');
const sourceRoot = path.join(projectRoot, 'src');
const sentinelPath = path.join(sourceRoot, 'TARGET_CODE_EXECUTED');
const expectedSourceKinds = ['javascript', 'javascript-jsx', 'typescript', 'typescript-jsx'];
const malformedPath = 'src/malformed.tsx';
const sampleFilePath = 'src/jsx-shapes.tsx';
const toJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const digest = (content) => `sha256:${createHash('sha256').update(content).digest('hex')}`;

const readFixtureManifest = async () => {
  const value = JSON.parse(await readFile(manifestPath, 'utf8'));

  assert.equal(value.schemaVersion, 1);
  assert.ok(Array.isArray(value.fixtures));

  return value;
};

const createControlledProject = async (manifest) => {
  await mkdir(sourceRoot, { recursive: true });
  await Promise.all(
    manifest.fixtures.map(({ file, logicalName }) =>
      copyFile(path.join(fixtureDirectory, file), path.join(sourceRoot, logicalName)),
    ),
  );
};

const targetCodeExecuted = async () =>
  access(sentinelPath)
    .then(() => true)
    .catch(() => false);

const projectPosition = ({ column, line, offset }) =>
  `${String(line)}:${String(column)}@${String(offset)}`;

const projectRange = ({ end, start }) => ({
  end: projectPosition(end),
  start: projectPosition(start),
});

const projectModelOverview = (model) => ({
  components: model.components.map(({ jsxNodeIds, kind, location, name, rootJsxNodeIds }) => ({
    filePath: location.filePath,
    jsxNodeCount: jsxNodeIds.length,
    kind,
    location: projectRange(location),
    name,
    rootJsxNodeCount: rootJsxNodeIds.length,
  })),
  files: model.files.map(({ componentIds, filePath, jsxNodeIds, language, location, usesJsx }) => ({
    componentCount: componentIds.length,
    filePath,
    jsxNodeCount: jsxNodeIds.length,
    language,
    location: projectRange(location),
    usesJsx,
  })),
  jsxNodes: model.jsxNodes.map((node) => ({
    childNodeCount: node.childNodeIds.length,
    elementKind: node.kind === 'element' ? node.elementKind : undefined,
    filePath: node.location.filePath,
    kind: node.kind,
    location: projectRange(node.location),
    name: node.kind === 'element' ? node.name : undefined,
    nested: node.parentNodeId !== null,
    ownedByComponent: node.componentId !== null,
    textContent: node.textContent,
  })),
});

const projectValue = (value) => {
  if (value.kind !== 'object') {
    return value;
  }

  return {
    confidence: value.confidence,
    hasUnknownProperties: value.hasUnknownProperties,
    kind: value.kind,
    properties: value.properties.map(({ name, value: propertyValue }) => ({
      name,
      value: projectValue(propertyValue),
    })),
  };
};

const selectReviewedModelSample = (model) => ({
  component: model.components
    .filter(({ location }) => location.filePath === sampleFilePath)
    .map(({ kind, name, rootJsxNodeIds }) => ({
      kind,
      name,
      rootJsxNodeCount: rootJsxNodeIds.length,
    })),
  jsxNodes: model.jsxNodes
    .filter(({ location }) => location.filePath === sampleFilePath)
    .map((node) => ({
      attributes:
        node.kind === 'element'
          ? node.attributes.map((attribute) =>
              attribute.kind === 'spread'
                ? { kind: attribute.kind }
                : {
                    kind: attribute.kind,
                    name: attribute.name,
                    value: projectValue(attribute.value),
                  },
            )
          : undefined,
      elementKind: node.kind === 'element' ? node.elementKind : undefined,
      kind: node.kind,
      location: projectRange(node.location),
      name: node.kind === 'element' ? node.name : undefined,
      textContent: node.textContent,
    })),
});

const selectModelSample = (model) => ({
  components: model.components.filter(({ location }) => location.filePath === sampleFilePath),
  files: model.files.filter(({ filePath }) => filePath === sampleFilePath),
  jsxNodes: model.jsxNodes.filter(({ location }) => location.filePath === sampleFilePath),
});

const selectLocationSample = (result) => ({
  components: result.model.components.map(({ id, location, name }) => ({
    id,
    location,
    name,
  })),
  files: result.model.files.map(({ filePath, location }) => ({
    filePath,
    location,
  })),
  jsxNodes: result.model.jsxNodes.map(({ id, location }) => ({
    id,
    location,
  })),
  parserErrors: result.parserErrors.map(({ filePath, position }) => ({
    filePath,
    position,
  })),
});

const memoryProjection = (memory) => ({
  arrayBuffersBytes: memory.arrayBuffers,
  externalBytes: memory.external,
  heapUsedBytes: memory.heapUsed,
  rssBytes: memory.rss,
});

const subtractMemory = (after, before) => ({
  arrayBuffersBytes: after.arrayBuffers - before.arrayBuffers,
  externalBytes: after.external - before.external,
  heapUsedBytes: after.heapUsed - before.heapUsed,
  rssBytes: after.rss - before.rss,
});

const measureAnalysis = async () => {
  const memoryBefore = process.memoryUsage();
  const startedAt = process.hrtime.bigint();
  const result = await analyzeProject({ projectPath: projectRoot });
  const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
  const memoryAfter = process.memoryUsage();

  return {
    measurement: {
      elapsedMilliseconds: Math.round((Number(elapsedNanoseconds) / 1_000_000) * 1_000) / 1_000,
      memoryAfter: memoryProjection(memoryAfter),
      memoryBefore: memoryProjection(memoryBefore),
      memoryDelta: subtractMemory(memoryAfter, memoryBefore),
    },
    result,
  };
};

const captureCliSummary = async (canonicalProjectRoot) => {
  const stderr = [];
  const stdout = [];
  const exitCode = await runCli(['scan', projectRoot], {
    analyzeProject,
    io: {
      writeErr: (value) => stderr.push(value),
      writeOut: (value) => stdout.push(value),
    },
    scanProject,
  });
  const normalizedStdout = stdout.join('').replaceAll(canonicalProjectRoot, '<PROJECT_ROOT>');
  const outputLines = normalizedStdout.trimEnd().split('\n');

  assert.equal(exitCode, 0);
  assert.equal(stderr.join(''), '');
  assert.equal(outputLines.length, 3);
  assert.match(outputLines[0] ?? '', /^Project path validated: <PROJECT_ROOT>$/u);
  assert.match(outputLines[1] ?? '', /^Discovery summary:/u);
  assert.match(outputLines[2] ?? '', /^Parsing summary:/u);

  return {
    exitCode,
    stderr: '(empty)',
    stdout: normalizedStdout,
  };
};

const assertScenarioInvariants = (result, manifest) => {
  const actualSourceKinds = [
    ...new Set(result.sourceCandidates.map(({ sourceKind }) => sourceKind)),
  ].toSorted();
  const expectedModeledFiles = manifest.fixtures
    .map(({ logicalName }) => `src/${logicalName}`)
    .filter((filePath) => filePath !== malformedPath)
    .toSorted();

  assert.deepEqual(actualSourceKinds, expectedSourceKinds);
  assert.equal(result.parserErrors.length, 1);
  assert.equal(result.parserErrors[0]?.filePath, malformedPath);
  assert.equal(result.parserErrors[0]?.code, 'SOURCE_PARSE_FAILED');
  assert.ok(result.parserErrors[0]?.position);
  assert.deepEqual(
    result.model.files.map(({ filePath }) => filePath),
    expectedModeledFiles,
  );
  assert.ok(result.model.components.length > 0);
  assert.ok(result.model.jsxNodes.length > 0);
  assert.ok(
    result.model.jsxNodes.every(
      ({ location }) =>
        location.start.offset < location.end.offset &&
        location.start.line >= 1 &&
        location.end.line >= location.start.line,
    ),
  );
};

const createScenarioSnapshot = async (result, manifest, cliSummary) => {
  const modeledFilePaths = result.model.files.map(({ filePath }) => filePath);
  const sourceKinds = [
    ...new Set(result.sourceCandidates.map(({ sourceKind }) => sourceKind)),
  ].toSorted();

  return {
    fixture: {
      files: manifest.fixtures.map(({ logicalName, sourceKind }) => ({
        logicalName: `src/${logicalName}`,
        sourceKind,
      })),
      malformedFile: malformedPath,
      targetExecutionSentinel: 'src/TARGET_CODE_EXECUTED',
    },
    sourceCandidates: result.sourceCandidates.map(({ extension, relativePath, sourceKind }) => ({
      extension,
      relativePath,
      sourceKind,
    })),
    parsingSummary: result.parsingSummary,
    parserErrors: result.parserErrors,
    model: projectModelOverview(result.model),
    reviewedModelSample: selectReviewedModelSample(result.model),
    checks: {
      fourSourceKinds: sourceKinds.map((sourceKind) => ({ sourceKind })),
      malformedFileIsolated:
        result.parserErrors.some(({ filePath }) => filePath === malformedPath) &&
        !modeledFilePaths.includes(malformedPath),
      modeledSiblingFiles: modeledFilePaths,
      sourceLocationsRetained:
        result.model.files.length > 0 &&
        result.model.components.length > 0 &&
        result.model.jsxNodes.length > 0,
      targetCodeExecuted: await targetCodeExecuted(),
    },
    cli: cliSummary,
  };
};

const writeEvidenceOutputs = async ({
  cliSummary,
  expectedJson,
  firstJson,
  firstResult,
  firstMeasurement,
  secondJson,
  secondMeasurement,
}) => {
  if (outputDirectory === undefined) {
    return;
  }

  await mkdir(outputDirectory, { recursive: true });
  const comparison = {
    byteIdenticalAcrossRuns: firstJson === secondJson,
    expectedMatchesActual: firstJson === expectedJson,
    expected: digest(expectedJson),
    run1: digest(firstJson),
    run2: digest(secondJson),
  };
  const performanceBaseline = {
    interpretation:
      'Informational wall-clock and process-memory observations; no machine-dependent pass threshold is applied.',
    runtime: {
      architecture: process.arch,
      node: process.versions.node,
      platform: process.platform,
    },
    runs: [firstMeasurement, secondMeasurement],
  };

  await Promise.all([
    writeFile(path.join(outputDirectory, 'cli-summary.json'), toJson(cliSummary), 'utf8'),
    writeFile(
      path.join(outputDirectory, 'deterministic-comparison.json'),
      toJson(comparison),
      'utf8',
    ),
    writeFile(
      path.join(outputDirectory, 'location-sample.json'),
      toJson(selectLocationSample(firstResult)),
      'utf8',
    ),
    writeFile(
      path.join(outputDirectory, 'model-sample.json'),
      toJson(selectModelSample(firstResult.model)),
      'utf8',
    ),
    writeFile(
      path.join(outputDirectory, 'performance-baseline.json'),
      toJson(performanceBaseline),
      'utf8',
    ),
    writeFile(path.join(outputDirectory, 'scenario-actual.json'), firstJson, 'utf8'),
    writeFile(path.join(outputDirectory, 'scenario-expected.json'), expectedJson, 'utf8'),
  ]);
};

try {
  const manifest = await readFixtureManifest();
  await createControlledProject(manifest);
  const canonicalProjectRoot = await realpath(projectRoot);
  const first = await measureAnalysis();
  assertScenarioInvariants(first.result, manifest);
  assert.equal(await targetCodeExecuted(), false);
  const second = await measureAnalysis();
  assertScenarioInvariants(second.result, manifest);
  assert.equal(await targetCodeExecuted(), false);
  const cliSummary = await captureCliSummary(canonicalProjectRoot);
  assert.equal(await targetCodeExecuted(), false);

  const firstSnapshot = await createScenarioSnapshot(first.result, manifest, cliSummary);
  const secondSnapshot = await createScenarioSnapshot(second.result, manifest, cliSummary);
  const firstJson = toJson(firstSnapshot);
  const secondJson = toJson(secondSnapshot);
  const expectedJson = await readFile(expectedPath, 'utf8');

  assert.equal(
    firstJson.includes(canonicalProjectRoot),
    false,
    'The canonical temporary root must not enter deterministic output.',
  );
  assert.equal(firstJson, secondJson, 'Repeated analysis output must be byte-identical.');

  await writeEvidenceOutputs({
    cliSummary,
    expectedJson,
    firstJson,
    firstMeasurement: first.measurement,
    firstResult: first.result,
    secondJson,
    secondMeasurement: second.measurement,
  });

  assert.equal(firstJson, expectedJson, 'Scenario output must match the reviewed expectation.');

  console.log('M03 controlled parsing and model scenario: PASS');
  console.log(
    `Parsing: parsed=${String(first.result.parsingSummary.parsedFiles)} failed=${String(first.result.parsingSummary.failedFiles)} components=${String(first.result.parsingSummary.components)} jsx=${String(first.result.parsingSummary.jsxNodes)}`,
  );
  console.log('Source kinds: javascript, javascript-jsx, typescript, typescript-jsx');
  console.log('Determinism: byte-identical across two analysis runs');
  console.log('Malformed source isolated: yes; target project code executed: no');
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}

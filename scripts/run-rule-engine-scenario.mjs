import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { format } from 'prettier';

import { analyzeProject } from '../dist/application/analyze-project.js';
import { evaluateRules } from '../dist/rules/evaluate-rules.js';
import { initialRuleRegistry } from '../dist/rules/initial-rule-registry.js';
import { loadRules } from '../dist/rules/load-rules.js';
import { createRuleRegistry } from '../dist/rules/rule-registry.js';

const schemaVersion = 1;
const scenarioId = 'UXAUDIT-RULE-CATALOG';
const repositoryRoot = process.cwd();
const fixtureDirectory = path.join(repositoryRoot, 'tests', 'fixtures', 'rule-catalog');
const sourceFixturePath = path.join(fixtureDirectory, 'catalog-cases.tsx.fixture');
const expectedFixturePath = path.join(fixtureDirectory, 'expected-catalog-result.json');
const sourceFilePath = 'src/catalog-cases.tsx';
const expectedRuleIds = [
  'accessibility/button-name',
  'accessibility/img-alt',
  'accessibility/input-label',
  'performance/img-dimensions',
  'performance/img-lazy-loading',
  'seo/ambiguous-link-text',
  'seo/multiple-h1',
  'ux/small-inline-text',
];
const ruleCaseDefinitions = [
  {
    positiveCase: 'button-missing-name',
    ruleId: 'accessibility/button-name',
    safeCases: ['button-static-name'],
    unsupportedCases: ['button-dynamic-unsupported'],
  },
  {
    positiveCase: 'img-missing-alt',
    ruleId: 'accessibility/img-alt',
    safeCases: ['img-complete'],
    unsupportedCases: ['img-spread-unsupported', 'custom-image-unsupported'],
  },
  {
    positiveCase: 'input-missing-label',
    ruleId: 'accessibility/input-label',
    safeCases: ['input-nested-label'],
    unsupportedCases: ['input-spread-unsupported'],
  },
  {
    positiveCase: 'img-invalid-dimensions',
    ruleId: 'performance/img-dimensions',
    safeCases: ['img-complete'],
    unsupportedCases: ['img-spread-unsupported', 'custom-image-unsupported'],
  },
  {
    positiveCase: 'img-not-lazy',
    ruleId: 'performance/img-lazy-loading',
    safeCases: ['img-complete'],
    unsupportedCases: ['img-spread-unsupported', 'custom-image-unsupported'],
  },
  {
    positiveCase: 'link-ambiguous-text',
    ruleId: 'seo/ambiguous-link-text',
    safeCases: ['link-specific-text'],
    unsupportedCases: ['link-dynamic-unsupported'],
  },
  {
    positiveCase: 'h1-secondary',
    ruleId: 'seo/multiple-h1',
    safeCases: ['h1-single-safe'],
    unsupportedCases: ['custom-heading-unsupported'],
  },
  {
    positiveCase: 'text-too-small',
    ruleId: 'ux/small-inline-text',
    safeCases: ['text-threshold'],
    unsupportedCases: ['text-dynamic-size-unsupported'],
  },
];
const throwingRule = {
  evaluate: () => {
    throw new Error('RULE_CATALOG_SCENARIO_PRIVATE_RULE_FAILURE');
  },
  metadata: {
    category: 'ux',
    defaultSeverity: 'medium',
    explanation: 'Controlled rule used only to verify evaluation failure isolation.',
    id: 'ux/scenario-throwing-rule',
    limitations: ['This rule exists only inside the controlled rule-catalog scenario.'],
    recommendation: 'Keep rule execution failures isolated from sibling findings.',
    reference: null,
    status: 'stable',
    title: 'Controlled throwing rule',
  },
};
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
    'Only the optional --output <dir> argument is supported.',
  );
  assert.equal(argumentsList.length, 2, '--output requires exactly one directory.');
  assert.ok(argumentsList[1]?.trim(), '--output requires a non-empty directory.');

  return path.resolve(argumentsList[1]);
};

const targetCodeExecuted = async (sentinelPath) => {
  try {
    await access(sentinelPath);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
};

const createControlledProject = async (sourceRoot) => {
  await mkdir(sourceRoot, { recursive: true });
  await copyFile(sourceFixturePath, path.join(sourceRoot, 'catalog-cases.tsx'));
};

const analyzeAndEvaluate = async (projectRoot) => {
  const analysis = await analyzeProject({ projectPath: projectRoot });
  const loadedRules = loadRules({ registry: initialRuleRegistry });
  const evaluation = evaluateRules({
    loadedRules,
    model: analysis.model,
  });

  return { analysis, evaluation };
};

const createScenarioResult = ({ analysis, evaluation, executedTargetCode }) => ({
  schemaVersion,
  scenarioId,
  analysis: {
    parsedFileCount: analysis.parsingSummary.parsedFiles,
    failedFileCount: analysis.parsingSummary.failedFiles,
    componentCount: analysis.parsingSummary.components,
    jsxNodeCount: analysis.parsingSummary.jsxNodes,
    targetCodeExecuted: executedTargetCode,
  },
  evaluation,
});

const exactCaseId = (node) => {
  if (node.kind !== 'element') {
    return undefined;
  }

  const attribute = node.attributes.find(
    (candidate) => candidate.kind === 'named' && candidate.name === 'data-case',
  );

  if (
    attribute?.kind !== 'named' ||
    attribute.value.kind !== 'literal' ||
    typeof attribute.value.value !== 'string'
  ) {
    return undefined;
  }

  return attribute.value.value;
};

const locationContains = (container, location) =>
  container.filePath === location.filePath &&
  container.start.offset <= location.start.offset &&
  container.end.offset >= location.end.offset;

const buildRuleMatrix = (model, evaluation) => {
  const nodesByCase = new Map();

  for (const node of model.jsxNodes) {
    const caseId = exactCaseId(node);

    if (caseId === undefined) {
      continue;
    }

    assert.equal(nodesByCase.has(caseId), false, `Duplicate data-case value: ${caseId}`);
    nodesByCase.set(caseId, node);
  }

  const rows = ruleCaseDefinitions.map((definition) => {
    const ruleFindings = evaluation.findings.filter(({ ruleId }) => ruleId === definition.ruleId);
    const positiveNode = nodesByCase.get(definition.positiveCase);

    assert.ok(positiveNode, `Missing positive case: ${definition.positiveCase}`);
    assert.equal(ruleFindings.length, 1, `${definition.ruleId} must emit exactly one finding.`);
    assert.ok(ruleFindings[0]?.location, `${definition.ruleId} must retain a source location.`);

    const positiveCaseMatched =
      ruleFindings[0]?.location !== null &&
      locationContains(positiveNode.location, ruleFindings[0].location);
    const casesAreClear = (caseIds) =>
      caseIds.every((caseId) => {
        const node = nodesByCase.get(caseId);

        assert.ok(node, `Missing case: ${caseId}`);

        return ruleFindings.every(
          ({ location }) => location === null || !locationContains(node.location, location),
        );
      });
    const safeCasesClear = casesAreClear(definition.safeCases);
    const unsupportedCasesClear = casesAreClear(definition.unsupportedCases);

    assert.equal(
      positiveCaseMatched,
      true,
      `${definition.ruleId} finding must match ${definition.positiveCase}.`,
    );
    assert.equal(safeCasesClear, true, `${definition.ruleId} reported a safe case.`);
    assert.equal(unsupportedCasesClear, true, `${definition.ruleId} reported an unsupported case.`);

    return {
      ruleId: definition.ruleId,
      positiveCase: definition.positiveCase,
      safeCases: definition.safeCases,
      unsupportedCases: definition.unsupportedCases,
      expectedFindingCount: 1,
      actualFindingCount: ruleFindings.length,
      positiveCaseMatched,
      safeCasesClear,
      unsupportedCasesClear,
    };
  });

  return {
    schemaVersion,
    scenarioId,
    ruleCount: rows.length,
    findingCount: evaluation.findings.length,
    rules: rows,
  };
};

const captureUnknownRuleFilterError = () => {
  try {
    loadRules({
      filters: { ruleIds: ['ux/not-in-the-catalog'] },
      registry: initialRuleRegistry,
    });
  } catch (error) {
    assert.equal(error?.name, 'RuleLoadError');
    assert.equal(error?.code, 'RULE_FILTER_UNKNOWN_ID');

    return {
      name: error.name,
      code: error.code,
      message: error.message,
    };
  }

  assert.fail('Unknown rule ID filter must fail.');
};

const buildFilterMetadata = () => {
  const filterDefinitions = [
    {
      filters: null,
      name: 'default-stable-catalog',
      request: undefined,
      ruleIds: expectedRuleIds,
    },
    {
      filters: { categories: ['accessibility'] },
      name: 'accessibility-category',
      request: { categories: ['accessibility'] },
      ruleIds: ['accessibility/button-name', 'accessibility/img-alt', 'accessibility/input-label'],
    },
    {
      filters: {
        categories: ['performance'],
        ruleIds: ['performance/img-lazy-loading', 'seo/multiple-h1'],
      },
      name: 'category-and-id-intersection',
      request: {
        categories: ['performance'],
        ruleIds: ['performance/img-lazy-loading', 'seo/multiple-h1'],
      },
      ruleIds: ['performance/img-lazy-loading'],
    },
    {
      filters: { ruleIds: ['ux/small-inline-text'] },
      name: 'explicit-rule-id',
      request: { ruleIds: ['ux/small-inline-text'] },
      ruleIds: ['ux/small-inline-text'],
    },
    {
      filters: { ruleIds: [] },
      name: 'empty-rule-id-list',
      request: { ruleIds: [] },
      ruleIds: [],
    },
  ];
  const filterCases = filterDefinitions.map(({ filters, name, request, ruleIds }) => {
    const loaded = loadRules({
      filters: request,
      registry: initialRuleRegistry,
    });
    const actualRuleIds = loaded.rules.map(({ metadata }) => metadata.id);

    assert.equal(loaded.availableRuleCount, expectedRuleIds.length);
    assert.deepEqual(actualRuleIds, ruleIds);

    return {
      name,
      filters,
      ruleIds: actualRuleIds,
    };
  });
  const metadata = initialRuleRegistry.rules.map(({ metadata: ruleMetadata }) => ruleMetadata);

  assert.equal(metadata.length, expectedRuleIds.length);
  assert.deepEqual(
    metadata.map(({ id }) => id),
    expectedRuleIds,
  );

  for (const ruleMetadata of metadata) {
    assert.equal(ruleMetadata.status, 'stable');
    assert.ok(ruleMetadata.title.length > 0);
    assert.ok(ruleMetadata.explanation.length > 0);
    assert.ok(ruleMetadata.recommendation.length > 0);
    assert.ok(ruleMetadata.limitations.length > 0);
  }

  return {
    schemaVersion,
    scenarioId,
    availableRuleCount: initialRuleRegistry.rules.length,
    metadata,
    filterCases,
    unknownRuleFilterError: captureUnknownRuleFilterError(),
  };
};

const evaluateFailureIsolation = (model, baseEvaluation) => {
  const registry = createRuleRegistry([...initialRuleRegistry.rules, throwingRule]);
  const loadedRules = loadRules({ registry });
  const evaluation = evaluateRules({ loadedRules, model });
  const baseFindingRuleIds = baseEvaluation.findings.map(({ ruleId }) => ruleId);
  const preservedFindingRuleIds = evaluation.findings.map(({ ruleId }) => ruleId);
  const findingsPreserved =
    JSON.stringify(evaluation.findings) === JSON.stringify(baseEvaluation.findings);

  assert.equal(loadedRules.availableRuleCount, expectedRuleIds.length + 1);
  assert.equal(evaluation.errors.length, 1);
  assert.deepEqual(evaluation.errors, [
    {
      category: 'ux',
      code: 'RULE_EVALUATION_FAILED',
      message: 'Rule evaluation failed.',
      recoverable: true,
      ruleId: throwingRule.metadata.id,
    },
  ]);
  assert.equal(evaluation.summary.failedRuleCount, 1);
  assert.equal(evaluation.summary.succeededRuleCount, expectedRuleIds.length);
  assert.equal(evaluation.summary.findingCount, expectedRuleIds.length);
  assert.equal(findingsPreserved, true);
  assert.deepEqual(preservedFindingRuleIds, baseFindingRuleIds);

  return {
    schemaVersion,
    scenarioId,
    injectedRule: {
      id: throwingRule.metadata.id,
      status: throwingRule.metadata.status,
    },
    summary: evaluation.summary,
    errors: evaluation.errors,
    baseFindingRuleIds,
    preservedFindingRuleIds,
    findingsPreserved,
  };
};

const assertScenarioInvariants = (run) => {
  assert.equal(run.analysis.parserErrors.length, 0);
  assert.deepEqual(
    run.analysis.model.files.map(({ filePath }) => filePath),
    [sourceFilePath],
  );
  assert.equal(run.evaluation.errors.length, 0);
  assert.equal(run.evaluation.summary.availableRuleCount, expectedRuleIds.length);
  assert.equal(run.evaluation.summary.enabledRuleCount, expectedRuleIds.length);
  assert.equal(run.evaluation.summary.executedRuleCount, expectedRuleIds.length);
  assert.equal(run.evaluation.summary.failedRuleCount, 0);
  assert.equal(run.evaluation.summary.findingCount, expectedRuleIds.length);
  assert.equal(run.evaluation.summary.succeededRuleCount, expectedRuleIds.length);
  assert.deepEqual(
    run.evaluation.findings.map(({ ruleId }) => ruleId),
    expectedRuleIds,
  );
};

const assertPortableArtifact = (content, volatilePaths) => {
  for (const volatilePath of volatilePaths) {
    assert.equal(
      content.includes(volatilePath),
      false,
      'Stable artifact must not contain an absolute or temporary path.',
    );
  }
};

const writeOutputs = async ({ artifacts, expectedJson, outputDirectory, volatilePaths }) => {
  if (outputDirectory === undefined) {
    return;
  }

  await mkdir(outputDirectory, { recursive: true });

  for (const [fileName, value] of Object.entries(artifacts)) {
    const content = await toCanonicalJson(value);
    assertPortableArtifact(content, volatilePaths);
    await writeFile(path.join(outputDirectory, fileName), content, 'utf8');
  }

  assertPortableArtifact(expectedJson, volatilePaths);
  await writeFile(path.join(outputDirectory, 'scenario-expected.json'), expectedJson, 'utf8');
};

const outputDirectory = parseOutputDirectory(process.argv.slice(2));
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'uxaudit-rule-catalog-scenario-'));
const projectRoot = path.join(temporaryRoot, 'project');
const sourceRoot = path.join(projectRoot, 'src');
const sentinelPath = path.join(sourceRoot, 'TARGET_CODE_EXECUTED');

try {
  await createControlledProject(sourceRoot);

  const firstRun = await analyzeAndEvaluate(projectRoot);
  const executedAfterFirstRun = await targetCodeExecuted(sentinelPath);
  const secondRun = await analyzeAndEvaluate(projectRoot);
  const executedAfterSecondRun = await targetCodeExecuted(sentinelPath);
  const executedTargetCode = executedAfterFirstRun || executedAfterSecondRun;

  assert.equal(executedTargetCode, false, 'Analyzed target code must never execute.');
  assertScenarioInvariants(firstRun);
  assertScenarioInvariants(secondRun);

  const firstScenario = createScenarioResult({
    ...firstRun,
    executedTargetCode,
  });
  const secondScenario = createScenarioResult({
    ...secondRun,
    executedTargetCode,
  });
  const [firstJson, secondJson] = await Promise.all([
    toCanonicalJson(firstScenario),
    toCanonicalJson(secondScenario),
  ]);
  const expectedJson = await readFile(expectedFixturePath, 'utf8');
  const parsedExpected = JSON.parse(expectedJson);

  assert.equal(
    expectedJson,
    await toCanonicalJson(parsedExpected),
    'Expected fixture must use canonical JSON.',
  );
  assert.equal(firstJson, secondJson, 'Repeated scenario output must be byte-identical.');
  assert.equal(
    firstJson,
    expectedJson,
    'Controlled scenario differs from reviewed expected output.',
  );

  const ruleMatrix = buildRuleMatrix(firstRun.analysis.model, firstRun.evaluation);
  const filterMetadata = buildFilterMetadata();
  const failureIsolation = evaluateFailureIsolation(firstRun.analysis.model, firstRun.evaluation);
  const deterministicComparison = {
    schemaVersion,
    scenarioId,
    firstDigest: digest(firstJson),
    secondDigest: digest(secondJson),
    expectedDigest: digest(expectedJson),
    byteIdentical: firstJson === secondJson,
    expectedMatched: firstJson === expectedJson,
  };
  const findingSamples = {
    schemaVersion,
    scenarioId,
    sampleCount: firstRun.evaluation.findings.length,
    samples: firstRun.evaluation.findings,
  };
  const limitations = {
    schemaVersion,
    scenarioId,
    ruleCount: initialRuleRegistry.rules.length,
    rules: initialRuleRegistry.rules.map(({ metadata }) => ({
      ruleId: metadata.id,
      limitations: metadata.limitations,
    })),
  };
  const artifacts = {
    'scenario-actual.json': firstScenario,
    'deterministic-comparison.json': deterministicComparison,
    'rule-matrix.json': ruleMatrix,
    'finding-samples.json': findingSamples,
    'failure-isolation.json': failureIsolation,
    'filter-metadata.json': filterMetadata,
    'limitations.json': limitations,
  };

  await writeOutputs({
    artifacts,
    expectedJson,
    outputDirectory,
    volatilePaths: [temporaryRoot, repositoryRoot],
  });

  process.stdout.write(
    await toCanonicalJson({
      scenarioId,
      findings: firstRun.evaluation.summary.findingCount,
      rules: firstRun.evaluation.summary.executedRuleCount,
      deterministic: firstJson === secondJson,
      expectedMatched: firstJson === expectedJson,
      failureIsolated: failureIsolation.findingsPreserved,
      targetCodeExecuted: executedTargetCode,
    }),
  );
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}

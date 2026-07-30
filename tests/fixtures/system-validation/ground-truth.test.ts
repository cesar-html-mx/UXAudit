import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format } from 'prettier';
import { describe, expect, it } from 'vitest';

const fixtureRoot = fileURLToPath(new URL('../../../fixtures/system-validation/', import.meta.url));
const groundTruthPath = join(fixtureRoot, 'ground-truth.json');
const manifestPath = join(fixtureRoot, 'manifest.json');
const stableRuleIds = [
  'accessibility/button-name',
  'accessibility/img-alt',
  'accessibility/input-label',
  'performance/img-dimensions',
  'performance/img-lazy-loading',
  'seo/ambiguous-link-text',
  'seo/multiple-h1',
  'ux/small-inline-text',
] as const;
const committedProjectIds = ['valid-project', 'invalid-project', 'mixed-project'] as const;
const classifications = ['positive', 'negative', 'unsupported'] as const;
const metricFields = ['tp', 'fp', 'tn', 'fn', 'unsupported', 'precision', 'recall'] as const;
const caseIdPattern = /data-uxaudit-case=["']([^"']+)["']/gu;

type StableRuleId = (typeof stableRuleIds)[number];
type CommittedProjectId = (typeof committedProjectIds)[number];
type Classification = (typeof classifications)[number];

interface GroundTruthInstance {
  readonly caseId: string;
  readonly classification: Classification;
  readonly expectedDetected: boolean;
  readonly projectId: CommittedProjectId;
  readonly rationale: string;
  readonly ruleId: StableRuleId;
  readonly sourcePath: string;
}

interface RuleMetrics {
  readonly fn: number;
  readonly fp: number;
  readonly precision: number;
  readonly recall: number;
  readonly tn: number;
  readonly tp: number;
  readonly unsupported: number;
}

interface GroundTruth {
  readonly committedProjectIds: readonly CommittedProjectId[];
  readonly contract: {
    readonly additionalProperties: boolean;
    readonly classificationValues: readonly Classification[];
    readonly instanceFields: readonly string[];
    readonly metricFields: readonly string[];
    readonly pathFormat: string;
    readonly projectScope: string;
    readonly unsupportedMetricPolicy: string;
  };
  readonly expectedMetricsByRule: Readonly<Record<StableRuleId, RuleMetrics>>;
  readonly groundTruthId: string;
  readonly instances: readonly GroundTruthInstance[];
  readonly schemaVersion: number;
  readonly stableRuleIds: readonly StableRuleId[];
}

interface ManifestProject {
  readonly directory: string;
  readonly expectedFindingCases: Readonly<Record<StableRuleId, readonly string[]>>;
  readonly sourceCandidates: readonly string[];
}

interface Manifest {
  readonly committedProjects: Readonly<Record<CommittedProjectId, ManifestProject>>;
}

const sortStrings = (values: readonly string[]): string[] =>
  [...values].sort((left, right) => left.localeCompare(right));

const expectExactKeys = (value: object, keys: readonly string[]): void => {
  expect(Object.keys(value)).toEqual(keys);
};

const metricFor = (instances: readonly GroundTruthInstance[]): RuleMetrics => {
  const positives = instances.filter(({ classification }) => classification === 'positive');
  const negatives = instances.filter(({ classification }) => classification === 'negative');
  const tp = positives.filter(({ expectedDetected }) => expectedDetected).length;
  const fn = positives.length - tp;
  const fp = negatives.filter(({ expectedDetected }) => expectedDetected).length;
  const tn = negatives.length - fp;

  return {
    tp,
    fp,
    tn,
    fn,
    unsupported: instances.filter(({ classification }) => classification === 'unsupported').length,
    precision: tp / (tp + fp),
    recall: tp / (tp + fn),
  };
};

describe('rule-accuracy ground truth', () => {
  it('is canonical JSON with a closed contract and exact stable scope', async () => {
    const raw = await readFile(groundTruthPath, 'utf8');
    const groundTruth = JSON.parse(raw) as GroundTruth;

    expect(raw).toBe(
      await format(raw, {
        endOfLine: 'lf',
        parser: 'json',
        printWidth: 100,
      }),
    );
    expectExactKeys(groundTruth, [
      'schemaVersion',
      'groundTruthId',
      'contract',
      'stableRuleIds',
      'committedProjectIds',
      'instances',
      'expectedMetricsByRule',
    ]);
    expect(groundTruth.schemaVersion).toBe(1);
    expect(groundTruth.groundTruthId).toBe('UXAUDIT-RULE-ACCURACY-GROUND-TRUTH');
    expectExactKeys(groundTruth.contract, [
      'additionalProperties',
      'instanceFields',
      'classificationValues',
      'projectScope',
      'pathFormat',
      'metricFields',
      'unsupportedMetricPolicy',
    ]);
    expect(groundTruth.contract).toEqual({
      additionalProperties: false,
      instanceFields: [
        'projectId',
        'sourcePath',
        'caseId',
        'ruleId',
        'classification',
        'expectedDetected',
        'rationale',
      ],
      classificationValues: classifications,
      projectScope: 'committed-projects-only',
      pathFormat: 'portable-relative-forward-slash',
      metricFields,
      unsupportedMetricPolicy: 'excluded-from-confusion-matrix',
    });
    expect(groundTruth.stableRuleIds).toEqual(stableRuleIds);
    expect(groundTruth.committedProjectIds).toEqual(committedProjectIds);
    expectExactKeys(groundTruth.expectedMetricsByRule, stableRuleIds);
  });

  it('binds every closed instance to committed source and covers positives, negatives, and limitations', async () => {
    const [groundTruthRaw, manifestRaw] = await Promise.all([
      readFile(groundTruthPath, 'utf8'),
      readFile(manifestPath, 'utf8'),
    ]);
    const groundTruth = JSON.parse(groundTruthRaw) as GroundTruth;
    const manifest = JSON.parse(manifestRaw) as Manifest;
    const identities: string[] = [];

    for (const instance of groundTruth.instances) {
      expectExactKeys(instance, [
        'projectId',
        'sourcePath',
        'caseId',
        'ruleId',
        'classification',
        'expectedDetected',
        'rationale',
      ]);
      expect(committedProjectIds).toContain(instance.projectId);
      expect(stableRuleIds).toContain(instance.ruleId);
      expect(classifications).toContain(instance.classification);
      expect(instance.expectedDetected).toBe(instance.classification === 'positive');
      expect(instance.rationale.trim().length).toBeGreaterThan(30);
      expect(instance.sourcePath).not.toMatch(/(?:^|\/)\.\.(?:\/|$)|\\/u);

      const project = manifest.committedProjects[instance.projectId];
      expect(project.sourceCandidates).toContain(instance.sourcePath);
      const source = await readFile(
        join(fixtureRoot, project.directory, instance.sourcePath),
        'utf8',
      );
      const caseIds = [...source.matchAll(caseIdPattern)].map((match) => match[1]);

      expect(caseIds.filter((caseId) => caseId === instance.caseId)).toHaveLength(1);
      identities.push(`${instance.projectId}:${instance.ruleId}:${instance.caseId}`);
    }

    expect(identities).toEqual([...new Set(identities)]);

    const expectedPositiveIdentities = sortStrings(
      committedProjectIds.flatMap((projectId) =>
        stableRuleIds.flatMap((ruleId) =>
          manifest.committedProjects[projectId].expectedFindingCases[ruleId].map(
            (caseId) => `${projectId}:${ruleId}:${caseId}`,
          ),
        ),
      ),
    );
    const actualPositiveIdentities = sortStrings(
      groundTruth.instances
        .filter(({ classification }) => classification === 'positive')
        .map(({ caseId, projectId, ruleId }) => `${projectId}:${ruleId}:${caseId}`),
    );

    expect(actualPositiveIdentities).toEqual(expectedPositiveIdentities);
    expect(
      groundTruth.instances
        .filter(({ classification }) => classification === 'negative')
        .map(({ projectId }) => projectId),
    ).toEqual(Array.from({ length: 8 }, () => 'valid-project'));
    expect(
      groundTruth.instances
        .filter(({ classification }) => classification === 'unsupported')
        .map(({ projectId }) => projectId),
    ).toEqual(Array.from({ length: 8 }, () => 'mixed-project'));

    for (const ruleId of stableRuleIds) {
      const ruleInstances = groundTruth.instances.filter((instance) => instance.ruleId === ruleId);

      expect(ruleInstances.some(({ classification }) => classification === 'positive')).toBe(true);
      expect(
        ruleInstances.filter(({ classification }) => classification === 'negative'),
      ).toHaveLength(1);
      expect(
        ruleInstances.filter(({ classification }) => classification === 'unsupported'),
      ).toHaveLength(1);
      expectExactKeys(groundTruth.expectedMetricsByRule[ruleId], metricFields);
      expect(groundTruth.expectedMetricsByRule[ruleId]).toEqual(metricFor(ruleInstances));
    }
  });
});

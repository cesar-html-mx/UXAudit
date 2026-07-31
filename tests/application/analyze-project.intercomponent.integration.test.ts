import { access, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { analyzeProject } from '../../src/application/analyze-project.js';
import { scanProject } from '../../src/application/scan-project.js';
import { buildAnalysisModel } from '../../src/domain/models/build-analysis-model.js';
import type {
  AnalysisModel,
  AnalyzedComponent,
  JsxNode,
} from '../../src/domain/models/analysis-model.js';
import { analyzeSourceCandidates } from '../../src/parsing/analyze-source-candidates.js';
import { evaluateRules } from '../../src/rules/evaluate-rules.js';
import { initialRuleRegistry } from '../../src/rules/initial-rule-registry.js';
import { loadRules } from '../../src/rules/load-rules.js';

const fixtureUrl = new URL('../fixtures/intercomponent/static-composition/', import.meta.url);
const fixturePath = fileURLToPath(fixtureUrl);

interface ExpectedIntercomponentManifest {
  readonly counts: {
    readonly components: number;
    readonly jsxNodes: number;
    readonly resolvedComponentUses: number;
    readonly unresolvedComponentUses: number;
  };
  readonly findings: readonly {
    readonly filePath: string;
    readonly line: number;
    readonly ruleId: string;
  }[];
  readonly links: readonly (readonly [string, string])[];
  readonly schemaVersion: 1;
  readonly unresolvedUses: readonly (readonly [string, string])[];
}

const requireComponent = (
  componentsById: ReadonlyMap<string, AnalyzedComponent>,
  componentId: null | string,
): AnalyzedComponent => {
  const component = componentId === null ? undefined : componentsById.get(componentId);

  if (component === undefined) {
    throw new TypeError(`Missing component projection: ${componentId ?? 'unowned'}`);
  }

  return component;
};

const requireNode = (nodesById: ReadonlyMap<string, JsxNode>, nodeId: string): JsxNode => {
  const node = nodesById.get(nodeId);

  if (node === undefined) {
    throw new TypeError(`Missing JSX projection: ${nodeId}`);
  }

  return node;
};

const projectLinks = (model: AnalysisModel): readonly (readonly [string, string])[] => {
  const componentsById = new Map(
    model.components.map((component) => [component.id, component] as const),
  );
  const nodesById = new Map(model.jsxNodes.map((node) => [node.id, node] as const));

  return model.componentLinks.map((link) => {
    const sourceNode = requireNode(nodesById, link.jsxNodeId);
    const source = requireComponent(componentsById, sourceNode.componentId);
    const target = requireComponent(componentsById, link.targetComponentId);
    return [source.name ?? '<anonymous>', target.name ?? '<anonymous>'] as const;
  });
};

const projectUnresolvedUses = (model: AnalysisModel): readonly (readonly [string, string])[] => {
  const componentsById = new Map(
    model.components.map((component) => [component.id, component] as const),
  );
  const linkedNodeIds = new Set(model.componentLinks.map((link) => link.jsxNodeId));

  return model.jsxNodes.flatMap((node) => {
    if (node.kind !== 'element' || node.elementKind !== 'custom' || linkedNodeIds.has(node.id)) {
      return [];
    }

    const source = requireComponent(componentsById, node.componentId);
    return [[source.name ?? '<anonymous>', node.name] as const];
  });
};

const projectFindings = (
  model: AnalysisModel,
): readonly Readonly<{
  filePath: string | undefined;
  line: number | undefined;
  ruleId: string;
}>[] =>
  evaluateRules({
    loadedRules: loadRules({ registry: initialRuleRegistry }),
    model,
  }).findings.map((finding) => ({
    filePath: finding.location?.filePath,
    line: finding.location?.start.line,
    ruleId: finding.ruleId,
  }));

describe('analyzeProject intercomponent integration', () => {
  it('builds the exact reviewed graph deterministically without executing target modules', async () => {
    const projectRoot = await realpath(fixturePath);
    const expected = JSON.parse(
      await readFile(new URL('expected.json', fixtureUrl), 'utf8'),
    ) as ExpectedIntercomponentManifest;
    const first = await analyzeProject({ projectPath: projectRoot });
    const second = await analyzeProject({ projectPath: projectRoot });
    const scanResult = await scanProject({ projectPath: projectRoot });
    const extraction = await analyzeSourceCandidates({
      candidates: scanResult.sourceCandidates,
      projectRoot: scanResult.projectPath,
    });
    const forwardModel = buildAnalysisModel(extraction.analyzedFiles);
    const reverseModel = buildAnalysisModel(extraction.analyzedFiles.toReversed());

    expect(expected.schemaVersion).toBe(1);
    expect(first.parserErrors).toEqual([]);
    expect(first.parsingSummary).toEqual({
      components: 7,
      failedFiles: 0,
      jsxNodes: 17,
      parsedFiles: 6,
    });
    expect({
      components: first.model.components.length,
      jsxNodes: first.model.jsxNodes.length,
      resolvedComponentUses: first.model.componentLinks.length,
      unresolvedComponentUses: projectUnresolvedUses(first.model).length,
    }).toEqual(expected.counts);
    expect(projectLinks(first.model)).toEqual(expected.links);
    expect(projectUnresolvedUses(first.model)).toEqual(expected.unresolvedUses);
    expect(JSON.stringify(second.model)).toBe(JSON.stringify(first.model));
    expect(JSON.stringify(reverseModel)).toBe(JSON.stringify(forwardModel));
    expect(projectLinks(reverseModel)).toEqual(projectLinks(forwardModel));
    expect(projectFindings(reverseModel)).toEqual(projectFindings(forwardModel));
    expect(projectFindings(forwardModel)).toEqual(expected.findings);
    await expect(access(join(projectRoot, 'TARGET_CODE_EXECUTED'))).rejects.toBeDefined();
  });
});

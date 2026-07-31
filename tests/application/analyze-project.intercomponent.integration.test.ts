import { access, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { analyzeProject } from '../../src/application/analyze-project.js';
import type {
  AnalysisModel,
  AnalyzedComponent,
  JsxElement,
  JsxNode,
} from '../../src/domain/models/analysis-model.js';

const fixtureUrl = new URL('../fixtures/intercomponent/static-composition/', import.meta.url);
const fixturePath = fileURLToPath(fixtureUrl);

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

describe('analyzeProject intercomponent integration', () => {
  it('builds the exact reviewed graph deterministically without executing target modules', async () => {
    const projectRoot = await realpath(fixturePath);
    const expected = JSON.parse(
      await readFile(new URL('expected.json', fixtureUrl), 'utf8'),
    ) as Readonly<Record<string, unknown>>;
    const first = await analyzeProject({ projectPath: projectRoot });
    const second = await analyzeProject({ projectPath: projectRoot });
    const linkedNodeIds = new Set(first.model.componentLinks.map((link) => link.jsxNodeId));
    const customNodes = first.model.jsxNodes.filter(
      (node): node is JsxElement => node.kind === 'element' && node.elementKind === 'custom',
    );
    const unresolvedNames = customNodes
      .filter((node) => !linkedNodeIds.has(node.id))
      .map((node) => node.name)
      .toSorted();

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
      unresolvedComponentUses: unresolvedNames.length,
    }).toEqual(expected['counts']);
    expect(projectLinks(first.model)).toEqual(expected['links']);
    expect(unresolvedNames).toEqual(['ExternalHeading', 'MissingWidget']);
    expect(JSON.stringify(second.model)).toBe(JSON.stringify(first.model));
    await expect(access(join(projectRoot, 'TARGET_CODE_EXECUTED'))).rejects.toBeDefined();
  });
});

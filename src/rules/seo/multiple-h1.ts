import type {
  AnalysisModel,
  AnalyzedComponent,
  ComponentLink,
  JsxNode,
} from '../../domain/models/analysis-model.js';
import type { SourceLocation } from '../../domain/models/source-location.js';
import {
  FINDING_CONFIDENCES,
  RULE_CATEGORIES,
  RULE_SEVERITIES,
  RULE_STATUSES,
  type Rule,
} from '../../domain/rules/rule.js';
import { isIntrinsicElement } from '../jsx-elements.js';

export const MAX_COMPONENT_COMPOSITION_DEPTH = 64;
export const MAX_COMPONENT_COMPOSITION_STEPS = 100_000;

type H1Presence = 'absent' | 'present' | 'unknown';

interface CompositionIndex {
  readonly componentsById: ReadonlyMap<string, AnalyzedComponent>;
  readonly directH1NodesByComponentId: ReadonlyMap<string, readonly JsxNode[]>;
  readonly linksByJsxNodeId: ReadonlyMap<string, ComponentLink>;
  readonly nodesById: ReadonlyMap<string, JsxNode>;
}

interface CompositionBudget {
  remainingSteps: number;
}

const createCompositionIndex = (model: AnalysisModel): CompositionIndex => {
  const directH1NodesByComponentId = new Map<string, JsxNode[]>();

  for (const component of model.components) {
    directH1NodesByComponentId.set(component.id, []);
  }

  for (const node of model.jsxNodes) {
    if (node.componentId !== null && isIntrinsicElement(node, 'h1')) {
      directH1NodesByComponentId.get(node.componentId)?.push(node);
    }
  }

  return {
    componentsById: new Map(
      model.components.map((component) => [component.id, component] as const),
    ),
    directH1NodesByComponentId,
    linksByJsxNodeId: new Map(model.componentLinks.map((link) => [link.jsxNodeId, link] as const)),
    nodesById: new Map(model.jsxNodes.map((node) => [node.id, node] as const)),
  };
};

const consumeCompositionStep = (budget: CompositionBudget): boolean => {
  if (budget.remainingSteps <= 0) {
    return false;
  }

  budget.remainingSteps -= 1;
  return true;
};

const getComponentH1Presence = (
  componentId: string,
  index: CompositionIndex,
  activeComponentIds: Set<string>,
  depth: number,
  budget: CompositionBudget,
): H1Presence => {
  if (
    depth > MAX_COMPONENT_COMPOSITION_DEPTH ||
    activeComponentIds.has(componentId) ||
    !consumeCompositionStep(budget)
  ) {
    return 'unknown';
  }

  const component = index.componentsById.get(componentId);

  if (component === undefined) {
    return 'unknown';
  }

  if ((index.directH1NodesByComponentId.get(componentId)?.length ?? 0) > 0) {
    return 'present';
  }

  activeComponentIds.add(componentId);
  let unknownPathEncountered = false;

  try {
    for (const nodeId of component.jsxNodeIds) {
      if (!consumeCompositionStep(budget)) {
        return 'unknown';
      }

      const node = index.nodesById.get(nodeId);

      if (node === undefined) {
        unknownPathEncountered = true;
        continue;
      }

      const link = index.linksByJsxNodeId.get(node.id);

      if (link === undefined) {
        continue;
      }

      const childPresence = getComponentH1Presence(
        link.targetComponentId,
        index,
        activeComponentIds,
        depth + 1,
        budget,
      );

      if (childPresence === 'present') {
        return 'present';
      }

      if (childPresence === 'unknown') {
        unknownPathEncountered = true;
      }
    }
  } finally {
    activeComponentIds.delete(componentId);
  }

  return unknownPathEncountered ? 'unknown' : 'absent';
};

const getComposedFindingLocation = (
  component: AnalyzedComponent,
  index: CompositionIndex,
  budget: CompositionBudget,
): null | SourceLocation => {
  const directH1Nodes = index.directH1NodesByComponentId.get(component.id) ?? [];

  if (directH1Nodes.length >= 2) {
    return directH1Nodes[1]?.location ?? null;
  }

  const activeComponentIds = new Set([component.id]);
  let contributionCount = 0;

  for (const nodeId of component.jsxNodeIds) {
    const node = index.nodesById.get(nodeId);

    if (node === undefined) {
      continue;
    }

    let contributesH1 = isIntrinsicElement(node, 'h1');

    if (!contributesH1) {
      const link = index.linksByJsxNodeId.get(node.id);
      contributesH1 =
        link !== undefined &&
        getComponentH1Presence(link.targetComponentId, index, activeComponentIds, 1, budget) ===
          'present';
    }

    if (!contributesH1) {
      continue;
    }

    contributionCount += 1;

    if (contributionCount === 2) {
      return node.location;
    }
  }

  return null;
};

const getMultipleH1Locations = (model: AnalysisModel): readonly SourceLocation[] => {
  const index = createCompositionIndex(model);

  return model.components.flatMap((component) => {
    const budget: CompositionBudget = { remainingSteps: MAX_COMPONENT_COMPOSITION_STEPS };
    const findingLocation = getComposedFindingLocation(component, index, budget);
    return findingLocation === null ? [] : [findingLocation];
  });
};

export const multipleH1Rule: Rule = {
  evaluate: ({ model }) => {
    return getMultipleH1Locations(model).map((location) => ({
      confidence: FINDING_CONFIDENCES.medium,
      location,
      message: 'Component contains more than one intrinsic h1 element and needs review.',
    }));
  },
  metadata: Object.freeze({
    category: RULE_CATEGORIES.seo,
    defaultSeverity: RULE_SEVERITIES.medium,
    explanation:
      'Multiple intrinsic h1 elements owned or statically composed by one component can make the rendered page hierarchy unclear.',
    id: 'seo/multiple-h1',
    limitations: Object.freeze([
      'The supported scope counts intrinsic h1 elements owned by a recognized component or reached through exact direct local component links.',
      'Conditional rendering, routes, and whether owned headings appear together at runtime are not evaluated.',
      "Unresolved or ambiguous modules, cyclic edges, paths beyond 64 ComponentLink hops from a root, paths requiring more than that root's independent 100000-step traversal budget, custom heading syntax, and heading roles are not inferred.",
    ]),
    recommendation:
      'Review the component and keep one primary h1 for each rendered page context, using lower heading levels for subordinate sections.',
    reference: null,
    status: RULE_STATUSES.stable,
    title: 'Multiple H1 elements',
  }),
};

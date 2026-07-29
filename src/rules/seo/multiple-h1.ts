import type { JsxElement } from '../../domain/models/analysis-model.js';
import {
  FINDING_CONFIDENCES,
  RULE_CATEGORIES,
  RULE_SEVERITIES,
  RULE_STATUSES,
  type Rule,
} from '../../domain/rules/rule.js';
import { isIntrinsicElement } from '../jsx-elements.js';

const getSecondH1ByComponent = (
  components: readonly { readonly id: string }[],
  h1Elements: readonly JsxElement[],
): readonly JsxElement[] => {
  const countsByComponentId = new Map<string, number>();
  const secondH1ByComponentId = new Map<string, JsxElement>();

  for (const element of h1Elements) {
    if (element.componentId === null) {
      continue;
    }

    const count = (countsByComponentId.get(element.componentId) ?? 0) + 1;
    countsByComponentId.set(element.componentId, count);

    if (count === 2) {
      secondH1ByComponentId.set(element.componentId, element);
    }
  }

  return components.flatMap((component) => {
    const secondH1 = secondH1ByComponentId.get(component.id);
    return secondH1 === undefined ? [] : [secondH1];
  });
};

export const multipleH1Rule: Rule = {
  evaluate: ({ model }) => {
    const h1Elements = model.jsxNodes.filter((node) => isIntrinsicElement(node, 'h1'));

    return getSecondH1ByComponent(model.components, h1Elements).map((element) => ({
      confidence: FINDING_CONFIDENCES.medium,
      location: element.location,
      message: 'Component contains more than one intrinsic h1 element and needs review.',
    }));
  },
  metadata: Object.freeze({
    category: RULE_CATEGORIES.seo,
    defaultSeverity: RULE_SEVERITIES.medium,
    explanation:
      'Multiple intrinsic h1 elements owned by one component can make the rendered page hierarchy unclear.',
    id: 'seo/multiple-h1',
    limitations: Object.freeze([
      'The initial scope counts intrinsic h1 elements only within each syntactically recognized component.',
      'Conditional rendering, routes, and whether owned headings appear together at runtime are not evaluated.',
      'Custom heading components, component composition, and heading roles are not inferred.',
    ]),
    recommendation:
      'Review the component and keep one primary h1 for each rendered page context, using lower heading levels for subordinate sections.',
    reference: null,
    status: RULE_STATUSES.stable,
    title: 'Multiple H1 elements',
  }),
};

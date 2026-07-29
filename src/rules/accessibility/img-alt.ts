import {
  FINDING_CONFIDENCES,
  RULE_CATEGORIES,
  RULE_SEVERITIES,
  RULE_STATUSES,
  type Rule,
} from '../../domain/rules/rule.js';
import {
  EFFECTIVE_ATTRIBUTE_STATES,
  isIntrinsicElement,
  resolveEffectiveAttribute,
} from '../jsx-elements.js';

export const imgAltRule: Rule = {
  evaluate: ({ model }) =>
    model.jsxNodes
      .filter((node) => isIntrinsicElement(node, 'img'))
      .filter(
        (element) =>
          resolveEffectiveAttribute(element, 'alt').state === EFFECTIVE_ATTRIBUTE_STATES.absent,
      )
      .map((element) => ({
        confidence: FINDING_CONFIDENCES.high,
        location: element.location,
        message: 'Intrinsic image has no explicit alt attribute.',
      })),
  metadata: Object.freeze({
    category: RULE_CATEGORIES.accessibility,
    defaultSeverity: RULE_SEVERITIES.high,
    explanation:
      'An intrinsic image without an explicit text alternative may be unavailable to people who cannot perceive the image.',
    id: 'accessibility/img-alt',
    limitations: Object.freeze([
      'Custom image components and aliases are not inferred.',
      'A later JSX spread can provide alt at runtime and is therefore treated as unknown.',
      'The rule checks explicit attribute presence, not the descriptive quality of alt text.',
    ]),
    recommendation:
      'Add a descriptive alt value, or use alt="" when the image is intentionally decorative.',
    reference: Object.freeze({
      label: 'WCAG 2.2 — 1.1.1 Non-text Content',
      url: null,
    }),
    status: RULE_STATUSES.stable,
    title: 'Image alternative text',
  }),
};

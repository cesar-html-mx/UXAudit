import {
  FINDING_CONFIDENCES,
  RULE_CATEGORIES,
  RULE_SEVERITIES,
  RULE_STATUSES,
  type Rule,
} from '../../domain/rules/rule.js';
import { isIntrinsicElement } from '../jsx-elements.js';
import {
  ACCESSIBLE_EVIDENCE_STATES,
  classifyAccessibleText,
  classifyNonEmptyStringAttribute,
} from './accessibility-helpers.js';

export const buttonNameRule: Rule = {
  evaluate: ({ model }) =>
    model.jsxNodes
      .filter((node) => isIntrinsicElement(node, 'button'))
      .filter((element) => {
        const evidence = [
          classifyAccessibleText(element.textContent),
          classifyNonEmptyStringAttribute(element, 'aria-label'),
          classifyNonEmptyStringAttribute(element, 'aria-labelledby'),
        ];

        return evidence.every((state) => state === ACCESSIBLE_EVIDENCE_STATES.absent);
      })
      .map((element) => ({
        confidence: FINDING_CONFIDENCES.high,
        location: element.location,
        message: 'Button has no statically determinable accessible name.',
      })),
  metadata: Object.freeze({
    category: RULE_CATEGORIES.accessibility,
    defaultSeverity: RULE_SEVERITIES.high,
    explanation:
      'A button needs an accessible name so assistive-technology users can understand the action it performs.',
    id: 'accessibility/button-name',
    limitations: Object.freeze([
      'The static text model does not implement the complete accessible-name computation.',
      'Dynamic-only content, JSX spreads, and custom icon components are treated as unknown.',
      'Referenced aria-labelledby targets and CSS-hidden content are not resolved.',
    ]),
    recommendation:
      'Provide visible descriptive text, aria-label, or aria-labelledby with a non-empty accessible name.',
    reference: Object.freeze({
      label: 'WCAG 2.2 — 4.1.2 Name, Role, Value',
      url: null,
    }),
    status: RULE_STATUSES.stable,
    title: 'Button accessible name',
  }),
};

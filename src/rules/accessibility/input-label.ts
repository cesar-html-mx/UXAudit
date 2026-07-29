import type { JsxElement, JsxNode } from '../../domain/models/analysis-model.js';
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
import {
  ACCESSIBLE_EVIDENCE_STATES,
  classifyNonEmptyStringAttribute,
  type AccessibleEvidenceState,
} from './accessibility-helpers.js';

const excludedInputTypes = new Set(['button', 'hidden', 'image', 'reset', 'submit']);

const isFormControl = (node: JsxNode): node is JsxElement =>
  isIntrinsicElement(node, 'input') ||
  isIntrinsicElement(node, 'select') ||
  isIntrinsicElement(node, 'textarea');

type InputScope = 'excluded' | 'label-required' | 'unknown';

const classifyInputScope = (element: JsxElement): InputScope => {
  if (element.name !== 'input') {
    return 'label-required';
  }

  const type = resolveEffectiveAttribute(element, 'type');

  if (type.state === EFFECTIVE_ATTRIBUTE_STATES.absent) {
    return 'label-required';
  }

  if (type.state === EFFECTIVE_ATTRIBUTE_STATES.unknown) {
    return 'unknown';
  }

  const value = type.attribute.value;

  if (value.kind !== 'literal') {
    return 'unknown';
  }

  if (value.value === null) {
    return 'label-required';
  }

  if (typeof value.value !== 'string') {
    return 'unknown';
  }

  return excludedInputTypes.has(value.value.trim().toLowerCase()) ? 'excluded' : 'label-required';
};

const getExactNonEmptyId = (element: JsxElement): null | string | undefined => {
  const id = resolveEffectiveAttribute(element, 'id');

  if (id.state === EFFECTIVE_ATTRIBUTE_STATES.absent) {
    return null;
  }

  if (id.state === EFFECTIVE_ATTRIBUTE_STATES.unknown) {
    return undefined;
  }

  const value = id.attribute.value;

  if (value.kind !== 'literal' || typeof value.value !== 'string') {
    return undefined;
  }

  const normalized = value.value.trim();
  return normalized.length === 0 ? null : value.value;
};

const belongsToAssociationScope = (control: JsxElement, candidate: JsxElement): boolean =>
  control.componentId !== null &&
  control.componentId === candidate.componentId &&
  control.location.filePath === candidate.location.filePath;

const classifyLabelTarget = (label: JsxElement, id: string): AccessibleEvidenceState => {
  let hasUnknownTarget = false;

  for (const attributeName of ['htmlFor', 'for']) {
    const target = resolveEffectiveAttribute(label, attributeName);

    if (target.state === EFFECTIVE_ATTRIBUTE_STATES.unknown) {
      hasUnknownTarget = true;
      continue;
    }

    if (target.state === EFFECTIVE_ATTRIBUTE_STATES.known) {
      const value = target.attribute.value;

      if (value.kind === 'literal' && value.value === null) {
        continue;
      }

      if (value.kind !== 'literal' || typeof value.value !== 'string') {
        hasUnknownTarget = true;
        continue;
      }

      if (value.value === id) {
        return ACCESSIBLE_EVIDENCE_STATES.present;
      }
    }
  }

  return hasUnknownTarget ? ACCESSIBLE_EVIDENCE_STATES.unknown : ACCESSIBLE_EVIDENCE_STATES.absent;
};

const classifyExternalLabel = (
  control: JsxElement,
  id: string,
  elements: readonly JsxElement[],
): AccessibleEvidenceState => {
  const states = elements
    .filter(
      (candidate) =>
        isIntrinsicElement(candidate, 'label') && belongsToAssociationScope(control, candidate),
    )
    .map((label) => classifyLabelTarget(label, id));

  if (states.includes(ACCESSIBLE_EVIDENCE_STATES.present)) {
    return ACCESSIBLE_EVIDENCE_STATES.present;
  }

  return states.includes(ACCESSIBLE_EVIDENCE_STATES.unknown)
    ? ACCESSIBLE_EVIDENCE_STATES.unknown
    : ACCESSIBLE_EVIDENCE_STATES.absent;
};

const classifyIntrinsicLabelAncestor = (
  control: JsxElement,
  controlId: null | string | undefined,
  nodesById: ReadonlyMap<string, JsxNode>,
): AccessibleEvidenceState => {
  let parentNodeId = control.parentNodeId;
  let hasUnknownAssociation = false;

  while (parentNodeId !== null) {
    const parent = nodesById.get(parentNodeId);

    if (parent === undefined) {
      return ACCESSIBLE_EVIDENCE_STATES.unknown;
    }

    if (isIntrinsicElement(parent, 'label')) {
      const targetAttributes = ['htmlFor', 'for'].map((name) =>
        resolveEffectiveAttribute(parent, name),
      );
      const hasExplicitTarget = targetAttributes.some((target) => {
        if (target.state === EFFECTIVE_ATTRIBUTE_STATES.absent) {
          return false;
        }

        return !(
          target.state === EFFECTIVE_ATTRIBUTE_STATES.known &&
          target.attribute.value.kind === 'literal' &&
          target.attribute.value.value === null
        );
      });

      if (!hasExplicitTarget) {
        return ACCESSIBLE_EVIDENCE_STATES.present;
      }

      for (const target of targetAttributes) {
        if (target.state === EFFECTIVE_ATTRIBUTE_STATES.unknown) {
          hasUnknownAssociation = true;
          continue;
        }

        if (target.state === EFFECTIVE_ATTRIBUTE_STATES.known) {
          const value = target.attribute.value;

          if (value.kind === 'literal' && value.value === null) {
            continue;
          }

          if (value.kind !== 'literal' || typeof value.value !== 'string') {
            hasUnknownAssociation = true;
            continue;
          }

          if (controlId === undefined) {
            hasUnknownAssociation = true;
            continue;
          }

          if (controlId !== null && value.value === controlId) {
            return ACCESSIBLE_EVIDENCE_STATES.present;
          }
        }
      }
    }

    parentNodeId = parent.parentNodeId;
  }

  return hasUnknownAssociation
    ? ACCESSIBLE_EVIDENCE_STATES.unknown
    : ACCESSIBLE_EVIDENCE_STATES.absent;
};

export const inputLabelRule: Rule = {
  evaluate: ({ model }) => {
    const elements = model.jsxNodes.filter((node): node is JsxElement => node.kind === 'element');
    const nodesById = new Map(model.jsxNodes.map((node) => [node.id, node]));

    return elements
      .filter(isFormControl)
      .filter((control) => classifyInputScope(control) === 'label-required')
      .filter((control) => {
        const ariaLabel = classifyNonEmptyStringAttribute(control, 'aria-label');
        const ariaLabelledBy = classifyNonEmptyStringAttribute(control, 'aria-labelledby');

        if (
          ariaLabel === ACCESSIBLE_EVIDENCE_STATES.present ||
          ariaLabelledBy === ACCESSIBLE_EVIDENCE_STATES.present
        ) {
          return false;
        }

        if (
          ariaLabel === ACCESSIBLE_EVIDENCE_STATES.unknown ||
          ariaLabelledBy === ACCESSIBLE_EVIDENCE_STATES.unknown
        ) {
          return false;
        }

        const id = getExactNonEmptyId(control);
        const ancestorLabel = classifyIntrinsicLabelAncestor(control, id, nodesById);

        if (ancestorLabel !== ACCESSIBLE_EVIDENCE_STATES.absent) {
          return false;
        }

        if (id === undefined) {
          return false;
        }

        return (
          id === null ||
          classifyExternalLabel(control, id, elements) === ACCESSIBLE_EVIDENCE_STATES.absent
        );
      })
      .map((control) => ({
        confidence: FINDING_CONFIDENCES.high,
        location: control.location,
        message: 'Form control has no statically associated label or accessible name.',
      }));
  },
  metadata: Object.freeze({
    category: RULE_CATEGORIES.accessibility,
    defaultSeverity: RULE_SEVERITIES.high,
    explanation:
      'A form control needs a programmatic label or accessible name so users can understand its purpose.',
    id: 'accessibility/input-label',
    limitations: Object.freeze([
      'Dynamic IDs, labels, and JSX spreads are treated as unknown rather than violations.',
      'Custom label or form-control abstractions are not resolved across component boundaries.',
      'aria-labelledby target existence and the complete accessible-name computation are not validated.',
      'Input types hidden, button, submit, reset, and image are outside this label rule.',
      'A nested label is not checked for the one-labelable-descendant content constraint.',
    ]),
    recommendation:
      'Associate an intrinsic label with nesting or htmlFor/id, or provide a non-empty aria-label or aria-labelledby value.',
    reference: Object.freeze({
      label: 'WCAG 2.2 — 1.3.1 Info and Relationships',
      url: null,
    }),
    status: RULE_STATUSES.stable,
    title: 'Form input label',
  }),
};

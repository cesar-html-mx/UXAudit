import type { JsxElement } from '../../domain/models/analysis-model.js';
import { JSX_VALUE_CONFIDENCE, type JsxTextContent } from '../../domain/models/jsx-value.js';
import { EFFECTIVE_ATTRIBUTE_STATES, resolveEffectiveAttribute } from '../jsx-elements.js';

export const ACCESSIBLE_EVIDENCE_STATES = Object.freeze({
  absent: 'absent',
  present: 'present',
  unknown: 'unknown',
} as const);

export type AccessibleEvidenceState =
  (typeof ACCESSIBLE_EVIDENCE_STATES)[keyof typeof ACCESSIBLE_EVIDENCE_STATES];

export const classifyNonEmptyStringAttribute = (
  element: JsxElement,
  name: string,
): AccessibleEvidenceState => {
  const resolved = resolveEffectiveAttribute(element, name);

  if (resolved.state === EFFECTIVE_ATTRIBUTE_STATES.absent) {
    return ACCESSIBLE_EVIDENCE_STATES.absent;
  }

  if (resolved.state === EFFECTIVE_ATTRIBUTE_STATES.unknown) {
    return ACCESSIBLE_EVIDENCE_STATES.unknown;
  }

  const value = resolved.attribute.value;

  if (value.kind === 'literal' && value.value === null) {
    return ACCESSIBLE_EVIDENCE_STATES.absent;
  }

  if (value.kind !== 'literal' || typeof value.value !== 'string') {
    return ACCESSIBLE_EVIDENCE_STATES.unknown;
  }

  return value.value.trim().length > 0
    ? ACCESSIBLE_EVIDENCE_STATES.present
    : ACCESSIBLE_EVIDENCE_STATES.absent;
};

export const classifyAccessibleText = (text: JsxTextContent): AccessibleEvidenceState => {
  if (text.value.trim().length > 0) {
    return ACCESSIBLE_EVIDENCE_STATES.present;
  }

  return text.confidence === JSX_VALUE_CONFIDENCE.exact
    ? ACCESSIBLE_EVIDENCE_STATES.absent
    : ACCESSIBLE_EVIDENCE_STATES.unknown;
};

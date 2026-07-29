import type { JsxElement } from '../../domain/models/analysis-model.js';
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

const DIMENSION_STATES = Object.freeze({
  invalid: 'invalid',
  unknown: 'unknown',
  valid: 'valid',
  zero: 'zero',
} as const);

type DimensionState = (typeof DIMENSION_STATES)[keyof typeof DIMENSION_STATES];

const decimalIntegerPattern = /^[0-9]+$/u;
const nonZeroDigitPattern = /[1-9]/u;

const classifyIntegerLiteral = (value: number | string): DimensionState => {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      return DIMENSION_STATES.invalid;
    }

    return value === 0 ? DIMENSION_STATES.zero : DIMENSION_STATES.valid;
  }

  if (!decimalIntegerPattern.test(value)) {
    return DIMENSION_STATES.invalid;
  }

  return nonZeroDigitPattern.test(value) ? DIMENSION_STATES.valid : DIMENSION_STATES.zero;
};

const classifyDimension = (element: JsxElement, name: 'height' | 'width'): DimensionState => {
  const dimension = resolveEffectiveAttribute(element, name);

  if (dimension.state === EFFECTIVE_ATTRIBUTE_STATES.absent) {
    return DIMENSION_STATES.invalid;
  }

  if (dimension.state === EFFECTIVE_ATTRIBUTE_STATES.unknown) {
    return DIMENSION_STATES.unknown;
  }

  const value = dimension.attribute.value;

  if (value.kind === 'dynamic') {
    return DIMENSION_STATES.unknown;
  }

  if (
    value.kind === 'literal' &&
    (typeof value.value === 'number' || typeof value.value === 'string') &&
    value.value !== ''
  ) {
    return classifyIntegerLiteral(value.value);
  }

  return DIMENSION_STATES.invalid;
};

const needsDimensionReview = (element: JsxElement): boolean => {
  const states = [classifyDimension(element, 'width'), classifyDimension(element, 'height')];

  if (states.includes(DIMENSION_STATES.invalid)) {
    return true;
  }

  return states.includes(DIMENSION_STATES.zero) && states.includes(DIMENSION_STATES.valid);
};

export const imgDimensionsRule: Rule = {
  evaluate: ({ model }) =>
    model.jsxNodes
      .filter((node) => isIntrinsicElement(node, 'img'))
      .filter(needsDimensionReview)
      .map((element) => ({
        confidence: FINDING_CONFIDENCES.medium,
        location: element.location,
        message:
          'Image does not provide statically verified positive integer width and height attributes; review its reserved layout space.',
      })),
  metadata: Object.freeze({
    category: RULE_CATEGORIES.performance,
    defaultSeverity: RULE_SEVERITIES.medium,
    explanation:
      'An intrinsic image without positive integer width and height attributes may lack intrinsic space reservation and contribute to layout shift.',
    id: 'performance/img-dimensions',
    limitations: Object.freeze([
      'External CSS, aspect-ratio, and component-level layout can reserve equivalent space, so the finding describes reviewable risk rather than observed layout shift.',
      'Dynamic dimension values and unresolved JSX spreads are unknown and do not independently produce a finding; a proved sibling violation remains reviewable.',
      'A literal zero-by-zero image is treated as content not intended for the user; zero paired with a positive dimension remains reviewable.',
      'Only intrinsic img attributes are checked; custom image components and runtime image metadata are not inferred.',
    ]),
    recommendation:
      'Provide positive integer width and height attributes that preserve the image aspect ratio, or verify that CSS reserves equivalent space.',
    reference: Object.freeze({
      label: 'HTML Standard — Dimension attributes',
      url: 'https://html.spec.whatwg.org/multipage/embedded-content-other.html#dimension-attributes',
    }),
    status: RULE_STATUSES.stable,
    title: 'Image dimensions',
  }),
};

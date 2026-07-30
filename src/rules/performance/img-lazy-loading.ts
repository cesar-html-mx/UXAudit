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

const LAZY_LOADING_STATES = Object.freeze({
  configured: 'configured',
  review: 'review',
  unknown: 'unknown',
} as const);

type LazyLoadingState = (typeof LAZY_LOADING_STATES)[keyof typeof LAZY_LOADING_STATES];

const classifyLazyLoading = (element: JsxElement): LazyLoadingState => {
  const loading = resolveEffectiveAttribute(element, 'loading');

  if (loading.state === EFFECTIVE_ATTRIBUTE_STATES.absent) {
    return LAZY_LOADING_STATES.review;
  }

  if (loading.state === EFFECTIVE_ATTRIBUTE_STATES.unknown) {
    return LAZY_LOADING_STATES.unknown;
  }

  const value = loading.attribute.value;

  if (value.kind === 'dynamic') {
    return LAZY_LOADING_STATES.unknown;
  }

  if (
    value.kind === 'literal' &&
    typeof value.value === 'string' &&
    value.value.toLowerCase() === 'lazy'
  ) {
    return LAZY_LOADING_STATES.configured;
  }

  return LAZY_LOADING_STATES.review;
};

export const imgLazyLoadingRule: Rule = {
  evaluate: ({ model }) =>
    model.jsxNodes
      .filter((node) => isIntrinsicElement(node, 'img'))
      .filter((element) => classifyLazyLoading(element) === LAZY_LOADING_STATES.review)
      .map((element) => ({
        confidence: FINDING_CONFIDENCES.medium,
        location: element.location,
        message:
          'Image is not statically configured with loading="lazy"; review whether lazy loading is appropriate.',
      })),
  metadata: Object.freeze({
    category: RULE_CATEGORIES.performance,
    defaultSeverity: RULE_SEVERITIES.low,
    explanation:
      'An intrinsic image that is not configured for lazy loading may be fetched before it is needed and consume avoidable resources.',
    id: 'performance/img-lazy-loading',
    limitations: Object.freeze([
      'Static analysis cannot determine whether an image is above the fold or otherwise visually critical, so every finding is advisory.',
      'Missing, eager, and invalid literal loading values are reviewable; dynamic values and unresolved JSX spreads are treated as unknown.',
      'Custom image components, aliases, preload behavior, and runtime loading priorities are not inferred.',
    ]),
    recommendation:
      'For images that are not intentionally above the fold, set loading="lazy"; retain eager loading when visual priority requires it.',
    reference: Object.freeze({
      label: 'HTML Standard — Lazy loading attributes',
      url: 'https://html.spec.whatwg.org/multipage/urls-and-fetching.html#lazy-loading-attributes',
    }),
    status: RULE_STATUSES.stable,
    title: 'Image lazy loading',
  }),
};

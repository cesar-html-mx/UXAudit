import {
  JSX_ELEMENT_KINDS,
  JSX_NODE_KINDS,
  type JsxElement,
  type JsxNode,
} from '../../domain/models/analysis-model.js';
import { JSX_VALUE_CONFIDENCE, type JsxObjectProperty } from '../../domain/models/jsx-value.js';
import {
  FINDING_CONFIDENCES,
  RULE_CATEGORIES,
  RULE_SEVERITIES,
  RULE_STATUSES,
  type Rule,
} from '../../domain/rules/rule.js';
import { EFFECTIVE_ATTRIBUTE_STATES, resolveEffectiveAttribute } from '../jsx-elements.js';

export const DEFAULT_SMALL_INLINE_TEXT_THRESHOLD_PX = 12;

export interface SmallInlineTextRuleConfiguration {
  readonly thresholdPx?: number;
}

const invalidConfigurationMessage =
  'Small inline text thresholdPx must be a finite number greater than zero.';
const pixelValuePattern =
  /^[\t\n\f\r ]*([+-]?(?:(?:\d+(?:\.\d+)?)|(?:\.\d+))(?:e[+-]?\d+)?)px[\t\n\f\r ]*$/iu;
const nonRenderedTextElementNames = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'head',
  'hr',
  'iframe',
  'img',
  'input',
  'link',
  'meta',
  'noscript',
  'param',
  'script',
  'source',
  'style',
  'template',
  'title',
  'track',
  'wbr',
]);

const requireThresholdPx = (configuration: unknown): number => {
  if (typeof configuration !== 'object' || configuration === null || Array.isArray(configuration)) {
    throw new TypeError(invalidConfigurationMessage);
  }

  const prototype: unknown = Object.getPrototypeOf(configuration);

  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(invalidConfigurationMessage);
  }

  const keys = Reflect.ownKeys(configuration);

  if (keys.some((key) => key !== 'thresholdPx')) {
    throw new TypeError(invalidConfigurationMessage);
  }

  const descriptor = Object.getOwnPropertyDescriptor(configuration, 'thresholdPx');

  if (descriptor !== undefined && !('value' in descriptor)) {
    throw new TypeError(invalidConfigurationMessage);
  }

  const configuredThreshold = (descriptor as undefined | { readonly value?: unknown })?.value;
  const thresholdPx =
    configuredThreshold === undefined
      ? DEFAULT_SMALL_INLINE_TEXT_THRESHOLD_PX
      : configuredThreshold;

  if (typeof thresholdPx !== 'number' || !Number.isFinite(thresholdPx) || thresholdPx <= 0) {
    throw new TypeError(invalidConfigurationMessage);
  }

  return thresholdPx;
};

const readThresholdPx = (configuration: unknown): number => {
  try {
    return requireThresholdPx(configuration);
  } catch {
    throw new TypeError(invalidConfigurationMessage);
  }
};

const isIntrinsicElementWithKnownText = (node: JsxNode): node is JsxElement =>
  node.kind === JSX_NODE_KINDS.element &&
  node.elementKind === JSX_ELEMENT_KINDS.intrinsic &&
  !nonRenderedTextElementNames.has(node.name) &&
  node.textContent.confidence !== JSX_VALUE_CONFIDENCE.dynamic &&
  node.textContent.value.trim().length > 0;

const getEffectiveFontSizeProperty = (element: JsxElement): JsxObjectProperty | undefined => {
  const style = resolveEffectiveAttribute(element, 'style');

  if (style.state !== EFFECTIVE_ATTRIBUTE_STATES.known) {
    return undefined;
  }

  const styleValue = style.attribute.value;

  if (
    styleValue.kind !== 'object' ||
    styleValue.confidence !== JSX_VALUE_CONFIDENCE.exact ||
    styleValue.hasUnknownProperties
  ) {
    return undefined;
  }

  for (let index = styleValue.properties.length - 1; index >= 0; index -= 1) {
    const property = styleValue.properties[index];

    if (property?.name === 'fontSize') {
      return property;
    }
  }

  return undefined;
};

const parsePixelValue = (value: number | string): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  const match = pixelValuePattern.exec(value);
  const numericPart = match?.[1];

  if (numericPart === undefined) {
    return undefined;
  }

  const parsed = Number(numericPart);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getLiteralPixelValue = (property: JsxObjectProperty): number | undefined => {
  if (property.value.kind !== 'literal') {
    return undefined;
  }

  const value = property.value.value;
  return typeof value === 'number' || typeof value === 'string'
    ? parsePixelValue(value)
    : undefined;
};

export const createSmallInlineTextRule = (
  configuration: SmallInlineTextRuleConfiguration = {},
): Rule => {
  const thresholdPx = readThresholdPx(configuration);

  const rule: Rule = {
    evaluate: ({ model }) =>
      model.jsxNodes.flatMap((node) => {
        if (!isIntrinsicElementWithKnownText(node)) {
          return [];
        }

        const property = getEffectiveFontSizeProperty(node);

        if (property === undefined) {
          return [];
        }

        const fontSizePx = getLiteralPixelValue(property);

        if (fontSizePx === undefined || fontSizePx < 0 || fontSizePx >= thresholdPx) {
          return [];
        }

        return [
          {
            confidence:
              node.textContent.confidence === JSX_VALUE_CONFIDENCE.exact
                ? FINDING_CONFIDENCES.high
                : FINDING_CONFIDENCES.medium,
            location: property.location,
            message: 'Literal inline text may be too small.',
          },
        ];
      }),
    metadata: Object.freeze({
      category: RULE_CATEGORIES.ux,
      defaultSeverity: RULE_SEVERITIES.medium,
      explanation:
        'Text rendered with a very small literal inline pixel font size may be difficult to read.',
      id: 'ux/small-inline-text',
      limitations: Object.freeze([
        'External stylesheets, class names, inherited styles, and the rendered cascade are not evaluated.',
        'Dynamic styles, unresolved JSX spreads, and object styles with unknown properties are treated as unknown.',
        'Relative units, percentages, calculations, browser zoom, and user display settings are not resolved.',
        'Only intrinsic elements with retained non-empty static text are evaluated.',
        'Metadata, inert, void, and other intrinsically non-rendered text containers are excluded.',
      ]),
      recommendation: `Use an inline fontSize of at least ${String(
        thresholdPx,
      )}px, or define an equivalent readable size in the project style system.`,
      reference: null,
      status: RULE_STATUSES.stable,
      title: 'Very small literal inline text',
    }),
  };

  return Object.freeze(rule);
};

export const smallInlineTextRule: Rule = createSmallInlineTextRule();

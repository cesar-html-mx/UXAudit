import { JSX_VALUE_CONFIDENCE } from '../../domain/models/jsx-value.js';
import {
  FINDING_CONFIDENCES,
  RULE_CATEGORIES,
  RULE_SEVERITIES,
  RULE_STATUSES,
  type Rule,
} from '../../domain/rules/rule.js';
import { isIntrinsicElement } from '../jsx-elements.js';

export const DEFAULT_AMBIGUOUS_LINK_TEXTS: readonly string[] = Object.freeze([
  'click here',
  'here',
  'read more',
  'aquí',
  'ver más',
]);

export const AMBIGUOUS_LINK_TEXT_CONFIGURATION_ERROR_CODES = Object.freeze({
  invalidConfiguration: 'AMBIGUOUS_LINK_TEXT_INVALID_CONFIGURATION',
} as const);

export type AmbiguousLinkTextConfigurationErrorCode =
  (typeof AMBIGUOUS_LINK_TEXT_CONFIGURATION_ERROR_CODES)[keyof typeof AMBIGUOUS_LINK_TEXT_CONFIGURATION_ERROR_CODES];

const configurationErrorMessage = 'Ambiguous link text rule configuration is invalid.';

export class AmbiguousLinkTextConfigurationError extends Error {
  public readonly code: AmbiguousLinkTextConfigurationErrorCode;

  public constructor() {
    super(configurationErrorMessage);
    this.name = 'AmbiguousLinkTextConfigurationError';
    this.code = AMBIGUOUS_LINK_TEXT_CONFIGURATION_ERROR_CODES.invalidConfiguration;
  }
}

export interface AmbiguousLinkTextRuleOptions {
  readonly ambiguousTexts?: readonly string[];
}

const normalizeLinkText = (value: string): string =>
  value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase();

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireDenseStringArray = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) {
    throw new AmbiguousLinkTextConfigurationError();
  }

  const prototype: unknown = Object.getPrototypeOf(value);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  const lengthValue = (lengthDescriptor as undefined | { readonly value?: unknown })?.value;
  const ownKeys = Reflect.ownKeys(value);

  if (
    prototype !== Array.prototype ||
    typeof lengthValue !== 'number' ||
    !Number.isSafeInteger(lengthValue) ||
    lengthValue <= 0 ||
    ownKeys.length !== lengthValue + 1 ||
    ownKeys.some(
      (key) =>
        key !== 'length' &&
        (typeof key !== 'string' || !/^(?:0|[1-9]\d*)$/u.test(key) || Number(key) >= lengthValue),
    )
  ) {
    throw new AmbiguousLinkTextConfigurationError();
  }

  const strings: string[] = [];

  for (let index = 0; index < lengthValue; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    const item = (descriptor as undefined | { readonly value?: unknown })?.value;

    if (descriptor === undefined || !('value' in descriptor) || typeof item !== 'string') {
      throw new AmbiguousLinkTextConfigurationError();
    }

    strings.push(item);
  }

  return strings;
};

const requireAmbiguousTexts = (options: unknown): ReadonlySet<string> => {
  if (!isRecord(options)) {
    throw new AmbiguousLinkTextConfigurationError();
  }

  const prototype: unknown = Object.getPrototypeOf(options);
  const ownKeys = Reflect.ownKeys(options);

  if (
    (prototype !== Object.prototype && prototype !== null) ||
    ownKeys.some((key) => key !== 'ambiguousTexts')
  ) {
    throw new AmbiguousLinkTextConfigurationError();
  }

  const descriptor = Object.getOwnPropertyDescriptor(options, 'ambiguousTexts');

  if (descriptor !== undefined && !('value' in descriptor)) {
    throw new AmbiguousLinkTextConfigurationError();
  }

  const configuredValue = (descriptor as undefined | { readonly value?: unknown })?.value;
  const configured =
    descriptor === undefined || configuredValue === undefined
      ? DEFAULT_AMBIGUOUS_LINK_TEXTS
      : requireDenseStringArray(configuredValue);
  const normalized = configured.map(normalizeLinkText);

  if (normalized.some((value) => value.length === 0)) {
    throw new AmbiguousLinkTextConfigurationError();
  }

  return new Set(normalized);
};

const readAmbiguousTexts = (options: unknown): ReadonlySet<string> => {
  try {
    return requireAmbiguousTexts(options);
  } catch {
    throw new AmbiguousLinkTextConfigurationError();
  }
};

export const createAmbiguousLinkTextRule = (options: AmbiguousLinkTextRuleOptions = {}): Rule => {
  const ambiguousTexts = readAmbiguousTexts(options);

  return {
    evaluate: ({ model }) =>
      model.jsxNodes
        .filter((node) => isIntrinsicElement(node, 'a'))
        .filter(
          (element) =>
            element.textContent.confidence === JSX_VALUE_CONFIDENCE.exact &&
            ambiguousTexts.has(normalizeLinkText(element.textContent.value)),
        )
        .map((element) => ({
          confidence: FINDING_CONFIDENCES.medium,
          location: element.location,
          message: 'Link uses configured ambiguous static text and needs contextual review.',
        })),
    metadata: Object.freeze({
      category: RULE_CATEGORIES.seo,
      defaultSeverity: RULE_SEVERITIES.medium,
      explanation:
        'Generic link text can obscure the destination when the link is considered without its surrounding context.',
      id: 'seo/ambiguous-link-text',
      limitations: Object.freeze([
        'Only exact retained text on intrinsic links is compared; partial and dynamic text are not reported.',
        'Custom link components and their rendered output are not inferred.',
        'Surrounding content, ARIA naming, destination URLs, and visual context are not evaluated.',
      ]),
      recommendation:
        'Use visible link text that identifies the destination or purpose, and review its surrounding accessible context.',
      reference: null,
      status: RULE_STATUSES.stable,
      title: 'Ambiguous link text',
    }),
  };
};

export const ambiguousLinkTextRule: Rule = createAmbiguousLinkTextRule();

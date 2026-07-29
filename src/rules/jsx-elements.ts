import {
  JSX_ATTRIBUTE_KINDS,
  JSX_ELEMENT_KINDS,
  JSX_NODE_KINDS,
  type JsxElement,
  type JsxNamedAttribute,
  type JsxNode,
} from '../domain/models/analysis-model.js';

export const EFFECTIVE_ATTRIBUTE_STATES = Object.freeze({
  absent: 'absent',
  known: 'known',
  unknown: 'unknown',
} as const);

export type EffectiveAttribute =
  | {
      readonly state: typeof EFFECTIVE_ATTRIBUTE_STATES.absent;
    }
  | {
      readonly attribute: JsxNamedAttribute;
      readonly state: typeof EFFECTIVE_ATTRIBUTE_STATES.known;
    }
  | {
      readonly state: typeof EFFECTIVE_ATTRIBUTE_STATES.unknown;
    };

export const isIntrinsicElement = (node: JsxNode, name: string): node is JsxElement =>
  node.kind === JSX_NODE_KINDS.element &&
  node.elementKind === JSX_ELEMENT_KINDS.intrinsic &&
  node.name === name;

/**
 * Resolves one JSX attribute without evaluating a spread.
 *
 * Scanning from right to left models JSX override order: a named attribute
 * found before a spread is known; a later spread makes an earlier value
 * unknowable.
 */
export const resolveEffectiveAttribute = (
  element: JsxElement,
  name: string,
): EffectiveAttribute => {
  for (let index = element.attributes.length - 1; index >= 0; index -= 1) {
    const attribute = element.attributes[index];

    if (attribute === undefined) {
      continue;
    }

    if (attribute.kind === JSX_ATTRIBUTE_KINDS.spread) {
      return { state: EFFECTIVE_ATTRIBUTE_STATES.unknown };
    }

    if (attribute.name === name) {
      return {
        attribute,
        state: EFFECTIVE_ATTRIBUTE_STATES.known,
      };
    }
  }

  return { state: EFFECTIVE_ATTRIBUTE_STATES.absent };
};

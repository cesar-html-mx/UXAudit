import type { SourceLocation } from './source-location.js';

export const JSX_VALUE_CONFIDENCE = Object.freeze({
  dynamic: 'dynamic',
  exact: 'exact',
  partial: 'partial',
} as const);

export type JsxValueConfidence = (typeof JSX_VALUE_CONFIDENCE)[keyof typeof JSX_VALUE_CONFIDENCE];

export type JsxPrimitiveValue = boolean | null | number | string;

export interface JsxLiteralValue {
  readonly confidence: typeof JSX_VALUE_CONFIDENCE.exact;
  readonly kind: 'literal';
  readonly value: JsxPrimitiveValue;
}

export interface JsxDynamicValue {
  readonly confidence: typeof JSX_VALUE_CONFIDENCE.dynamic;
  readonly kind: 'dynamic';
}

export interface JsxObjectProperty {
  readonly location: SourceLocation;
  readonly name: string;
  readonly value: JsxAttributeValue;
}

/**
 * A conservatively extracted object expression.
 *
 * `hasUnknownProperties` records spreads, computed keys, or other entries that
 * cannot be represented without evaluating source code.
 */
export interface JsxObjectValue {
  readonly confidence: typeof JSX_VALUE_CONFIDENCE.exact | typeof JSX_VALUE_CONFIDENCE.partial;
  readonly hasUnknownProperties: boolean;
  readonly kind: 'object';
  readonly properties: readonly JsxObjectProperty[];
}

export type JsxAttributeValue = JsxDynamicValue | JsxLiteralValue | JsxObjectValue;

/**
 * Static text retained from a JSX subtree.
 *
 * An exact value has no unresolved contributors. A partial value combines
 * known text with unresolved content. A dynamic value has no dependable
 * static representation.
 */
export interface JsxTextContent {
  readonly confidence: JsxValueConfidence;
  readonly value: string;
}

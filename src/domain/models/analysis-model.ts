import type { JsxAttributeValue, JsxTextContent } from './jsx-value.js';
import type { SourceLocation } from './source-location.js';

export const ANALYZED_SOURCE_LANGUAGES = Object.freeze({
  javascript: 'javascript',
  typescript: 'typescript',
} as const);

export type AnalyzedSourceLanguage =
  (typeof ANALYZED_SOURCE_LANGUAGES)[keyof typeof ANALYZED_SOURCE_LANGUAGES];

export const COMPONENT_KINDS = Object.freeze({
  arrowFunction: 'arrow-function',
  class: 'class',
  function: 'function',
} as const);

export type ComponentKind = (typeof COMPONENT_KINDS)[keyof typeof COMPONENT_KINDS];

export const JSX_ATTRIBUTE_KINDS = Object.freeze({
  named: 'named',
  spread: 'spread',
} as const);

export const JSX_ELEMENT_KINDS = Object.freeze({
  custom: 'custom',
  intrinsic: 'intrinsic',
} as const);

export type JsxElementKind = (typeof JSX_ELEMENT_KINDS)[keyof typeof JSX_ELEMENT_KINDS];

export const JSX_NODE_KINDS = Object.freeze({
  element: 'element',
  fragment: 'fragment',
} as const);

export interface JsxNamedAttribute {
  readonly kind: typeof JSX_ATTRIBUTE_KINDS.named;
  readonly location: SourceLocation;
  readonly name: string;
  readonly value: JsxAttributeValue;
}

export interface JsxSpreadAttribute {
  readonly kind: typeof JSX_ATTRIBUTE_KINDS.spread;
  readonly location: SourceLocation;
}

export type JsxAttribute = JsxNamedAttribute | JsxSpreadAttribute;

interface JsxNodeBase {
  readonly childNodeIds: readonly string[];
  readonly componentId: null | string;
  readonly id: string;
  readonly location: SourceLocation;
  readonly parentNodeId: null | string;
  readonly textContent: JsxTextContent;
}

export interface JsxElement extends JsxNodeBase {
  readonly attributes: readonly JsxAttribute[];
  readonly elementKind: JsxElementKind;
  readonly kind: typeof JSX_NODE_KINDS.element;
  readonly name: string;
}

export interface JsxFragment extends JsxNodeBase {
  readonly kind: typeof JSX_NODE_KINDS.fragment;
}

export type JsxNode = JsxElement | JsxFragment;

export interface AnalyzedComponent {
  readonly id: string;
  readonly jsxNodeIds: readonly string[];
  readonly kind: ComponentKind;
  readonly location: SourceLocation;
  readonly name: null | string;
  readonly rootJsxNodeIds: readonly string[];
}

export interface AnalyzedFile {
  readonly componentIds: readonly string[];
  readonly filePath: string;
  readonly jsxNodeIds: readonly string[];
  readonly language: AnalyzedSourceLanguage;
  readonly location: SourceLocation;
  readonly usesJsx: boolean;
}

/**
 * The successful, normalized analysis of one source file.
 *
 * This is the direct per-file input expected by the future project model
 * builder. Arrays use source order and contain no parser-specific nodes.
 */
export interface AnalyzedSourceFile {
  readonly components: readonly AnalyzedComponent[];
  readonly file: AnalyzedFile;
  readonly jsxNodes: readonly JsxNode[];
}

/**
 * The rule-facing project model.
 *
 * Implementations sort files by portable file path and source entities by
 * their start offset, using IDs only as a deterministic tie-breaker.
 */
export interface AnalysisModel {
  readonly components: readonly AnalyzedComponent[];
  readonly files: readonly AnalyzedFile[];
  readonly jsxNodes: readonly JsxNode[];
}

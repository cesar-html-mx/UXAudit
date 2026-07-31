import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  ANALYZED_SOURCE_LANGUAGES,
  COMPONENT_KINDS,
  JSX_ATTRIBUTE_KINDS,
  JSX_ELEMENT_KINDS,
  JSX_NODE_KINDS,
  type AnalysisModel,
  type AnalyzedSourceFile,
  type JsxElement,
  type JsxFragment,
} from '../../../src/domain/models/analysis-model.js';
import {
  JSX_VALUE_CONFIDENCE,
  type JsxAttributeValue,
} from '../../../src/domain/models/jsx-value.js';
import type { SourceLocation } from '../../../src/domain/models/source-location.js';

const filePath = 'src/App.tsx';
const elementLocation: SourceLocation = {
  end: { column: 31, line: 3, offset: 74 },
  filePath,
  start: { column: 2, line: 3, offset: 45 },
};
const fragmentLocation: SourceLocation = {
  end: { column: 4, line: 5, offset: 91 },
  filePath,
  start: { column: 0, line: 2, offset: 30 },
};

describe('analysis model contracts', () => {
  it('represents a flat file, component, element, fragment, and relationship model', () => {
    const styleValue: JsxAttributeValue = {
      confidence: JSX_VALUE_CONFIDENCE.partial,
      hasUnknownProperties: true,
      kind: 'object',
      properties: [
        {
          location: elementLocation,
          name: 'fontSize',
          value: {
            confidence: JSX_VALUE_CONFIDENCE.exact,
            kind: 'literal',
            value: 11,
          },
        },
      ],
    };
    const element: JsxElement = {
      attributes: [
        {
          kind: JSX_ATTRIBUTE_KINDS.named,
          location: elementLocation,
          name: 'style',
          value: styleValue,
        },
        {
          kind: JSX_ATTRIBUTE_KINDS.spread,
          location: elementLocation,
        },
      ],
      childNodeIds: [],
      componentId: 'component:src/App.tsx:0',
      elementKind: JSX_ELEMENT_KINDS.intrinsic,
      id: 'jsx:src/App.tsx:45',
      kind: JSX_NODE_KINDS.element,
      location: elementLocation,
      name: 'button',
      parentNodeId: 'jsx:src/App.tsx:30',
      textContent: {
        confidence: JSX_VALUE_CONFIDENCE.exact,
        value: 'Save',
      },
    };
    const fragment: JsxFragment = {
      childNodeIds: [element.id],
      componentId: 'component:src/App.tsx:0',
      id: 'jsx:src/App.tsx:30',
      kind: JSX_NODE_KINDS.fragment,
      location: fragmentLocation,
      parentNodeId: null,
      textContent: {
        confidence: JSX_VALUE_CONFIDENCE.partial,
        value: 'Save',
      },
    };
    const analyzedFile: AnalyzedSourceFile = {
      componentExports: [
        {
          componentId: 'component:src/App.tsx:0',
          exportedName: 'App',
        },
      ],
      componentUses: [],
      components: [
        {
          id: 'component:src/App.tsx:0',
          jsxNodeIds: [fragment.id, element.id],
          kind: COMPONENT_KINDS.arrowFunction,
          location: {
            end: { column: 2, line: 6, offset: 94 },
            filePath,
            start: { column: 0, line: 1, offset: 0 },
          },
          name: 'App',
          rootJsxNodeIds: [fragment.id],
        },
      ],
      file: {
        componentIds: ['component:src/App.tsx:0'],
        filePath,
        jsxNodeIds: [fragment.id, element.id],
        language: ANALYZED_SOURCE_LANGUAGES.typescript,
        location: {
          end: { column: 0, line: 7, offset: 95 },
          filePath,
          start: { column: 0, line: 1, offset: 0 },
        },
        usesJsx: true,
      },
      jsxNodes: [fragment, element],
    };
    const model: AnalysisModel = {
      componentLinks: [],
      components: analyzedFile.components,
      files: [analyzedFile.file],
      jsxNodes: analyzedFile.jsxNodes,
    };

    expect(model.files[0]).toMatchObject({
      filePath,
      language: 'typescript',
      usesJsx: true,
    });
    expect(model.components[0]?.rootJsxNodeIds).toEqual([fragment.id]);
    expect(model.componentLinks).toEqual([]);
    expect(model.jsxNodes.map((node) => node.id)).toEqual([fragment.id, element.id]);
    expect(element.attributes.map((attribute) => attribute.kind)).toEqual(['named', 'spread']);
    expect(styleValue).toMatchObject({
      confidence: 'partial',
      hasUnknownProperties: true,
      kind: 'object',
    });
    expectTypeOf(model.files).toExtend<readonly AnalysisModel['files'][number][]>();
    expectTypeOf(analyzedFile.componentExports).toExtend<
      readonly AnalyzedSourceFile['componentExports'][number][]
    >();
    expectTypeOf(analyzedFile).toExtend<AnalyzedSourceFile>();
  });

  it('distinguishes intrinsic and custom elements without parser-specific data', () => {
    const intrinsic: JsxElement = {
      attributes: [],
      childNodeIds: [],
      componentId: null,
      elementKind: JSX_ELEMENT_KINDS.intrinsic,
      id: 'jsx:src/App.tsx:45',
      kind: JSX_NODE_KINDS.element,
      location: elementLocation,
      name: 'img',
      parentNodeId: null,
      textContent: {
        confidence: JSX_VALUE_CONFIDENCE.exact,
        value: '',
      },
    };
    const custom: JsxElement = {
      ...intrinsic,
      elementKind: JSX_ELEMENT_KINDS.custom,
      id: 'jsx:src/App.tsx:75',
      name: 'UI.Image',
    };

    expect(intrinsic.elementKind).toBe('intrinsic');
    expect(custom.elementKind).toBe('custom');
    expect(custom.name).toBe('UI.Image');
    expect(Object.keys(custom)).not.toContain('ast');
  });
});

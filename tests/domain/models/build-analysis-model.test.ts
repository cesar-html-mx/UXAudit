import { describe, expect, it } from 'vitest';

import {
  createComponentId,
  createJsxNodeId,
} from '../../../src/domain/models/analysis-model-ids.js';
import {
  ANALYZED_SOURCE_LANGUAGES,
  COMPONENT_KINDS,
  JSX_ATTRIBUTE_KINDS,
  JSX_ELEMENT_KINDS,
  JSX_NODE_KINDS,
  type AnalyzedComponent,
  type AnalyzedSourceFile,
  type JsxElement,
  type JsxNode,
} from '../../../src/domain/models/analysis-model.js';
import {
  AnalysisModelInvariantError,
  buildAnalysisModel,
} from '../../../src/domain/models/build-analysis-model.js';
import {
  JSX_VALUE_CONFIDENCE,
  type JsxAttributeValue,
  type JsxObjectValue,
} from '../../../src/domain/models/jsx-value.js';
import type { SourceLocation } from '../../../src/domain/models/source-location.js';

interface ModelFixture {
  readonly analyzedFile: AnalyzedSourceFile;
  readonly buttonNodeId: string;
  readonly componentId: string;
  readonly customNodeId: string;
  readonly rootNodeId: string;
}

const location = (filePath: string, start: number, end: number): SourceLocation => ({
  end: {
    column: end,
    line: 1,
    offset: end,
  },
  filePath,
  start: {
    column: start,
    line: 1,
    offset: start,
  },
});

const exactLiteral = (value: boolean | null | number | string): JsxAttributeValue => ({
  confidence: JSX_VALUE_CONFIDENCE.exact,
  kind: 'literal',
  value,
});

const createModelFixture = (filePath: string): ModelFixture => {
  const componentId = createComponentId(filePath, 10);
  const rootNodeId = createJsxNodeId(filePath, 20);
  const buttonNodeId = createJsxNodeId(filePath, 30);
  const customNodeId = createJsxNodeId(filePath, 120);
  const styleValue: JsxObjectValue = {
    confidence: JSX_VALUE_CONFIDENCE.exact,
    hasUnknownProperties: false,
    kind: 'object',
    properties: [
      {
        location: location(filePath, 50, 55),
        name: 'zIndex',
        value: exactLiteral(2),
      },
      {
        location: location(filePath, 60, 68),
        name: 'fontSize',
        value: exactLiteral(11),
      },
    ],
  };
  const rootNode: JsxNode = {
    childNodeIds: [buttonNodeId, customNodeId],
    componentId,
    id: rootNodeId,
    kind: JSX_NODE_KINDS.fragment,
    location: location(filePath, 20, 220),
    parentNodeId: null,
    textContent: {
      confidence: JSX_VALUE_CONFIDENCE.partial,
      value: 'Save',
    },
  };
  const buttonNode: JsxElement = {
    attributes: [
      {
        kind: JSX_ATTRIBUTE_KINDS.spread,
        location: location(filePath, 34, 38),
      },
      {
        kind: JSX_ATTRIBUTE_KINDS.named,
        location: location(filePath, 40, 80),
        name: 'style',
        value: styleValue,
      },
      {
        kind: JSX_ATTRIBUTE_KINDS.named,
        location: location(filePath, 82, 90),
        name: 'title',
        value: {
          confidence: JSX_VALUE_CONFIDENCE.dynamic,
          kind: 'dynamic',
        },
      },
    ],
    childNodeIds: [],
    componentId,
    elementKind: JSX_ELEMENT_KINDS.intrinsic,
    id: buttonNodeId,
    kind: JSX_NODE_KINDS.element,
    location: location(filePath, 30, 100),
    name: 'button',
    parentNodeId: rootNodeId,
    textContent: {
      confidence: JSX_VALUE_CONFIDENCE.exact,
      value: 'Save',
    },
  };
  const customNode: JsxElement = {
    attributes: [],
    childNodeIds: [],
    componentId,
    elementKind: JSX_ELEMENT_KINDS.custom,
    id: customNodeId,
    kind: JSX_NODE_KINDS.element,
    location: location(filePath, 120, 180),
    name: 'UI.Icon',
    parentNodeId: rootNodeId,
    textContent: {
      confidence: JSX_VALUE_CONFIDENCE.dynamic,
      value: '',
    },
  };
  const component: AnalyzedComponent = {
    id: componentId,
    jsxNodeIds: [rootNodeId, buttonNodeId, customNodeId],
    kind: COMPONENT_KINDS.arrowFunction,
    location: location(filePath, 10, 250),
    name: 'Panel',
    rootJsxNodeIds: [rootNodeId],
  };

  return {
    analyzedFile: {
      components: [component],
      file: {
        componentIds: [componentId],
        filePath,
        jsxNodeIds: [rootNodeId, buttonNodeId, customNodeId],
        language: ANALYZED_SOURCE_LANGUAGES.typescript,
        location: location(filePath, 0, 300),
        usesJsx: true,
      },
      jsxNodes: [rootNode, buttonNode, customNode],
    },
    buttonNodeId,
    componentId,
    customNodeId,
    rootNodeId,
  };
};

const createEmptyFile = (filePath = 'src/empty.ts'): AnalyzedSourceFile => ({
  components: [],
  file: {
    componentIds: [],
    filePath,
    jsxNodeIds: [],
    language: ANALYZED_SOURCE_LANGUAGES.typescript,
    location: location(filePath, 0, 20),
    usesJsx: false,
  },
  jsxNodes: [],
});

const cloneFile = (analyzedFile: AnalyzedSourceFile): AnalyzedSourceFile =>
  structuredClone(analyzedFile);

const setProperty = (target: object, property: PropertyKey, value: unknown): void => {
  if (!Reflect.set(target, property, value)) {
    throw new TypeError(`Test fixture property could not be set: ${String(property)}`);
  }
};

const requireNode = (analyzedFile: AnalyzedSourceFile, id: string): JsxNode => {
  const node = analyzedFile.jsxNodes.find((candidate) => candidate.id === id);

  if (node === undefined) {
    throw new TypeError(`Missing test JSX node: ${id}`);
  }

  return node;
};

const requireElement = (analyzedFile: AnalyzedSourceFile, id: string): JsxElement => {
  const node = requireNode(analyzedFile, id);

  if (node.kind !== JSX_NODE_KINDS.element) {
    throw new TypeError(`Expected test JSX element: ${id}`);
  }

  return node;
};

const requireStyleValue = (analyzedFile: AnalyzedSourceFile, nodeId: string): JsxObjectValue => {
  const node = requireElement(analyzedFile, nodeId);
  const attribute = node.attributes.find(
    (candidate) => candidate.kind === JSX_ATTRIBUTE_KINDS.named,
  );

  if (attribute?.value.kind !== 'object') {
    throw new TypeError('Missing test style object.');
  }

  return attribute.value;
};

const corruptFixture = (
  fixture: ModelFixture,
  mutate: (analyzedFile: AnalyzedSourceFile) => void,
): AnalyzedSourceFile => {
  const analyzedFile = cloneFile(fixture.analyzedFile);
  mutate(analyzedFile);
  return analyzedFile;
};

const captureInvariant = (
  analyzedFiles: readonly AnalyzedSourceFile[],
): AnalysisModelInvariantError => {
  let thrownError: unknown;

  try {
    buildAnalysisModel(analyzedFiles);
  } catch (error) {
    thrownError = error;
  }

  expect(thrownError).toBeInstanceOf(AnalysisModelInvariantError);

  if (!(thrownError instanceof AnalysisModelInvariantError)) {
    throw new TypeError('Expected a stable analysis-model invariant error.');
  }

  return thrownError;
};

const invariantSignature = (
  error: AnalysisModelInvariantError,
): {
  readonly code: string;
  readonly message: string;
  readonly name: string;
} => ({
  code: error.code,
  message: error.message,
  name: error.name,
});

const expectedInvariantSignature = {
  code: 'ANALYSIS_MODEL_INVARIANT_FAILED',
  message: 'Analysis model construction reached an invalid internal state.',
  name: 'AnalysisModelInvariantError',
};

describe('buildAnalysisModel', () => {
  it('builds the canonical empty project model', () => {
    expect(buildAnalysisModel([])).toEqual({
      components: [],
      files: [],
      jsxNodes: [],
    });
  });

  it('orders reverse multi-file input and every global entity deterministically', () => {
    const alpha = createModelFixture('src/alpha.tsx');
    const zeta = createModelFixture('src/zeta.tsx');
    const forward = buildAnalysisModel([alpha.analyzedFile, zeta.analyzedFile]);
    const reverse = buildAnalysisModel([zeta.analyzedFile, alpha.analyzedFile]);

    expect(JSON.stringify(reverse)).toBe(JSON.stringify(forward));
    expect(reverse.files.map((file) => file.filePath)).toEqual(['src/alpha.tsx', 'src/zeta.tsx']);
    expect(reverse.components.map((component) => component.id)).toEqual([
      alpha.componentId,
      zeta.componentId,
    ]);
    expect(reverse.jsxNodes.map((node) => node.id)).toEqual([
      alpha.rootNodeId,
      alpha.buttonNodeId,
      alpha.customNodeId,
      zeta.rootNodeId,
      zeta.buttonNodeId,
      zeta.customNodeId,
    ]);
  });

  it('preserves hostile filename characters as untrusted model data', () => {
    const filePath = 'src/control\u000a\u202e.tsx';
    const fixture = createModelFixture(filePath);
    const model = buildAnalysisModel([fixture.analyzedFile]);

    expect(model.files[0]?.filePath).toBe(filePath);
    expect(model.components[0]?.location.filePath).toBe(filePath);
    expect(model.jsxNodes[0]?.location.filePath).toBe(filePath);
  });

  it('projects deeply without mutating or retaining parser/source extras', () => {
    const fixture = createModelFixture('src/projected.tsx');
    const componentIds = [...fixture.analyzedFile.file.componentIds];
    const childNodeIds = [...requireNode(fixture.analyzedFile, fixture.rootNodeId).childNodeIds];
    const unsafeInput = {
      ast: { type: 'File' },
      components: fixture.analyzedFile.components.map((component) => ({
        ...component,
        ast: { type: 'Function' },
      })),
      file: {
        ...fixture.analyzedFile.file,
        ast: { type: 'Program' },
        componentIds,
        source: 'PRIVATE_SOURCE_SENTINEL',
      },
      jsxNodes: fixture.analyzedFile.jsxNodes.map((node) =>
        node.id === fixture.rootNodeId
          ? {
              ...node,
              ast: { type: 'JSXFragment' },
              childNodeIds,
              source: '<private />',
            }
          : {
              ...node,
              ast: { type: 'JSXElement' },
            },
      ),
      source: 'PRIVATE_SOURCE_SENTINEL',
    };
    const unsafeStyle = requireStyleValue(unsafeInput, fixture.buttonNodeId);
    setProperty(unsafeStyle, 'ast', { type: 'ObjectExpression' });
    setProperty(unsafeStyle.properties[0] ?? {}, 'source', 'PRIVATE_SOURCE_SENTINEL');
    setProperty(unsafeStyle.properties[0]?.value ?? {}, 'ast', { type: 'NumericLiteral' });
    const before = structuredClone(unsafeInput);
    const model = buildAnalysisModel([unsafeInput]);

    expect(unsafeInput).toEqual(before);
    expect(model.files[0]).not.toBe(unsafeInput.file);
    expect(model.components[0]).not.toBe(unsafeInput.components[0]);
    expect(model.jsxNodes[0]).not.toBe(unsafeInput.jsxNodes[0]);
    expect(JSON.stringify(model)).not.toContain('ast');
    expect(JSON.stringify(model)).not.toContain('source');
    expect(JSON.stringify(model)).not.toContain('PRIVATE_SOURCE_SENTINEL');

    componentIds.push('component:private:999');
    childNodeIds.reverse();

    expect(model.files[0]?.componentIds).toEqual([fixture.componentId]);
    expect(model.jsxNodes[0]?.childNodeIds).toEqual([fixture.buttonNodeId, fixture.customNodeId]);
  });

  it('preserves source order for attributes and structured object properties', () => {
    const fixture = createModelFixture('src/order.tsx');
    const model = buildAnalysisModel([fixture.analyzedFile]);
    const button = model.jsxNodes.find((node) => node.id === fixture.buttonNodeId);

    expect(button?.kind).toBe(JSX_NODE_KINDS.element);

    if (button?.kind !== JSX_NODE_KINDS.element) {
      throw new TypeError('Expected the projected button.');
    }

    expect(button.attributes.map((attribute) => attribute.kind)).toEqual([
      'spread',
      'named',
      'named',
    ]);
    const style = button.attributes[1];
    expect(style?.kind).toBe(JSX_ATTRIBUTE_KINDS.named);

    if (style?.kind !== JSX_ATTRIBUTE_KINDS.named || style.value.kind !== 'object') {
      throw new TypeError('Expected the projected style object.');
    }

    expect(style.value.properties.map((property) => property.name)).toEqual(['zIndex', 'fontSize']);
    expect(style.value).not.toBe(requireStyleValue(fixture.analyzedFile, fixture.buttonNodeId));
    expect(style.value.properties[0]).not.toBe(
      requireStyleValue(fixture.analyzedFile, fixture.buttonNodeId).properties[0],
    );
  });

  it('keeps prototype-sensitive property names as inert projected data', () => {
    const fixture = createModelFixture('src/prototype-data.tsx');
    const style = requireStyleValue(fixture.analyzedFile, fixture.buttonNodeId);
    setProperty(style.properties[0] ?? {}, 'name', '__proto__');
    setProperty(style.properties[1] ?? {}, 'name', 'constructor');
    const prototypeBefore = Object.getOwnPropertyDescriptors(Object.prototype);
    const model = buildAnalysisModel([fixture.analyzedFile]);
    const projectedStyle = requireStyleValue(
      {
        components: model.components,
        file: model.files[0] ?? fixture.analyzedFile.file,
        jsxNodes: model.jsxNodes,
      },
      fixture.buttonNodeId,
    );

    expect(projectedStyle.properties.map((property) => property.name)).toEqual([
      '__proto__',
      'constructor',
    ]);
    expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(prototypeBefore);
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('rejects duplicate files, component IDs, and JSX IDs with one stable error', () => {
    const fixture = createModelFixture('src/duplicates.tsx');
    const duplicateComponent = corruptFixture(fixture, (analyzedFile) => {
      setProperty(analyzedFile, 'components', [
        ...analyzedFile.components,
        structuredClone(analyzedFile.components[0]),
      ]);
      setProperty(analyzedFile.file, 'componentIds', [fixture.componentId, fixture.componentId]);
    });
    const duplicateNode = corruptFixture(fixture, (analyzedFile) => {
      const duplicate = structuredClone(requireNode(analyzedFile, fixture.customNodeId));
      setProperty(analyzedFile, 'jsxNodes', [...analyzedFile.jsxNodes, duplicate]);
      setProperty(analyzedFile.file, 'jsxNodeIds', [
        ...analyzedFile.file.jsxNodeIds,
        fixture.customNodeId,
      ]);
    });
    const cases: readonly (readonly [string, readonly AnalyzedSourceFile[]])[] = [
      ['duplicate file', [fixture.analyzedFile, cloneFile(fixture.analyzedFile)]],
      ['duplicate component ID', [duplicateComponent]],
      ['duplicate JSX ID', [duplicateNode]],
    ];

    for (const [caseName, analyzedFiles] of cases) {
      expect(invariantSignature(captureInvariant(analyzedFiles)), caseName).toEqual(
        expectedInvariantSignature,
      );
    }
  });

  it.each([
    '',
    '/private/App.tsx',
    'C:/private/App.tsx',
    './src/App.tsx',
    'src/../App.tsx',
    'src/./App.tsx',
    'src//App.tsx',
    'src\\App.tsx',
  ])('rejects the non-portable or non-canonical path %j', (filePath) => {
    expect(
      invariantSignature(captureInvariant([createModelFixture(filePath).analyzedFile])),
    ).toEqual(expectedInvariantSignature);
  });

  it('rejects invalid source ranges and location file mismatches', () => {
    const fixture = createModelFixture('src/locations.tsx');
    const cases = [
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.file.location.start, 'offset', -1);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.file.location.start, 'line', 0);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.file.location.end, 'column', 1.5);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.file.location.end, 'offset', -1);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.components[0]?.location.start ?? {}, 'column', 9);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.components[0]?.location ?? {}, 'filePath', 'src/other.tsx');
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(
          requireNode(analyzedFile, fixture.buttonNodeId).location,
          'filePath',
          'other.tsx',
        );
      }),
    ];

    for (const invalid of cases) {
      expect(invariantSignature(captureInvariant([invalid]))).toEqual(expectedInvariantSignature);
    }
  });

  it('rejects locations outside their file, owner, parent, attribute, or object container', () => {
    const fixture = createModelFixture('src/containment.tsx');
    const cases = [
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.components[0]?.location.end ?? {}, 'offset', 301);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(requireNode(analyzedFile, fixture.rootNodeId).location.end, 'offset', 301);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.components[0]?.location.end ?? {}, 'offset', 25);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(requireNode(analyzedFile, fixture.buttonNodeId).location.end, 'offset', 221);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        const element = requireElement(analyzedFile, fixture.buttonNodeId);
        setProperty(element.attributes[1]?.location.end ?? {}, 'offset', 101);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        const style = requireStyleValue(analyzedFile, fixture.buttonNodeId);
        setProperty(style.properties[0]?.location.end ?? {}, 'offset', 81);
      }),
    ];

    for (const invalid of cases) {
      expect(invariantSignature(captureInvariant([invalid]))).toEqual(expectedInvariantSignature);
    }
  });

  it('rejects non-canonical component and JSX IDs', () => {
    const fixture = createModelFixture('src/ids.tsx');
    const componentId = corruptFixture(fixture, (analyzedFile) => {
      setProperty(analyzedFile.components[0] ?? {}, 'id', 'component:src/ids.tsx:999');
    });
    const jsxId = corruptFixture(fixture, (analyzedFile) => {
      setProperty(requireNode(analyzedFile, fixture.buttonNodeId), 'id', 'jsx:src/ids.tsx:999');
    });

    expect(invariantSignature(captureInvariant([componentId]))).toEqual(expectedInvariantSignature);
    expect(invariantSignature(captureInvariant([jsxId]))).toEqual(expectedInvariantSignature);
  });

  it('rejects file membership arrays that are missing, extra, duplicated, or out of order', () => {
    const fixture = createModelFixture('src/file-arrays.tsx');
    const cases = [
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.file, 'componentIds', []);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.file, 'componentIds', [
          fixture.componentId,
          'component:src/file-arrays.tsx:999',
        ]);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.file, 'jsxNodeIds', [fixture.rootNodeId, fixture.buttonNodeId]);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.file, 'jsxNodeIds', [
          fixture.buttonNodeId,
          fixture.rootNodeId,
          fixture.customNodeId,
        ]);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.file, 'jsxNodeIds', [
          ...analyzedFile.file.jsxNodeIds,
          fixture.customNodeId,
        ]);
      }),
    ];

    for (const invalid of cases) {
      expect(invariantSignature(captureInvariant([invalid]))).toEqual(expectedInvariantSignature);
    }
  });

  it('rejects broken component ownership and component membership arrays', () => {
    const fixture = createModelFixture('src/ownership.tsx');
    const cases = [
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.components[0] ?? {}, 'jsxNodeIds', [
          fixture.rootNodeId,
          fixture.buttonNodeId,
        ]);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.components[0] ?? {}, 'jsxNodeIds', [
          fixture.buttonNodeId,
          fixture.rootNodeId,
          fixture.customNodeId,
        ]);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(requireNode(analyzedFile, fixture.buttonNodeId), 'componentId', null);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(
          requireNode(analyzedFile, fixture.buttonNodeId),
          'componentId',
          'component:src/ownership.tsx:999',
        );
      }),
      corruptFixture(fixture, (analyzedFile) => {
        for (const node of analyzedFile.jsxNodes) {
          setProperty(node, 'componentId', null);
        }

        setProperty(analyzedFile.components[0] ?? {}, 'jsxNodeIds', []);
        setProperty(analyzedFile.components[0] ?? {}, 'rootJsxNodeIds', []);
      }),
    ];

    for (const invalid of cases) {
      expect(invariantSignature(captureInvariant([invalid]))).toEqual(expectedInvariantSignature);
    }
  });

  it('rejects broken parent-child reciprocity, root sets, order, missing references, and cycles', () => {
    const fixture = createModelFixture('src/relationships.tsx');
    const cases = [
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(requireNode(analyzedFile, fixture.rootNodeId), 'childNodeIds', [
          fixture.buttonNodeId,
        ]);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(requireNode(analyzedFile, fixture.rootNodeId), 'childNodeIds', [
          fixture.customNodeId,
          fixture.buttonNodeId,
        ]);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(requireNode(analyzedFile, fixture.buttonNodeId), 'parentNodeId', null);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(
          requireNode(analyzedFile, fixture.buttonNodeId),
          'parentNodeId',
          'jsx:missing:0',
        );
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.components[0] ?? {}, 'rootJsxNodeIds', []);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.components[0] ?? {}, 'rootJsxNodeIds', [fixture.buttonNodeId]);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        const root = requireNode(analyzedFile, fixture.rootNodeId);
        const button = requireNode(analyzedFile, fixture.buttonNodeId);
        setProperty(root, 'parentNodeId', fixture.buttonNodeId);
        setProperty(button, 'childNodeIds', [fixture.rootNodeId]);
        setProperty(analyzedFile.components[0] ?? {}, 'rootJsxNodeIds', []);
      }),
    ];

    for (const invalid of cases) {
      expect(invariantSignature(captureInvariant([invalid]))).toEqual(expectedInvariantSignature);
    }
  });

  it('rejects cross-file component ownership and parent-child relationships', () => {
    const alpha = createModelFixture('src/cross-alpha.tsx');
    const zeta = createModelFixture('src/cross-zeta.tsx');
    const crossOwner = corruptFixture(alpha, (analyzedFile) => {
      setProperty(requireNode(analyzedFile, alpha.buttonNodeId), 'componentId', zeta.componentId);
    });
    const crossComponentMember = corruptFixture(alpha, (analyzedFile) => {
      setProperty(analyzedFile.components[0] ?? {}, 'jsxNodeIds', [
        alpha.rootNodeId,
        alpha.buttonNodeId,
        zeta.customNodeId,
      ]);
    });
    const crossChild = corruptFixture(alpha, (analyzedFile) => {
      setProperty(requireNode(analyzedFile, alpha.rootNodeId), 'childNodeIds', [
        alpha.buttonNodeId,
        zeta.customNodeId,
      ]);
    });

    for (const invalid of [crossOwner, crossComponentMember, crossChild]) {
      expect(invariantSignature(captureInvariant([invalid, zeta.analyzedFile]))).toEqual(
        expectedInvariantSignature,
      );
    }
  });

  it('rejects unsupported discriminants, language, names, and text confidence states', () => {
    const fixture = createModelFixture('src/discriminants.tsx');
    const cases = [
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.file, 'language', 'rust');
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.components[0] ?? {}, 'kind', 'hook');
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(analyzedFile.components[0] ?? {}, 'name', '');
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(requireNode(analyzedFile, fixture.rootNodeId), 'kind', 'portal');
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(requireElement(analyzedFile, fixture.buttonNodeId), 'elementKind', 'unknown');
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(requireElement(analyzedFile, fixture.buttonNodeId), 'name', '');
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(
          requireElement(analyzedFile, fixture.buttonNodeId).attributes[0] ?? {},
          'kind',
          'computed',
        );
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(
          requireNode(analyzedFile, fixture.customNodeId).textContent,
          'confidence',
          'unknown',
        );
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(requireNode(analyzedFile, fixture.customNodeId).textContent, 'value', 'secret');
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(
          requireNode(analyzedFile, fixture.buttonNodeId).textContent,
          'value',
          'x'.repeat(257),
        );
      }),
      corruptFixture(fixture, (analyzedFile) => {
        setProperty(requireNode(analyzedFile, fixture.rootNodeId).textContent, 'value', '');
      }),
    ];

    for (const invalid of cases) {
      expect(invariantSignature(captureInvariant([invalid]))).toEqual(expectedInvariantSignature);
    }
  });

  it('rejects invalid literal, dynamic, object-confidence, and nested property values', () => {
    const fixture = createModelFixture('src/values.tsx');
    let overlyDeepValue: JsxAttributeValue = exactLiteral(1);

    for (let depth = 0; depth < 22; depth += 1) {
      overlyDeepValue = {
        confidence: JSX_VALUE_CONFIDENCE.exact,
        hasUnknownProperties: false,
        kind: 'object',
        properties: [
          {
            location: location('src/values.tsx', 50, 70),
            name: `level${String(depth)}`,
            value: overlyDeepValue,
          },
        ],
      };
    }

    const cases = [
      corruptFixture(fixture, (analyzedFile) => {
        const style = requireStyleValue(analyzedFile, fixture.buttonNodeId);
        setProperty(style.properties[0]?.value ?? {}, 'value', Number.POSITIVE_INFINITY);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        const style = requireStyleValue(analyzedFile, fixture.buttonNodeId);
        setProperty(style.properties[0]?.value ?? {}, 'value', Number.NaN);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        const style = requireStyleValue(analyzedFile, fixture.buttonNodeId);
        setProperty(style.properties[0]?.value ?? {}, 'value', undefined);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        const style = requireStyleValue(analyzedFile, fixture.buttonNodeId);
        setProperty(style.properties[0]?.value ?? {}, 'confidence', 'partial');
      }),
      corruptFixture(fixture, (analyzedFile) => {
        const element = requireElement(analyzedFile, fixture.buttonNodeId);
        const dynamicAttribute = element.attributes[2];

        if (
          dynamicAttribute?.kind !== JSX_ATTRIBUTE_KINDS.named ||
          dynamicAttribute.value.kind !== 'dynamic'
        ) {
          throw new TypeError('Missing test dynamic value.');
        }

        setProperty(dynamicAttribute.value, 'confidence', JSX_VALUE_CONFIDENCE.exact);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        const style = requireStyleValue(analyzedFile, fixture.buttonNodeId);
        setProperty(style, 'confidence', JSX_VALUE_CONFIDENCE.dynamic);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        const style = requireStyleValue(analyzedFile, fixture.buttonNodeId);
        setProperty(style, 'hasUnknownProperties', true);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        const style = requireStyleValue(analyzedFile, fixture.buttonNodeId);
        setProperty(style, 'properties', [...style.properties].reverse());
      }),
      corruptFixture(fixture, (analyzedFile) => {
        const style = requireStyleValue(analyzedFile, fixture.buttonNodeId);
        setProperty(style.properties[0] ?? {}, 'value', style);
      }),
      corruptFixture(fixture, (analyzedFile) => {
        const element = requireElement(analyzedFile, fixture.buttonNodeId);
        const styleAttribute = element.attributes[1];

        if (styleAttribute?.kind !== JSX_ATTRIBUTE_KINDS.named) {
          throw new TypeError('Missing test style attribute.');
        }

        setProperty(styleAttribute, 'value', overlyDeepValue);
      }),
    ];

    for (const invalid of cases) {
      expect(invariantSignature(captureInvariant([invalid]))).toEqual(expectedInvariantSignature);
    }
  });

  it('requires usesJsx to match the file JSX inventory', () => {
    const fixture = createModelFixture('src/uses-jsx.tsx');
    const falseWithNodes = corruptFixture(fixture, (analyzedFile) => {
      setProperty(analyzedFile.file, 'usesJsx', false);
    });
    const trueWithoutNodes = createEmptyFile();
    setProperty(trueWithoutNodes.file, 'usesJsx', true);

    expect(invariantSignature(captureInvariant([falseWithNodes]))).toEqual(
      expectedInvariantSignature,
    );
    expect(invariantSignature(captureInvariant([trueWithoutNodes]))).toEqual(
      expectedInvariantSignature,
    );
  });

  it('uses one generic invariant error without leaking invalid input data', () => {
    const privatePath = 'private/SENSITIVE_MODEL_SENTINEL.tsx';
    const invalidPath = createModelFixture(privatePath).analyzedFile;
    setProperty(invalidPath.file, 'filePath', '/absolute/SENSITIVE_MODEL_SENTINEL.tsx');
    const invalidValueFixture = createModelFixture('src/error.tsx');
    const invalidValue = corruptFixture(invalidValueFixture, (analyzedFile) => {
      const style = requireStyleValue(analyzedFile, invalidValueFixture.buttonNodeId);
      setProperty(style.properties[0]?.value ?? {}, 'value', Number.POSITIVE_INFINITY);
    });
    const first = captureInvariant([invalidPath]);
    const second = captureInvariant([invalidValue]);

    expect(invariantSignature(first)).toEqual(expectedInvariantSignature);
    expect(invariantSignature(second)).toEqual(invariantSignature(first));
    expect(String(first)).not.toContain('SENSITIVE_MODEL_SENTINEL');
    expect(JSON.stringify(first)).not.toContain('SENSITIVE_MODEL_SENTINEL');
    expect(first).not.toHaveProperty('cause');
    expect(first).not.toHaveProperty('input');
  });
});

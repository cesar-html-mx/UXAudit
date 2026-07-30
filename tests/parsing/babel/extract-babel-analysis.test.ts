import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  COMPONENT_KINDS,
  JSX_ATTRIBUTE_KINDS,
  JSX_ELEMENT_KINDS,
  JSX_NODE_KINDS,
  type AnalyzedSourceFile,
  type JsxElement,
  type JsxNamedAttribute,
  type JsxNode,
} from '../../../src/domain/models/analysis-model.js';
import { JSX_VALUE_CONFIDENCE, type JsxObjectValue } from '../../../src/domain/models/jsx-value.js';
import {
  BabelAnalysisInvariantError,
  DEFAULT_EXTRACTION_NODE_LIMIT,
  STATIC_TEXT_CODE_UNIT_LIMIT,
  extractBabelAnalysis,
  type ExtractBabelAnalysisResult,
  type ExtractBabelAnalysisSuccess,
} from '../../../src/parsing/babel/extract-babel-analysis.js';
import {
  parseBabelSource,
  type BabelParseResult,
  type BabelParseSuccess,
} from '../../../src/parsing/babel/parse-babel-source.js';
import {
  SOURCE_PARSER_ERROR_CODES,
  SOURCE_PARSER_ERROR_STAGES,
} from '../../../src/parsing/parser-contracts.js';
import {
  SOURCE_KINDS,
  type SourceKind,
} from '../../../src/project/classification/source-candidate.js';

const fixturesDirectory = new URL('../../fixtures/parsing/', import.meta.url);
const fixturesPath = fileURLToPath(fixturesDirectory);

const requireParseSuccess = (result: BabelParseResult): BabelParseSuccess => {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new TypeError('Expected source parsing to succeed.');
  }

  return result;
};

const requireExtractionSuccess = (
  result: ExtractBabelAnalysisResult,
): ExtractBabelAnalysisSuccess => {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new TypeError('Expected source extraction to succeed.');
  }

  return result;
};

const parseSource = (sourceText: string, filePath: string, sourceKind: SourceKind) =>
  requireParseSuccess(
    parseBabelSource({
      filePath,
      sourceKind,
      sourceText,
    }),
  );

const extractSource = (
  sourceText: string,
  filePath: string,
  sourceKind: SourceKind,
): AnalyzedSourceFile => {
  const parsed = parseSource(sourceText, filePath, sourceKind);
  return requireExtractionSuccess(
    extractBabelAnalysis({
      ast: parsed.ast,
      filePath,
      sourceKind,
    }),
  ).analyzedFile;
};

const extractFixture = async (fixture: string, filePath: string, sourceKind: SourceKind) => {
  const sourceText = await readFile(new URL(fixture, fixturesDirectory), 'utf8');

  return {
    analyzedFile: extractSource(sourceText, filePath, sourceKind),
    sourceText,
  };
};

const requireElement = (node: JsxNode | undefined): JsxElement => {
  expect(node?.kind).toBe(JSX_NODE_KINDS.element);

  if (node?.kind !== JSX_NODE_KINDS.element) {
    throw new TypeError('Expected one extracted JSX element.');
  }

  return node;
};

const requireNamedAttribute = (element: JsxElement, name: string): JsxNamedAttribute => {
  const attribute = element.attributes.find(
    (candidate): candidate is JsxNamedAttribute =>
      candidate.kind === JSX_ATTRIBUTE_KINDS.named && candidate.name === name,
  );

  expect(attribute).toBeDefined();

  if (attribute === undefined) {
    throw new TypeError(`Expected the ${name} JSX attribute.`);
  }

  return attribute;
};

const requireObjectValue = (attribute: JsxNamedAttribute): JsxObjectValue => {
  expect(attribute.value.kind).toBe('object');

  if (attribute.value.kind !== 'object') {
    throw new TypeError('Expected one extracted JSX object value.');
  }

  return attribute.value;
};

const collectKeys = (value: unknown, keys = new Set<string>()): ReadonlySet<string> => {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, keys);
    }

    return keys;
  }

  if (typeof value !== 'object' || value === null) {
    return keys;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    keys.add(key);
    collectKeys(nestedValue, keys);
  }

  return keys;
};

describe('extractBabelAnalysis', () => {
  it('discovers supported component styles while keeping lowercase JSX unowned', async () => {
    const filePath = 'src/component-styles.tsx';
    const { analyzedFile } = await extractFixture(
      'component-styles.tsx.fixture',
      filePath,
      SOURCE_KINDS.typescriptJsx,
    );

    expect(
      analyzedFile.components.map(({ kind, name }) => ({
        kind,
        name,
      })),
    ).toEqual([
      { kind: COMPONENT_KINDS.function, name: 'FunctionPanel' },
      { kind: COMPONENT_KINDS.arrowFunction, name: 'ArrowPanel' },
      { kind: COMPONENT_KINDS.function, name: 'FunctionExpressionPanel' },
      { kind: COMPONENT_KINDS.class, name: 'ClassPanel' },
    ]);
    expect(analyzedFile.file.componentIds).toEqual(
      analyzedFile.components.map((component) => component.id),
    );

    for (const component of analyzedFile.components) {
      expect(component.location.filePath).toBe(filePath);
      expect(component.jsxNodeIds).toHaveLength(1);
      expect(component.rootJsxNodeIds).toEqual(component.jsxNodeIds);
      expect(
        analyzedFile.jsxNodes.find((node) => node.id === component.rootJsxNodeIds[0])?.componentId,
      ).toBe(component.id);
    }

    const unownedHelper = requireElement(
      analyzedFile.jsxNodes.find((node) => node.id === `jsx:${filePath}:587`),
    );
    expect(unownedHelper).toMatchObject({
      componentId: null,
      name: 'small',
      parentNodeId: null,
      textContent: {
        confidence: JSX_VALUE_CONFIDENCE.exact,
        value: 'Lowercase helper',
      },
    });
    expect(analyzedFile.components.map((component) => component.name)).not.toEqual(
      expect.arrayContaining(['helperView', 'calculateTotal', 'NotAComponent']),
    );
  });

  it('normalizes JSX kinds and exact bidirectional hierarchy in source order', async () => {
    const filePath = 'src/jsx-shapes.tsx';
    const { analyzedFile } = await extractFixture(
      'jsx-shapes.tsx.fixture',
      filePath,
      SOURCE_KINDS.typescriptJsx,
    );
    const ids = {
      anchor: `jsx:${filePath}:514`,
      button: `jsx:${filePath}:397`,
      explicitFragment: `jsx:${filePath}:491`,
      fragment: `jsx:${filePath}:160`,
      icon: `jsx:${filePath}:462`,
      image: `jsx:${filePath}:167`,
    } as const;
    const component = analyzedFile.components[0];

    expect(component).toMatchObject({
      jsxNodeIds: [ids.fragment, ids.image, ids.button, ids.icon, ids.explicitFragment, ids.anchor],
      kind: COMPONENT_KINDS.arrowFunction,
      name: 'Shapes',
      rootJsxNodeIds: [ids.fragment],
    });
    expect(analyzedFile.file.jsxNodeIds).toEqual(component?.jsxNodeIds);
    expect(analyzedFile.jsxNodes.map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: ids.fragment, kind: JSX_NODE_KINDS.fragment },
      { id: ids.image, kind: JSX_NODE_KINDS.element },
      { id: ids.button, kind: JSX_NODE_KINDS.element },
      { id: ids.icon, kind: JSX_NODE_KINDS.element },
      { id: ids.explicitFragment, kind: JSX_NODE_KINDS.fragment },
      { id: ids.anchor, kind: JSX_NODE_KINDS.element },
    ]);

    const rootFragment = analyzedFile.jsxNodes[0];
    const explicitFragment = analyzedFile.jsxNodes[4];
    const anchor = requireElement(analyzedFile.jsxNodes[5]);
    const image = requireElement(analyzedFile.jsxNodes[1]);
    const button = requireElement(analyzedFile.jsxNodes[2]);
    const icon = requireElement(analyzedFile.jsxNodes[3]);

    expect(rootFragment).toMatchObject({
      childNodeIds: [ids.image, ids.button, ids.icon, ids.explicitFragment],
      componentId: component?.id,
      parentNodeId: null,
    });
    expect([image, button, icon]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          elementKind: JSX_ELEMENT_KINDS.intrinsic,
          name: 'img',
          parentNodeId: ids.fragment,
        }),
        expect.objectContaining({
          elementKind: JSX_ELEMENT_KINDS.custom,
          name: 'Button',
          parentNodeId: ids.fragment,
        }),
        expect.objectContaining({
          elementKind: JSX_ELEMENT_KINDS.custom,
          name: 'UI.Icon',
          parentNodeId: ids.fragment,
        }),
      ]),
    );
    expect(explicitFragment).toMatchObject({
      childNodeIds: [ids.anchor],
      kind: JSX_NODE_KINDS.fragment,
      parentNodeId: ids.fragment,
    });
    expect(anchor).toMatchObject({
      childNodeIds: [],
      elementKind: JSX_ELEMENT_KINDS.intrinsic,
      name: 'a',
      parentNodeId: ids.explicitFragment,
    });
  });

  it('extracts named, shorthand, spread, literal, dynamic, and structured object values', async () => {
    const { analyzedFile } = await extractFixture(
      'jsx-shapes.tsx.fixture',
      'src/jsx-shapes.tsx',
      SOURCE_KINDS.typescriptJsx,
    );
    const image = requireElement(analyzedFile.jsxNodes[1]);
    const button = requireElement(analyzedFile.jsxNodes[2]);

    expect(
      image.attributes.map((attribute) =>
        attribute.kind === JSX_ATTRIBUTE_KINDS.named ? attribute.name : attribute.kind,
      ),
    ).toEqual([
      'alt',
      'loading',
      'width',
      'height',
      'hidden',
      'style',
      'title',
      'data-risk',
      JSX_ATTRIBUTE_KINDS.spread,
    ]);
    expect(requireNamedAttribute(image, 'alt').value).toEqual({
      confidence: JSX_VALUE_CONFIDENCE.exact,
      kind: 'literal',
      value: '',
    });
    expect(requireNamedAttribute(image, 'loading').value).toMatchObject({ value: 'lazy' });
    expect(requireNamedAttribute(image, 'width').value).toMatchObject({ value: 320 });
    expect(requireNamedAttribute(image, 'height').value).toMatchObject({ value: 180 });
    expect(requireNamedAttribute(image, 'hidden').value).toMatchObject({ value: false });
    expect(requireNamedAttribute(image, 'title').value).toEqual({
      confidence: JSX_VALUE_CONFIDENCE.dynamic,
      kind: 'dynamic',
    });
    expect(requireNamedAttribute(image, 'data-risk').value).toEqual({
      confidence: JSX_VALUE_CONFIDENCE.dynamic,
      kind: 'dynamic',
    });

    const style = requireObjectValue(requireNamedAttribute(image, 'style'));
    expect(style).toMatchObject({
      confidence: JSX_VALUE_CONFIDENCE.exact,
      hasUnknownProperties: false,
    });
    expect(style.properties).toEqual([
      expect.objectContaining({
        name: 'fontSize',
        value: {
          confidence: JSX_VALUE_CONFIDENCE.exact,
          kind: 'literal',
          value: 11,
        },
      }),
      expect.objectContaining({
        name: 'lineHeight',
        value: {
          confidence: JSX_VALUE_CONFIDENCE.exact,
          kind: 'literal',
          value: 1.2,
        },
      }),
    ]);
    expect(requireNamedAttribute(button, 'disabled').value).toMatchObject({ value: true });
    expect(requireNamedAttribute(button, 'aria-label').value).toMatchObject({ value: 'Save' });
  });

  it('retains exact, partial, and dynamic static-text confidence without evaluation', async () => {
    const { analyzedFile: shapes } = await extractFixture(
      'jsx-shapes.tsx.fixture',
      'src/jsx-shapes.tsx',
      SOURCE_KINDS.typescriptJsx,
    );
    const { analyzedFile: components } = await extractFixture(
      'component-styles.tsx.fixture',
      'src/component-styles.tsx',
      SOURCE_KINDS.typescriptJsx,
    );

    expect(requireElement(shapes.jsxNodes[2]).textContent).toEqual({
      confidence: JSX_VALUE_CONFIDENCE.exact,
      value: 'Save',
    });
    expect(requireElement(shapes.jsxNodes[5]).textContent).toEqual({
      confidence: JSX_VALUE_CONFIDENCE.partial,
      value: 'Read more',
    });
    expect(requireElement(components.jsxNodes[3]).textContent).toEqual({
      confidence: JSX_VALUE_CONFIDENCE.dynamic,
      value: '',
    });
    expect(shapes.jsxNodes[0]?.textContent).toEqual({
      confidence: JSX_VALUE_CONFIDENCE.partial,
      value: 'Save Read more',
    });
  });

  it('retains exact multiline, attribute, property, and end-exclusive locations', async () => {
    const filePath = 'src/jsx-shapes.tsx';
    const { analyzedFile, sourceText } = await extractFixture(
      'jsx-shapes.tsx.fixture',
      filePath,
      SOURCE_KINDS.typescriptJsx,
    );
    const image = requireElement(analyzedFile.jsxNodes[1]);
    const width = requireNamedAttribute(image, 'width');
    const style = requireObjectValue(requireNamedAttribute(image, 'style'));
    const spread = image.attributes[8];
    const explicitFragment = analyzedFile.jsxNodes[4];

    expect(analyzedFile.file.location).toEqual({
      end: { column: 0, line: 32, offset: sourceText.length },
      filePath,
      start: { column: 0, line: 1, offset: 0 },
    });
    expect(image.location).toEqual({
      end: { column: 6, line: 19, offset: 392 },
      filePath,
      start: { column: 4, line: 9, offset: 167 },
    });
    expect(width.location).toEqual({
      end: { column: 17, line: 12, offset: 223 },
      filePath,
      start: { column: 6, line: 12, offset: 212 },
    });
    expect(style.properties[0]?.location).toEqual({
      end: { column: 27, line: 15, offset: 291 },
      filePath,
      start: { column: 15, line: 15, offset: 279 },
    });
    expect(spread?.location).toEqual({
      end: { column: 21, line: 18, offset: 385 },
      filePath,
      start: { column: 6, line: 18, offset: 370 },
    });
    expect(explicitFragment?.location).toEqual({
      end: { column: 21, line: 29, offset: 599 },
      filePath,
      start: { column: 4, line: 24, offset: 491 },
    });
    expect(sourceText.slice(width.location.start.offset, width.location.end.offset)).toBe(
      'width={320}',
    );
    expect(
      sourceText.slice(
        style.properties[0]?.location.start.offset,
        style.properties[0]?.location.end.offset,
      ),
    ).toBe('fontSize: 11');
    expect(
      sourceText.slice(
        explicitFragment?.location.start.offset,
        explicitFragment?.location.end.offset,
      ),
    ).toBe(
      '<React.Fragment>\n      <a href="/more">\n        Read more\n        {caption}\n      </a>\n    </React.Fragment>',
    );
  });

  it.each([
    [
      'JavaScript',
      'javascript-commonjs.js.fixture',
      'src/javascript-commonjs.js',
      SOURCE_KINDS.javascript,
      'javascript',
    ],
    [
      'TypeScript',
      'typescript-modern.ts.fixture',
      'src/typescript-modern.ts',
      SOURCE_KINDS.typescript,
      'typescript',
    ],
  ] as const)(
    'returns one empty, whole-file %s model when the source has no JSX',
    async (_description, fixture, filePath, sourceKind, language) => {
      const { analyzedFile, sourceText } = await extractFixture(fixture, filePath, sourceKind);

      expect(analyzedFile).toMatchObject({
        components: [],
        file: {
          componentIds: [],
          filePath,
          jsxNodeIds: [],
          language,
          usesJsx: false,
        },
        jsxNodes: [],
      });
      expect(analyzedFile.file.location.start).toEqual({ column: 0, line: 1, offset: 0 });
      expect(analyzedFile.file.location.end.offset).toBe(sourceText.length);
    },
  );

  it('is deterministic and exposes no Babel AST, complete source, or absolute fixture path', async () => {
    const filePath = 'src/jsx-shapes.tsx';
    const sourceText = await readFile(new URL('jsx-shapes.tsx.fixture', fixturesDirectory), 'utf8');
    const parsed = parseSource(sourceText, filePath, SOURCE_KINDS.typescriptJsx);
    const first = requireExtractionSuccess(
      extractBabelAnalysis({
        ast: parsed.ast,
        filePath,
        sourceKind: SOURCE_KINDS.typescriptJsx,
      }),
    );
    const second = requireExtractionSuccess(
      extractBabelAnalysis({
        ast: parsed.ast,
        filePath,
        sourceKind: SOURCE_KINDS.typescriptJsx,
      }),
    );
    const serialized = JSON.stringify(first);
    const keys = collectKeys(first);

    expect(JSON.stringify(second)).toBe(serialized);
    expect([...keys]).not.toEqual(
      expect.arrayContaining([
        'ast',
        'comments',
        'extra',
        'source',
        'sourceText',
        'tokens',
        'type',
      ]),
    );
    expect(serialized).not.toContain(fixturesPath);
    expect(serialized).not.toContain(sourceText);
    expect(serialized).not.toContain('dangerous()');
    expect(serialized).not.toContain('Not evaluated');
  });

  it('keeps object extraction prototype-safe and marks unknown or non-finite data conservatively', () => {
    const filePath = 'src/prototype-safe.tsx';
    const sourceText = [
      'const spread = {};',
      'const dynamic = "value";',
      'export const SafeValues = () => (',
      '  <Widget',
      '    enabled',
      '    count={-2}',
      '    label={`static`}',
      '    nullable={null}',
      '    risk={dynamic}',
      '    style={{',
      '      __proto__: { polluted: true },',
      '      constructor: 2,',
      '      fontSize: 1e400,',
      '      ...spread,',
      '      [dynamic]: 3,',
      '    }}',
      '  >',
      "    {'Known'}",
      '    {dynamic}',
      '    {42}',
      '    {false}',
      '  </Widget>',
      ');',
    ].join('\n');
    const prototypeBefore = Object.getOwnPropertyDescriptors(Object.prototype);
    const analyzedFile = extractSource(sourceText, filePath, SOURCE_KINDS.typescriptJsx);
    const widget = requireElement(analyzedFile.jsxNodes[0]);
    const style = requireObjectValue(requireNamedAttribute(widget, 'style'));

    expect(style).toMatchObject({
      confidence: JSX_VALUE_CONFIDENCE.partial,
      hasUnknownProperties: true,
    });
    expect(style.properties.map((property) => property.name)).toEqual([
      '__proto__',
      'constructor',
      'fontSize',
    ]);
    expect(style.properties[0]?.value).toMatchObject({
      confidence: JSX_VALUE_CONFIDENCE.exact,
      hasUnknownProperties: false,
      kind: 'object',
    });
    expect(style.properties[2]?.value).toEqual({
      confidence: JSX_VALUE_CONFIDENCE.dynamic,
      kind: 'dynamic',
    });
    expect(requireNamedAttribute(widget, 'enabled').value).toMatchObject({ value: true });
    expect(requireNamedAttribute(widget, 'count').value).toMatchObject({ value: -2 });
    expect(requireNamedAttribute(widget, 'label').value).toMatchObject({ value: 'static' });
    expect(requireNamedAttribute(widget, 'nullable').value).toMatchObject({ value: null });
    expect(requireNamedAttribute(widget, 'risk').value).toEqual({
      confidence: JSX_VALUE_CONFIDENCE.dynamic,
      kind: 'dynamic',
    });
    expect(widget.textContent).toEqual({
      confidence: JSX_VALUE_CONFIDENCE.partial,
      value: 'Known 42',
    });
    expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(prototypeBefore);
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('supports React class variants and excludes JSX outside an instance render method', () => {
    const filePath = 'src/class-variants.tsx';
    const sourceText = [
      'class DirectComponent extends Component {',
      '  "render"() { return <section data-case="direct" />; }',
      '  helper() { return <aside data-case="non-render" />; }',
      '}',
      'class DirectPureComponent extends PureComponent {',
      '  render() { return <main data-case="direct-pure" />; }',
      '}',
      'const ExpressionComponent = class extends React.Component {',
      '  render() { return <div data-case="expression" />; }',
      '};',
      'const NamedExpression = class InnerName extends React.PureComponent {',
      '  render() { return <span data-case="named-expression" />; }',
      '};',
      'class NoSuperclass {',
      '  render() { return <p data-case="no-superclass" />; }',
      '}',
      'class UnknownSuperclass extends UnknownBase {',
      '  render() { return <nav data-case="unknown-superclass" />; }',
      '}',
      'class UnsupportedMember extends Framework.Component {',
      '  render() { return <footer data-case="unsupported-member" />; }',
      '}',
      "class ComputedSuperclass extends React['Component'] {",
      '  render() { return <header data-case="computed-superclass" />; }',
      '}',
      'class ComputedRender extends Component {',
      '  [\'render\']() { return <i data-case="computed-render" />; }',
      '}',
      'class FieldBoundaries extends Component {',
      '  field = <label data-case="field" />;',
      '  #privateField = <mark data-case="private-field" />;',
      '  #helper() { return <small data-case="private-method" />; }',
      '  render() { return <article data-case="field-render" />; }',
      '}',
    ].join('\n');
    const analyzedFile = extractSource(sourceText, filePath, SOURCE_KINDS.typescriptJsx);

    expect(
      analyzedFile.components.map(({ kind, name }) => ({
        kind,
        name,
      })),
    ).toEqual([
      { kind: COMPONENT_KINDS.class, name: 'DirectComponent' },
      { kind: COMPONENT_KINDS.class, name: 'DirectPureComponent' },
      { kind: COMPONENT_KINDS.class, name: 'ExpressionComponent' },
      { kind: COMPONENT_KINDS.class, name: 'InnerName' },
      { kind: COMPONENT_KINDS.class, name: 'FieldBoundaries' },
    ]);

    const nodesByCase = new Map(
      analyzedFile.jsxNodes.map((node) => {
        const element = requireElement(node);
        const value = requireNamedAttribute(element, 'data-case').value;

        if (value.kind !== 'literal' || typeof value.value !== 'string') {
          throw new TypeError('Expected a literal data-case value.');
        }

        return [value.value, element] as const;
      }),
    );

    expect(
      ['direct', 'direct-pure', 'expression', 'named-expression', 'field-render'].map(
        (caseName) => nodesByCase.get(caseName)?.componentId,
      ),
    ).toEqual(analyzedFile.components.map((component) => component.id));
    expect(
      [
        'non-render',
        'no-superclass',
        'unknown-superclass',
        'unsupported-member',
        'computed-superclass',
        'computed-render',
        'field',
        'private-field',
        'private-method',
      ].map((caseName) => nodesByCase.get(caseName)?.componentId),
    ).toEqual(Array.from({ length: 9 }, () => null));
  });

  it('normalizes namespaced JSX and member elements plus conservative attribute expressions', () => {
    const filePath = 'src/jsx-syntax.tsx';
    const sourceText = [
      'export const Syntax = () => (',
      '  <>',
      '    <svg:rect xml:lang="es" />',
      '    <foo.Bar',
      '      aria:label="Chart"',
      "      stringValue={'literal'}",
      '      positive={+7}',
      '      options={{ "font-size": 12, 7: "seven" }}',
      '    />',
      '    <this.Component />',
      '  </>',
      ');',
    ].join('\n');
    const analyzedFile = extractSource(sourceText, filePath, SOURCE_KINDS.typescriptJsx);
    const namespaced = requireElement(analyzedFile.jsxNodes[1]);
    const member = requireElement(analyzedFile.jsxNodes[2]);
    const thisMember = requireElement(analyzedFile.jsxNodes[3]);

    expect(namespaced).toMatchObject({
      elementKind: JSX_ELEMENT_KINDS.intrinsic,
      name: 'svg:rect',
    });
    expect(requireNamedAttribute(namespaced, 'xml:lang').value).toMatchObject({
      value: 'es',
    });
    expect(member).toMatchObject({
      elementKind: JSX_ELEMENT_KINDS.custom,
      name: 'foo.Bar',
    });
    expect(thisMember).toMatchObject({
      elementKind: JSX_ELEMENT_KINDS.custom,
      name: 'this.Component',
    });
    expect(requireNamedAttribute(member, 'aria:label').value).toMatchObject({
      value: 'Chart',
    });
    expect(requireNamedAttribute(member, 'stringValue').value).toMatchObject({
      value: 'literal',
    });
    expect(requireNamedAttribute(member, 'positive').value).toMatchObject({
      value: 7,
    });

    const options = requireObjectValue(requireNamedAttribute(member, 'options'));
    expect(options).toMatchObject({
      confidence: JSX_VALUE_CONFIDENCE.exact,
      hasUnknownProperties: false,
    });
    expect(options.properties.map(({ name, value }) => ({ name, value }))).toEqual([
      {
        name: 'font-size',
        value: {
          confidence: JSX_VALUE_CONFIDENCE.exact,
          kind: 'literal',
          value: 12,
        },
      },
      {
        name: '7',
        value: {
          confidence: JSX_VALUE_CONFIDENCE.exact,
          kind: 'literal',
          value: 'seven',
        },
      },
    ]);
  });

  it('bounds deeply nested object values without discarding safe outer properties', () => {
    const filePath = 'src/deep-values.tsx';
    let nestedObject = '{ leaf: 1 }';

    for (let index = 19; index >= 0; index -= 1) {
      nestedObject = `{ level${String(index)}: ${nestedObject} }`;
    }

    const analyzedFile = extractSource(
      `export const DeepValues = () => <div data={${nestedObject}} />;`,
      filePath,
      SOURCE_KINDS.typescriptJsx,
    );
    const element = requireElement(analyzedFile.jsxNodes[0]);
    let currentValue = requireObjectValue(requireNamedAttribute(element, 'data'));

    for (let index = 0; index < 20; index += 1) {
      const property = currentValue.properties[0];

      expect(property?.name).toBe(`level${String(index)}`);

      if (property?.value.kind !== 'object') {
        throw new TypeError('Expected another nested object value.');
      }

      currentValue = property.value;
    }

    expect(currentValue).toEqual({
      confidence: JSX_VALUE_CONFIDENCE.partial,
      hasUnknownProperties: true,
      kind: 'object',
      properties: [],
    });
  });

  it('normalizes fragment, template, empty, primitive, and nested JSX text', () => {
    const filePath = 'src/text-values.tsx';
    const sourceText = [
      'export const TextValues = () => (',
      '  <section>',
      '    Prefix',
      '    <>',
      '      {`Static template`}',
      '      {/* ignored */}',
      "      {'literal'}",
      '      {7}',
      '      {true}',
      '      {null}',
      '    </>',
      '    <strong>Nested</strong>',
      '  </section>',
      ');',
    ].join('\n');
    const analyzedFile = extractSource(sourceText, filePath, SOURCE_KINDS.typescriptJsx);
    const section = requireElement(analyzedFile.jsxNodes[0]);
    const fragment = analyzedFile.jsxNodes[1];
    const strong = requireElement(analyzedFile.jsxNodes[2]);

    expect(fragment).toMatchObject({
      kind: JSX_NODE_KINDS.fragment,
      textContent: {
        confidence: JSX_VALUE_CONFIDENCE.exact,
        value: 'Static template literal 7',
      },
    });
    expect(strong.textContent).toEqual({
      confidence: JSX_VALUE_CONFIDENCE.exact,
      value: 'Nested',
    });
    expect(section.textContent).toEqual({
      confidence: JSX_VALUE_CONFIDENCE.exact,
      value: 'Prefix Static template literal 7 Nested',
    });
  });

  it('bounds retained static text by UTF-16 code units and reports truncation as partial', () => {
    const filePath = 'src/bounded-text.tsx';
    const longText = 'x'.repeat(STATIC_TEXT_CODE_UNIT_LIMIT + 44);
    const analyzedFile = extractSource(
      `export const BoundedText = () => <p>${longText}{'tail'}</p>;`,
      filePath,
      SOURCE_KINDS.typescriptJsx,
    );
    const paragraph = requireElement(analyzedFile.jsxNodes[0]);

    expect(paragraph.textContent).toEqual({
      confidence: JSX_VALUE_CONFIDENCE.partial,
      value: 'x'.repeat(STATIC_TEXT_CODE_UNIT_LIMIT),
    });
    expect(paragraph.textContent.value).toHaveLength(STATIC_TEXT_CODE_UNIT_LIMIT);
    expect(JSON.stringify(analyzedFile)).not.toContain(longText);

    const astralBoundary = `${'x'.repeat(STATIC_TEXT_CODE_UNIT_LIMIT - 1)}😀`;
    const astralFile = extractSource(
      `export const AstralBoundary = () => <p>${astralBoundary}</p>;`,
      'src/astral-boundary.tsx',
      SOURCE_KINDS.typescriptJsx,
    );

    expect(requireElement(astralFile.jsxNodes[0]).textContent).toEqual({
      confidence: JSX_VALUE_CONFIDENCE.partial,
      value: 'x'.repeat(STATIC_TEXT_CODE_UNIT_LIMIT - 1),
    });
  });

  it('keeps JSX passed through attributes separate from rendered child relationships', () => {
    const filePath = 'src/jsx-attributes.tsx';
    const sourceText = [
      'export const AttributeNodes = () => (',
      '  <Panel content={<Wrapper><Icon /></Wrapper>}>',
      '    <main>Rendered child</main>',
      '  </Panel>',
      ');',
    ].join('\n');
    const analyzedFile = extractSource(sourceText, filePath, SOURCE_KINDS.typescriptJsx);
    const panel = requireElement(analyzedFile.jsxNodes[0]);
    const wrapper = requireElement(analyzedFile.jsxNodes[1]);
    const icon = requireElement(analyzedFile.jsxNodes[2]);
    const main = requireElement(analyzedFile.jsxNodes[3]);
    const component = analyzedFile.components[0];

    expect(panel.childNodeIds).toEqual([main.id]);
    expect(wrapper).toMatchObject({
      childNodeIds: [icon.id],
      parentNodeId: null,
    });
    expect(icon.parentNodeId).toBe(wrapper.id);
    expect(main.parentNodeId).toBe(panel.id);
    expect(component?.rootJsxNodeIds).toEqual([panel.id, wrapper.id]);
  });

  it('treats nested-function JSX as an unowned root without promoting an outer utility', () => {
    const filePath = 'src/nested-functions.tsx';
    const sourceText = [
      'export function PascalUtility() {',
      '  const renderItem = () => <li><strong>Nested utility</strong></li>;',
      '  return renderItem;',
      '}',
      'export const View = () => (',
      '  <section>',
      '    {items.map(() => <span>Callback item</span>)}',
      '  </section>',
      ');',
    ].join('\n');
    const analyzedFile = extractSource(sourceText, filePath, SOURCE_KINDS.typescriptJsx);
    const listItem = requireElement(
      analyzedFile.jsxNodes.find((node) => node.kind === 'element' && node.name === 'li'),
    );
    const strong = requireElement(
      analyzedFile.jsxNodes.find((node) => node.kind === 'element' && node.name === 'strong'),
    );
    const section = requireElement(
      analyzedFile.jsxNodes.find((node) => node.kind === 'element' && node.name === 'section'),
    );
    const callbackItem = requireElement(
      analyzedFile.jsxNodes.find((node) => node.kind === 'element' && node.name === 'span'),
    );

    expect(analyzedFile.components.map((component) => component.name)).toEqual(['View']);
    expect(listItem).toMatchObject({
      childNodeIds: [strong.id],
      componentId: null,
      parentNodeId: null,
    });
    expect(strong).toMatchObject({
      componentId: null,
      parentNodeId: listItem.id,
    });
    expect(section).toMatchObject({
      childNodeIds: [],
      componentId: analyzedFile.components[0]?.id,
      parentNodeId: null,
    });
    expect(callbackItem).toMatchObject({
      componentId: null,
      parentNodeId: null,
    });
    expect(analyzedFile.components[0]?.jsxNodeIds).toEqual([section.id]);
    expect(analyzedFile.components[0]?.rootJsxNodeIds).toEqual([section.id]);
  });

  it.each([
    ['arrow function', 'export default () => <main />;', COMPONENT_KINDS.arrowFunction, 'main'],
    [
      'function',
      'export default function () { return <section />; }',
      COMPONENT_KINDS.function,
      'section',
    ],
    [
      'class',
      'export default class extends Component { render() { return <article />; } }',
      COMPONENT_KINDS.class,
      'article',
    ],
  ] as const)(
    'represents an anonymous default-exported %s with a null component name',
    (_description, sourceText, kind, elementName) => {
      const filePath = `src/anonymous-${kind}.tsx`;
      const analyzedFile = extractSource(sourceText, filePath, SOURCE_KINDS.typescriptJsx);

      expect(analyzedFile.components).toHaveLength(1);
      expect(analyzedFile.components[0]).toMatchObject({
        kind,
        name: null,
      });
      expect(requireElement(analyzedFile.jsxNodes[0])).toMatchObject({
        componentId: analyzedFile.components[0]?.id,
        name: elementName,
      });
    },
  );

  it('returns a deterministic recoverable error when the extraction node limit is exceeded', () => {
    const filePath = 'src/limits.tsx';
    const sourceText = 'export const View = () => <div />;';
    const parsed = parseSource(sourceText, filePath, SOURCE_KINDS.typescriptJsx);
    const extract = () =>
      extractBabelAnalysis({
        ast: parsed.ast,
        filePath,
        maxNodes: 1,
        sourceKind: SOURCE_KINDS.typescriptJsx,
      });
    const expected = {
      error: {
        code: SOURCE_PARSER_ERROR_CODES.extractLimitExceeded,
        filePath,
        message: 'Source file exceeds the extraction node limit.',
        position: {
          column: 0,
          line: 1,
          offset: 0,
        },
        recoverable: true,
        stage: SOURCE_PARSER_ERROR_STAGES.extract,
      },
      success: false,
    } as const;

    expect(extract()).toEqual(expected);
    expect(extract()).toEqual(expected);
  });

  it('normalizes invalid limits and missing required locations into stable extraction failures', () => {
    const sourceText = 'export const View = () => <div />;';
    const sourceKind = SOURCE_KINDS.typescriptJsx;
    const invalidLimitPath = 'src/invalid-limit.tsx';
    const missingLocationPath = 'src/missing-location.tsx';
    const invalidLimitAst = parseSource(sourceText, invalidLimitPath, sourceKind).ast;
    const missingLocationAst = parseSource(sourceText, missingLocationPath, sourceKind).ast;
    const invalidLimitResult = {
      error: {
        code: SOURCE_PARSER_ERROR_CODES.extractFailed,
        filePath: invalidLimitPath,
        message: 'Source extraction node limit is invalid.',
        recoverable: true,
        stage: SOURCE_PARSER_ERROR_STAGES.extract,
      },
      success: false,
    } as const;

    missingLocationAst.program.loc = null;

    expect(
      extractBabelAnalysis({
        ast: invalidLimitAst,
        filePath: invalidLimitPath,
        maxNodes: 0,
        sourceKind,
      }),
    ).toEqual(invalidLimitResult);
    expect(
      extractBabelAnalysis({
        ast: invalidLimitAst,
        filePath: invalidLimitPath,
        maxNodes: DEFAULT_EXTRACTION_NODE_LIMIT + 1,
        sourceKind,
      }),
    ).toEqual(invalidLimitResult);
    expect(
      extractBabelAnalysis({
        ast: missingLocationAst,
        filePath: missingLocationPath,
        sourceKind,
      }),
    ).toEqual({
      error: {
        code: SOURCE_PARSER_ERROR_CODES.extractFailed,
        filePath: missingLocationPath,
        message: 'Source analysis could not retain a required location.',
        recoverable: true,
        stage: SOURCE_PARSER_ERROR_STAGES.extract,
      },
      success: false,
    });
  });

  it('hides unexpected parser-native failures behind one stable fatal invariant error', () => {
    const filePath = 'src/native-failure.tsx';
    const parsed = parseSource(
      'export const View = () => <div />;',
      filePath,
      SOURCE_KINDS.typescriptJsx,
    );

    Object.defineProperty(parsed.ast.program, 'body', {
      configurable: true,
      get: () => {
        throw new RangeError('Native traversal detail from /absolute/private/source.tsx');
      },
    });

    let thrownError: unknown;

    try {
      extractBabelAnalysis({
        ast: parsed.ast,
        filePath,
        sourceKind: SOURCE_KINDS.typescriptJsx,
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(BabelAnalysisInvariantError);

    if (!(thrownError instanceof BabelAnalysisInvariantError)) {
      throw new TypeError('Expected one stable Babel analysis invariant error.');
    }

    expect(thrownError).toMatchObject({
      code: 'BABEL_ANALYSIS_INVARIANT_FAILED',
      message: 'Babel analysis extraction reached an invalid internal state.',
      name: 'BabelAnalysisInvariantError',
    });
    expect(String(thrownError)).not.toContain('Native traversal detail');
    expect(String(thrownError)).not.toContain('/absolute/private');
  });
});

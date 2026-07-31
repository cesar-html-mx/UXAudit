import { describe, expect, it } from 'vitest';

import { buildAnalysisModel } from '../../../src/domain/models/build-analysis-model.js';
import {
  COMPONENT_KINDS,
  JSX_ELEMENT_KINDS,
  JSX_NODE_KINDS,
  type AnalysisModel,
  type AnalyzedComponent,
  type AnalyzedSourceFile,
  type ComponentLink,
  type JsxElement,
  type JsxFragment,
} from '../../../src/domain/models/analysis-model.js';
import type { SourceLocation } from '../../../src/domain/models/source-location.js';
import {
  extractBabelAnalysis,
  type ExtractBabelAnalysisSuccess,
} from '../../../src/parsing/babel/extract-babel-analysis.js';
import {
  parseBabelSource,
  type BabelParseSuccess,
} from '../../../src/parsing/babel/parse-babel-source.js';
import { SOURCE_KINDS } from '../../../src/project/classification/source-candidate.js';
import {
  MAX_COMPONENT_COMPOSITION_DEPTH,
  MAX_COMPONENT_COMPOSITION_STEPS,
  multipleH1Rule,
} from '../../../src/rules/seo/multiple-h1.js';

interface SourceFixture {
  readonly filePath: string;
  readonly sourceText: string;
}

const requireParseSuccess = (result: ReturnType<typeof parseBabelSource>): BabelParseSuccess => {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new TypeError('Expected the intercomponent rule fixture to parse.');
  }

  return result;
};

const requireExtractionSuccess = (
  result: ReturnType<typeof extractBabelAnalysis>,
): ExtractBabelAnalysisSuccess => {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new TypeError('Expected the intercomponent rule fixture to extract.');
  }

  return result;
};

const analyzeSource = ({ filePath, sourceText }: SourceFixture): AnalyzedSourceFile => {
  const parsed = requireParseSuccess(
    parseBabelSource({
      filePath,
      sourceKind: SOURCE_KINDS.typescriptJsx,
      sourceText,
    }),
  );

  return requireExtractionSuccess(
    extractBabelAnalysis({
      ast: parsed.ast,
      filePath,
      sourceKind: SOURCE_KINDS.typescriptJsx,
    }),
  ).analyzedFile;
};

const modelFromSources = (sources: readonly SourceFixture[]): AnalysisModel =>
  buildAnalysisModel(sources.map(analyzeSource));

const modelAtCompositionDepth = (linkDepth: number): AnalysisModel => {
  const chainSources = Array.from({ length: linkDepth }, (_, index): SourceFixture => {
    const componentName = `Depth${String(index)}`;
    const nextName = `Depth${String(index + 1)}`;
    const isLast = index === linkDepth - 1;
    return {
      filePath: `src/depth/${componentName}.tsx`,
      sourceText: isLast
        ? `export const ${componentName} = () => <h1>Depth title</h1>;`
        : [
            `import { ${nextName} } from './${nextName}';`,
            `export const ${componentName} = () => <${nextName} />;`,
          ].join('\n'),
    };
  });

  return modelFromSources([
    {
      filePath: 'src/DepthPage.tsx',
      sourceText: [
        "import { Depth0 } from './depth/Depth0';",
        'export const DepthPage = () => <main><h1>Known</h1><Depth0 /></main>;',
      ].join('\n'),
    },
    ...chainSources,
  ]);
};

const syntheticLocation = (filePath: string, offset: number): SourceLocation => ({
  end: { column: 1, line: offset + 1, offset: offset + 1 },
  filePath,
  start: { column: 0, line: offset + 1, offset },
});

const syntheticFragment = (componentId: string, id: string, offset: number): JsxFragment => ({
  childNodeIds: [],
  componentId,
  id,
  kind: JSX_NODE_KINDS.fragment,
  location: syntheticLocation('src/HeavyChild.tsx', offset),
  parentNodeId: null,
  textContent: { confidence: 'exact', value: '' },
});

interface SyntheticElementOptions {
  readonly componentId: string;
  readonly elementKind: JsxElement['elementKind'];
  readonly filePath: string;
  readonly id: string;
  readonly name: string;
  readonly offset: number;
}

const syntheticElement = ({
  componentId,
  elementKind,
  filePath,
  id,
  name,
  offset,
}: SyntheticElementOptions): JsxElement => ({
  attributes: [],
  childNodeIds: [],
  componentId,
  elementKind,
  id,
  kind: JSX_NODE_KINDS.element,
  location: syntheticLocation(filePath, offset),
  name,
  parentNodeId: null,
  textContent: { confidence: 'exact', value: '' },
});

const getElements = (model: AnalysisModel, filePath: string, name: string): readonly JsxElement[] =>
  model.jsxNodes.filter(
    (node): node is JsxElement =>
      node.kind === JSX_NODE_KINDS.element &&
      node.location.filePath === filePath &&
      node.name === name,
  );

const requireElement = (
  model: AnalysisModel,
  filePath: string,
  name: string,
  index = 0,
): JsxElement => {
  const element = getElements(model, filePath, name)[index];

  expect(element).toBeDefined();

  if (element === undefined) {
    throw new TypeError(`Expected ${name} element ${String(index)} in ${filePath}.`);
  }

  return element;
};

const expectedFindingAt = (element: JsxElement) => ({
  confidence: 'medium',
  location: element.location,
  message: 'Component contains more than one intrinsic h1 element and needs review.',
});

describe('seo/multiple-h1 intercomponent composition', () => {
  it('reports one finding at the second component use when Header and Hero each provide one h1', () => {
    const pagePath = 'src/Page.tsx';
    const model = modelFromSources([
      {
        filePath: pagePath,
        sourceText: [
          "import Header from './Header';",
          "import { Hero } from './Hero';",
          'export const Page = () => (',
          '  <main>',
          '    <Header />',
          '    <Hero />',
          '  </main>',
          ');',
        ].join('\n'),
      },
      {
        filePath: 'src/Header.tsx',
        sourceText: 'export default function Header() { return <h1>Site</h1>; }',
      },
      {
        filePath: 'src/Hero.tsx',
        sourceText: 'export const Hero = () => <h1>Welcome</h1>;',
      },
    ]);
    const headerUse = requireElement(model, pagePath, 'Header');
    const heroUse = requireElement(model, pagePath, 'Hero');

    expect(headerUse.elementKind).toBe(JSX_ELEMENT_KINDS.custom);
    expect(heroUse.elementKind).toBe(JSX_ELEMENT_KINDS.custom);
    expect(model.componentLinks.map((link) => link.jsxNodeId)).toEqual([headerUse.id, heroUse.id]);
    expect(multipleH1Rule.evaluate({ model })).toEqual([expectedFindingAt(heroUse)]);
  });

  it('counts repeated uses of one h1 component and reports the second use', () => {
    const pagePath = 'src/RepeatedPage.tsx';
    const model = modelFromSources([
      {
        filePath: pagePath,
        sourceText: [
          "import Title from './Title';",
          'export const RepeatedPage = () => (',
          '  <main>',
          '    <Title />',
          '    <Title />',
          '  </main>',
          ');',
        ].join('\n'),
      },
      {
        filePath: 'src/Title.tsx',
        sourceText: 'export default function Title() { return <h1>Title</h1>; }',
      },
    ]);
    const titleUses = getElements(model, pagePath, 'Title');

    expect(titleUses).toHaveLength(2);
    expect(model.componentLinks.map((link) => link.jsxNodeId)).toEqual(
      titleUses.map((element) => element.id),
    );
    expect(multipleH1Rule.evaluate({ model })).toEqual([
      expectedFindingAt(requireElement(model, pagePath, 'Title', 1)),
    ]);
  });

  it('keeps the second direct h1 location when an imported heading appears earlier', () => {
    const pagePath = 'src/LocalPriorityPage.tsx';
    const model = modelFromSources([
      {
        filePath: pagePath,
        sourceText: [
          "import Header from './PriorityHeader';",
          'export const LocalPriorityPage = () => (',
          '  <main>',
          '    <Header />',
          '    <h1>Primary local</h1>',
          '    <h1>Secondary local</h1>',
          '  </main>',
          ');',
        ].join('\n'),
      },
      {
        filePath: 'src/PriorityHeader.tsx',
        sourceText: 'export default function Header() { return <h1>Imported</h1>; }',
      },
    ]);
    const secondDirectH1 = requireElement(model, pagePath, 'h1', 1);

    expect(multipleH1Rule.evaluate({ model })).toEqual([expectedFindingAt(secondDirectH1)]);
  });

  it('reports an invalid child definition once without duplicating it at its sole parent use', () => {
    const childPath = 'src/InvalidHeadingChild.tsx';
    const model = modelFromSources([
      {
        filePath: childPath,
        sourceText: 'export const InvalidHeadingChild = () => <><h1>One</h1><h1>Two</h1></>;',
      },
      {
        filePath: 'src/Shell.tsx',
        sourceText: [
          "import { InvalidHeadingChild } from './InvalidHeadingChild';",
          'export const Shell = () => <main><InvalidHeadingChild /></main>;',
        ].join('\n'),
      },
    ]);
    const childSecondH1 = requireElement(model, childPath, 'h1', 1);

    expect(multipleH1Rule.evaluate({ model })).toEqual([expectedFindingAt(childSecondH1)]);
  });

  it('terminates an A-to-B-to-A cycle without duplicating its single composed h1', () => {
    const model = modelFromSources([
      {
        filePath: 'src/CyclePage.tsx',
        sourceText: [
          "import { CycleA } from './CycleA';",
          'export const CyclePage = () => <main><CycleA /></main>;',
        ].join('\n'),
      },
      {
        filePath: 'src/CycleA.tsx',
        sourceText: [
          "import { CycleB } from './CycleB';",
          'export const CycleA = () => <section><h1>Cycle title</h1><CycleB /></section>;',
        ].join('\n'),
      },
      {
        filePath: 'src/CycleB.tsx',
        sourceText: [
          "import { CycleA } from './CycleA';",
          'export const CycleB = () => <aside><CycleA /></aside>;',
        ].join('\n'),
      },
    ]);

    expect(model.componentLinks).toHaveLength(3);
    expect(multipleH1Rule.evaluate({ model })).toEqual([]);
  });

  it('does not invent headings for an unresolved component import', () => {
    const pagePath = 'src/UnresolvedPage.tsx';
    const model = modelFromSources([
      {
        filePath: pagePath,
        sourceText: [
          "import MissingHeading from './MissingHeading';",
          'export const UnresolvedPage = () => (',
          '  <main>',
          '    <h1>Known title</h1>',
          '    <MissingHeading />',
          '  </main>',
          ');',
        ].join('\n'),
      },
    ]);

    expect(requireElement(model, pagePath, 'MissingHeading').elementKind).toBe(
      JSX_ELEMENT_KINDS.custom,
    );
    expect(model.componentLinks).toEqual([]);
    expect(multipleH1Rule.evaluate({ model })).toEqual([]);
  });

  it('includes a heading reached through exactly the supported 64 component-link hops', () => {
    const model = modelAtCompositionDepth(MAX_COMPONENT_COMPOSITION_DEPTH);
    const depthUse = requireElement(model, 'src/DepthPage.tsx', 'Depth0');

    expect(multipleH1Rule.evaluate({ model })).toEqual([expectedFindingAt(depthUse)]);
  });

  it('keeps composition beyond the explicit 64-hop depth bound unknown', () => {
    const model = modelAtCompositionDepth(MAX_COMPONENT_COMPOSITION_DEPTH + 1);

    expect(multipleH1Rule.evaluate({ model })).toEqual([]);
  });

  it('gives every root component an independent traversal-step budget', () => {
    const heavyPageId = 'component:heavy-page';
    const heavyChildId = 'component:heavy-child';
    const laterPageId = 'component:later-page';
    const laterChildId = 'component:later-child';
    const heavyChildNodes = Array.from({ length: 100 }, (_, index) =>
      syntheticFragment(heavyChildId, `jsx:heavy-child:${String(index)}`, index),
    );
    const heavyUseNodes = Array.from({ length: 1_000 }, (_, index) =>
      syntheticElement({
        componentId: heavyPageId,
        elementKind: JSX_ELEMENT_KINDS.custom,
        filePath: 'src/HeavyPage.tsx',
        id: `jsx:heavy-page:${String(index)}`,
        name: 'HeavyChild',
        offset: index,
      }),
    );
    const laterDirectH1 = syntheticElement({
      componentId: laterPageId,
      elementKind: JSX_ELEMENT_KINDS.intrinsic,
      filePath: 'src/LaterPage.tsx',
      id: 'jsx:later-page:h1',
      name: 'h1',
      offset: 0,
    });
    const laterChildUse = syntheticElement({
      componentId: laterPageId,
      elementKind: JSX_ELEMENT_KINDS.custom,
      filePath: 'src/LaterPage.tsx',
      id: 'jsx:later-page:child',
      name: 'LaterChild',
      offset: 2,
    });
    const laterChildH1 = syntheticElement({
      componentId: laterChildId,
      elementKind: JSX_ELEMENT_KINDS.intrinsic,
      filePath: 'src/LaterChild.tsx',
      id: 'jsx:later-child:h1',
      name: 'h1',
      offset: 0,
    });
    const component = (
      id: string,
      name: string,
      filePath: string,
      jsxNodeIds: readonly string[],
    ): AnalyzedComponent => ({
      id,
      jsxNodeIds,
      kind: COMPONENT_KINDS.arrowFunction,
      location: syntheticLocation(filePath, 0),
      name,
      rootJsxNodeIds: jsxNodeIds,
    });
    const heavyLinks: readonly ComponentLink[] = heavyUseNodes.map((node) => ({
      jsxNodeId: node.id,
      targetComponentId: heavyChildId,
    }));
    const model: AnalysisModel = {
      componentLinks: [
        ...heavyLinks,
        { jsxNodeId: laterChildUse.id, targetComponentId: laterChildId },
      ],
      components: [
        component(
          heavyPageId,
          'HeavyPage',
          'src/HeavyPage.tsx',
          heavyUseNodes.map((node) => node.id),
        ),
        component(
          heavyChildId,
          'HeavyChild',
          'src/HeavyChild.tsx',
          heavyChildNodes.map((node) => node.id),
        ),
        component(laterPageId, 'LaterPage', 'src/LaterPage.tsx', [
          laterDirectH1.id,
          laterChildUse.id,
        ]),
        component(laterChildId, 'LaterChild', 'src/LaterChild.tsx', [laterChildH1.id]),
      ],
      files: [],
      jsxNodes: [...heavyUseNodes, ...heavyChildNodes, laterDirectH1, laterChildUse, laterChildH1],
    };

    expect(heavyUseNodes.length * (heavyChildNodes.length + 1)).toBeGreaterThan(
      MAX_COMPONENT_COMPOSITION_STEPS,
    );
    expect(multipleH1Rule.evaluate({ model })).toEqual([expectedFindingAt(laterChildUse)]);
  });

  it('preserves the existing direct local multiple-h1 behavior', () => {
    const pagePath = 'src/DirectPage.tsx';
    const model = modelFromSources([
      {
        filePath: pagePath,
        sourceText: [
          'export const DirectPage = () => (',
          '  <main>',
          '    <h1>Primary</h1>',
          '    <section><h1>Secondary</h1></section>',
          '  </main>',
          ');',
        ].join('\n'),
      },
    ]);
    const secondH1 = requireElement(model, pagePath, 'h1', 1);

    expect(multipleH1Rule.evaluate({ model })).toEqual([expectedFindingAt(secondH1)]);
  });
});

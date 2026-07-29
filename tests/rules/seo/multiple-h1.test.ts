import { describe, expect, it } from 'vitest';

import { multipleH1Rule } from '../../../src/rules/seo/multiple-h1.js';
import { modelFromJsx, modelFromSource } from '../model-from-source.js';

describe('seo/multiple-h1', () => {
  it('returns one advisory finding at the second intrinsic h1 owned by a component', () => {
    const model = modelFromJsx(`
      <main>
        <h1>Primary</h1>
        <section><h1>Secondary</h1></section>
        <h1>Third</h1>
      </main>
    `);
    const h1Elements = model.jsxNodes.filter(
      (node) => node.kind === 'element' && node.name === 'h1',
    );

    const findings = multipleH1Rule.evaluate({ model });

    expect(findings).toEqual([
      {
        confidence: 'medium',
        location: h1Elements[1]?.location,
        message: 'Component contains more than one intrinsic h1 element and needs review.',
      },
    ]);
  });

  it('returns one finding per recognized component in deterministic component order', () => {
    const model = modelFromSource(`
      export const FirstPage = () => (
        <><h1>First primary</h1><h1>First secondary</h1><h1>First third</h1></>
      );
      export const SecondPage = () => (
        <><h1>Second primary</h1><h1>Second secondary</h1></>
      );
    `);
    const secondH1Locations = model.components.map((component) => {
      const ownedH1Elements = model.jsxNodes.filter(
        (node) =>
          node.kind === 'element' && node.name === 'h1' && node.componentId === component.id,
      );

      return ownedH1Elements[1]?.location;
    });

    const firstEvaluation = multipleH1Rule.evaluate({ model });
    const secondEvaluation = multipleH1Rule.evaluate({ model });

    expect(firstEvaluation).toHaveLength(2);
    expect(firstEvaluation.map((finding) => finding.location)).toEqual(secondH1Locations);
    expect(secondEvaluation).toEqual(firstEvaluation);
  });

  it('accepts one intrinsic h1 per component and ignores custom heading syntax', () => {
    const model = modelFromSource(`
      export const FirstPage = () => <h1>First page</h1>;
      export const SecondPage = () => (
        <><H1>Custom one</H1><Heading.H1>Custom two</Heading.H1><h2>Section</h2></>
      );
    `);

    expect(multipleH1Rule.evaluate({ model })).toEqual([]);
  });

  it('does not combine unowned JSX nodes with each other or a recognized component', () => {
    const model = modelFromSource(`
      export const firstHeadingHelper = () => <h1>Helper one</h1>;
      export const secondHeadingHelper = () => <h1>Helper two</h1>;
      export const RecognizedPage = () => <h1>Recognized primary</h1>;
    `);

    expect(model.jsxNodes.filter((node) => node.componentId === null)).toHaveLength(2);
    expect(multipleH1Rule.evaluate({ model })).toEqual([]);
  });

  it('reports syntactically owned h1 elements in mutually exclusive branches as an advisory limit', () => {
    const model = modelFromSource(`
      export const ConditionalPage = ({ ready }) =>
        ready ? <h1>Ready</h1> : <h1>Waiting</h1>;
    `);
    const h1Elements = model.jsxNodes.filter(
      (node) => node.kind === 'element' && node.name === 'h1',
    );

    const findings = multipleH1Rule.evaluate({ model });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      confidence: 'medium',
      location: h1Elements[1]?.location,
    });
  });

  it('publishes stable complete advisory metadata and explicit component-scope limitations', () => {
    expect(multipleH1Rule.metadata).toMatchObject({
      category: 'seo',
      defaultSeverity: 'medium',
      id: 'seo/multiple-h1',
      reference: null,
      status: 'stable',
      title: 'Multiple H1 elements',
    });
    expect(multipleH1Rule.metadata.explanation.length).toBeGreaterThan(0);
    expect(multipleH1Rule.metadata.recommendation).toContain('one primary h1');
    expect(multipleH1Rule.metadata.limitations).toEqual([
      expect.stringContaining('recognized component'),
      expect.stringContaining('Conditional rendering'),
      expect.stringContaining('Custom heading'),
    ]);
  });
});

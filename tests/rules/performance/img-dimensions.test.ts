import { describe, expect, it } from 'vitest';

import { imgDimensionsRule } from '../../../src/rules/performance/img-dimensions.js';
import { modelFromJsx } from '../model-from-source.js';

describe('performance/img-dimensions', () => {
  it('accepts positive integer number literals and decimal integer strings', () => {
    const model = modelFromJsx(`
      <>
        <img width={1} height={1} />
        <img width={640} height={480} />
        <img width="640" height="480" />
        <img width="001" height="0002" />
        <img width={+320} height={180.0} />
        <img width={0} height={0} />
        <img width="000" height="0" />
      </>
    `);

    expect(imgDimensionsRule.evaluate({ model })).toEqual([]);
  });

  it('finds missing, zero, negative, fractional, and invalid literal dimensions', () => {
    const model = modelFromJsx(`
      <>
        <img />
        <img width={100} />
        <img height={100} />
        <img width={0} height={1} />
        <img width={-1} height={1} />
        <img width={1.5} height={1} />
        <img width="100px" height="50" />
        <img width="0" height="1" />
        <img width="" height="1" />
        <img width height={1} />
        <img width={null} height={1} />
      </>
    `);

    const findings = imgDimensionsRule.evaluate({ model });

    expect(findings).toHaveLength(11);
    expect(findings.every((finding) => finding.confidence === 'medium')).toBe(true);
    expect(findings.map((finding) => finding.location)).toEqual(
      model.jsxNodes
        .filter((node) => node.kind === 'element' && node.name === 'img')
        .map((node) => node.location),
    );
  });

  it('suppresses dynamic dimensions, unresolved spreads, and custom image abstractions', () => {
    const model = modelFromJsx(`
      <>
        <img width={dynamicWidth} height={100} />
        <img width={100} height={dynamicHeight} />
        <img {...imageProps} />
        <img width={100} height={100} {...imageProps} />
        <img width={100} {...imageProps} height={100} />
        <Image width={100} height={100} />
        <UI.Image />
      </>
    `);

    expect(imgDimensionsRule.evaluate({ model })).toEqual([]);
  });

  it('honors explicit dimensions that occur after a spread', () => {
    const model = modelFromJsx(`
      <>
        <img {...imageProps} width={100} height={200} />
        <img {...imageProps} width={0} height={200} />
        <img {...imageProps} width="200" height="100px" />
      </>
    `);

    const findings = imgDimensionsRule.evaluate({ model });

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.location)).toEqual([
      model.jsxNodes[2]?.location,
      model.jsxNodes[3]?.location,
    ]);
  });

  it('requires both dimensions to be known before claiming insufficient literal evidence', () => {
    const model = modelFromJsx(`
      <>
        <img width={0} height={dynamicHeight} />
        <img width={dynamicWidth} height={0} />
        <img {...imageProps} width={0} />
      </>
    `);

    expect(imgDimensionsRule.evaluate({ model })).toEqual([]);
  });

  it('reports a proven invalid dimension even when its sibling is unknown', () => {
    const model = modelFromJsx(`
      <>
        <img height={dynamicHeight} />
        <img width="100px" height={dynamicHeight} />
        <img {...imageProps} width="100px" />
      </>
    `);

    expect(imgDimensionsRule.evaluate({ model })).toHaveLength(3);
  });

  it('rejects unsafe numeric integers whose rendered decimal form is not represented exactly', () => {
    const model = modelFromJsx('<img width={1e21} height={1} />');

    expect(imgDimensionsRule.evaluate({ model })).toHaveLength(1);
  });

  it('publishes stable conservative metadata and layout-reservation limitations', () => {
    expect(imgDimensionsRule.metadata).toMatchObject({
      category: 'performance',
      defaultSeverity: 'medium',
      id: 'performance/img-dimensions',
      status: 'stable',
      title: 'Image dimensions',
    });
    expect(imgDimensionsRule.metadata.explanation).toContain('may');
    expect(imgDimensionsRule.metadata.recommendation).toContain('aspect ratio');
    expect(imgDimensionsRule.metadata.reference).toMatchObject({
      label: 'HTML Standard — Dimension attributes',
    });
    expect(imgDimensionsRule.metadata.limitations).toHaveLength(4);
    expect(imgDimensionsRule.metadata.limitations.join(' ')).toContain('External CSS');
    expect(imgDimensionsRule.metadata.limitations.join(' ')).toContain('Dynamic');
    expect(imgDimensionsRule.metadata.limitations.join(' ')).toContain('spread');
  });
});

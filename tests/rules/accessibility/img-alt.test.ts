import { describe, expect, it } from 'vitest';

import { imgAltRule } from '../../../src/rules/accessibility/img-alt.js';
import { modelFromJsx } from '../model-from-source.js';

describe('accessibility/img-alt', () => {
  it('returns one high-confidence finding for each intrinsic image with proven missing alt', () => {
    const model = modelFromJsx(`
      <>
        <img src="one.png" />
        <img />
        <img alt="Chart" src="chart.png" />
        <img alt="" src="decorative.png" />
      </>
    `);

    const findings = imgAltRule.evaluate({ model });

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.confidence)).toEqual(['high', 'high']);
    expect(findings.map((finding) => finding.message)).toEqual([
      'Intrinsic image has no explicit alt attribute.',
      'Intrinsic image has no explicit alt attribute.',
    ]);
    expect(findings.map((finding) => finding.location?.filePath)).toEqual([
      'src/RuleFixture.tsx',
      'src/RuleFixture.tsx',
    ]);
    expect(
      findings.map((finding) => [finding.location?.start.offset, finding.location?.end.offset]),
    ).toEqual([
      [52, 73],
      [82, 89],
    ]);
  });

  it('accepts descriptive and empty decorative alternatives', () => {
    const model = modelFromJsx(`
      <>
        <img alt="A chart of quarterly revenue" />
        <img alt="" />
      </>
    `);

    expect(imgAltRule.evaluate({ model })).toEqual([]);
  });

  it('does not infer custom image components or unknown spread-provided alternatives', () => {
    const model = modelFromJsx(`
      <>
        <Image />
        <UI.Image />
        <img {...imageProps} />
        <img alt="Known before an overriding spread" {...imageProps} />
        <img {...imageProps} alt="Known after the spread" />
        <img alt={dynamicAlt} />
        <img alt={null} />
      </>
    `);

    expect(imgAltRule.evaluate({ model })).toEqual([]);
  });

  it('still detects an absent alt when unrelated named attributes do not hide it', () => {
    const model = modelFromJsx('<img src="plain.png" width={100} />');

    const findings = imgAltRule.evaluate({ model });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.location).toEqual(model.jsxNodes[0]?.location);
  });

  it('publishes stable complete metadata and explicit limitations', () => {
    expect(imgAltRule.metadata).toMatchObject({
      category: 'accessibility',
      defaultSeverity: 'high',
      id: 'accessibility/img-alt',
      status: 'stable',
      title: 'Image alternative text',
    });
    expect(imgAltRule.metadata.explanation.length).toBeGreaterThan(0);
    expect(imgAltRule.metadata.recommendation).toContain('alt');
    expect(imgAltRule.metadata.reference?.label).toContain('1.1.1');
    expect(imgAltRule.metadata.limitations).toHaveLength(3);
  });
});

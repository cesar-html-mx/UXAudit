import { describe, expect, it } from 'vitest';

import { imgLazyLoadingRule } from '../../../src/rules/performance/img-lazy-loading.js';
import { modelFromJsx } from '../model-from-source.js';

describe('performance/img-lazy-loading', () => {
  it('advises on missing, eager, and invalid effective literal loading values', () => {
    const model = modelFromJsx(`
      <>
        <img />
        <img loading="eager" />
        <img loading="later" />
        <img loading=" lazy " />
        <img loading />
        <img loading={null} />
        <img loading={1} />
      </>
    `);

    const findings = imgLazyLoadingRule.evaluate({ model });

    expect(findings).toHaveLength(7);
    expect(findings.every((finding) => finding.confidence === 'medium')).toBe(true);
    expect(findings.map((finding) => finding.location)).toEqual(
      model.jsxNodes
        .filter((node) => node.kind === 'element' && node.name === 'img')
        .map((node) => node.location),
    );
    expect(findings.map((finding) => finding.message)).toEqual(
      Array.from(
        { length: 7 },
        () =>
          'Image is not statically configured with loading="lazy"; review whether lazy loading is appropriate.',
      ),
    );
  });

  it('accepts effective lazy keyword literals case-insensitively', () => {
    const model = modelFromJsx(`
      <>
        <img loading="lazy" />
        <img loading="LAZY" />
        <img loading={"LaZy"} />
        <img {...imageProps} loading="lazy" />
      </>
    `);

    expect(imgLazyLoadingRule.evaluate({ model })).toEqual([]);
  });

  it('suppresses dynamic values, unresolved spreads, and custom image abstractions', () => {
    const model = modelFromJsx(`
      <>
        <img loading={loadingMode} />
        <img {...imageProps} />
        <img loading="lazy" {...imageProps} />
        <img loading="eager" {...imageProps} />
        <Image />
        <UI.Image />
      </>
    `);

    expect(imgLazyLoadingRule.evaluate({ model })).toEqual([]);
  });

  it('honors right-to-left JSX override order around spreads', () => {
    const model = modelFromJsx(`
      <>
        <img {...imageProps} loading="eager" />
        <img {...imageProps} loading="invalid" />
        <img loading="eager" {...imageProps} loading="lazy" />
      </>
    `);

    const findings = imgLazyLoadingRule.evaluate({ model });

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.location)).toEqual([
      model.jsxNodes[1]?.location,
      model.jsxNodes[2]?.location,
    ]);
  });

  it('publishes stable advisory metadata with explicit uncertainty limits', () => {
    expect(imgLazyLoadingRule.metadata).toMatchObject({
      category: 'performance',
      defaultSeverity: 'low',
      id: 'performance/img-lazy-loading',
      status: 'stable',
      title: 'Image lazy loading',
    });
    expect(imgLazyLoadingRule.metadata.explanation).toContain('may');
    expect(imgLazyLoadingRule.metadata.recommendation).toContain('above the fold');
    expect(imgLazyLoadingRule.metadata.reference).toMatchObject({
      label: 'HTML Standard — Lazy loading attributes',
    });
    expect(imgLazyLoadingRule.metadata.limitations).toHaveLength(3);
    expect(imgLazyLoadingRule.metadata.limitations.join(' ')).toContain('eager');
    const limitations = imgLazyLoadingRule.metadata.limitations.join(' ').toLowerCase();
    expect(limitations).toContain('dynamic');
    expect(limitations).toContain('spread');
  });
});

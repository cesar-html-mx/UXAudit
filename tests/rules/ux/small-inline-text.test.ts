import { describe, expect, it } from 'vitest';

import type { AnalysisModel } from '../../../src/domain/models/analysis-model.js';
import type { SourceLocation } from '../../../src/domain/models/source-location.js';
import {
  createSmallInlineTextRule,
  smallInlineTextRule,
  type SmallInlineTextRuleConfiguration,
} from '../../../src/rules/ux/small-inline-text.js';
import { uxRules } from '../../../src/rules/ux/ux-rules.js';
import { modelFromJsx } from '../model-from-source.js';

const getFontSizePropertyLocations = (model: AnalysisModel): readonly SourceLocation[] =>
  model.jsxNodes.flatMap((node) => {
    if (node.kind !== 'element') {
      return [];
    }

    return node.attributes.flatMap((attribute) => {
      if (attribute.kind !== 'named' || attribute.value.kind !== 'object') {
        return [];
      }

      return attribute.value.properties
        .filter((property) => property.name === 'fontSize')
        .map((property) => property.location);
    });
  });

describe('ux/small-inline-text', () => {
  it('finds supported non-negative numeric and pixel sizes below the default threshold', () => {
    const model = modelFromJsx(`
      <>
        <span style={{ fontSize: 0 }}>Zero pixels</span>
        <p style={{ fontSize: 11.999 }}>Decimal pixels</p>
        <small style={{ fontSize: '11px' }}>String pixels</small>
        <label style={{ fontSize: ' .5PX ' }}>Case-insensitive pixels</label>
        <div style={{ fontSize: '1e1px' }}>Exponent pixels</div>
        <span style={{ fontSize: 12 }}>At threshold</span>
        <span style={{ fontSize: '12px' }}>String at threshold</span>
        <span style={{ fontSize: 13 }}>Above threshold</span>
      </>
    `);

    const firstRun = smallInlineTextRule.evaluate({ model });
    const secondRun = smallInlineTextRule.evaluate({ model });
    const propertyLocations = getFontSizePropertyLocations(model);

    expect(firstRun).toEqual(secondRun);
    expect(firstRun).toHaveLength(5);
    expect(firstRun.map((finding) => finding.confidence)).toEqual(
      Array.from({ length: 5 }, () => 'high'),
    );
    expect(firstRun.map((finding) => finding.message)).toEqual(
      Array.from({ length: 5 }, () => 'Literal inline text may be too small.'),
    );
    expect(firstRun.map((finding) => finding.location)).toEqual(propertyLocations.slice(0, 5));
    expect(firstRun.every((finding) => finding.location?.filePath === 'src/RuleFixture.tsx')).toBe(
      true,
    );
  });

  it('requires an intrinsic element with known non-empty static text', () => {
    const model = modelFromJsx(`
      <>
        <Text style={{ fontSize: 10 }}>Custom text</Text>
        <UI.Text style={{ fontSize: 10 }}>Member text</UI.Text>
        <span style={{ fontSize: 10 }}>   </span>
        <span style={{ fontSize: 10 }}>{dynamicOnly}</span>
        <span style={{ fontSize: 10 }}><Icon /></span>
        <span style={{ fontSize: 10 }}>Known {dynamicSuffix}</span>
        <p style={{ fontSize: 10 }}><strong>Known nested text</strong></p>
      </>
    `);

    const findings = smallInlineTextRule.evaluate({ model });

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.location?.start.line)).toEqual([8, 9]);
    expect(findings.map((finding) => finding.confidence)).toEqual(['medium', 'high']);
  });

  it('excludes inert, metadata, and void element content from the visible-text scope', () => {
    const model = modelFromJsx(`
      <>
        <script style={{ fontSize: 1 }}>script text</script>
        <style style={{ fontSize: 1 }}>style text</style>
        <template style={{ fontSize: 1 }}>template text</template>
        <title style={{ fontSize: 1 }}>title text</title>
        <img style={{ fontSize: 1 }}>invalid child text</img>
      </>
    `);

    expect(smallInlineTextRule.evaluate({ model })).toEqual([]);
  });

  it('omits missing, dynamic, non-object, partial, and unknown object styles', () => {
    const model = modelFromJsx(`
      <>
        <span>No style</span>
        <span style={styles.small}>Dynamic style</span>
        <span style={null}>Null style</span>
        <span style="font-size: 10px">String style</span>
        <span style={{ color: 'red' }}>No font size</span>
        <span style={{ fontSize: dynamicSize }}>Dynamic size</span>
        <span style={{ fontSize: 10, color: dynamicColor }}>Partial object</span>
        <span style={{ ...sharedStyle, fontSize: 10 }}>Object spread</span>
        <span style={{ [propertyName]: 1, fontSize: 10 }}>Computed property</span>
      </>
    `);

    expect(smallInlineTextRule.evaluate({ model })).toEqual([]);
  });

  it('resolves JSX style overrides from right to left around spreads', () => {
    const model = modelFromJsx(`
      <>
        <span style={{ fontSize: 8 }} {...props}>Later spread is unknown</span>
        <span {...props} style={{ fontSize: 8 }}>Later style is known</span>
        <span style={{ fontSize: 8 }} style={{ fontSize: 14 }}>Later large style</span>
        <span style={{ fontSize: 14 }} style={{ fontSize: 8 }}>Later small style</span>
      </>
    `);

    const findings = smallInlineTextRule.evaluate({ model });
    const propertyLocations = getFontSizePropertyLocations(model);

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.location)).toEqual([
      propertyLocations[1],
      propertyLocations[5],
    ]);
  });

  it('uses the last exact fontSize property in an object literal', () => {
    const model = modelFromJsx(`
      <>
        <span style={{ fontSize: 8, fontSize: 14 }}>Later large property</span>
        <span style={{ fontSize: 14, fontSize: 8 }}>Later small property</span>
      </>
    `);

    const findings = smallInlineTextRule.evaluate({ model });
    const propertyLocations = getFontSizePropertyLocations(model);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.location).toEqual(propertyLocations[3]);
  });

  it('omits negative, unsupported-unit, calculated, non-finite, and non-numeric values', () => {
    const model = modelFromJsx(`
      <>
        <span style={{ fontSize: -1 }}>Negative number</span>
        <span style={{ fontSize: '-1px' }}>Negative pixels</span>
        <span style={{ fontSize: '11' }}>Unitless string</span>
        <span style={{ fontSize: '0.75rem' }}>Rem value</span>
        <span style={{ fontSize: '11em' }}>Em value</span>
        <span style={{ fontSize: '50%' }}>Percentage value</span>
        <span style={{ fontSize: 'calc(10px + 1vw)' }}>Calculated value</span>
        <span style={{ fontSize: '1.px' }}>Missing fractional digits</span>
        <span style={{ fontSize: '1.e2px' }}>Missing fractional exponent digits</span>
        <span style={{ fontSize: '\\u00A01px\\u00A0' }}>Non-breaking spaces</span>
        <span style={{ fontSize: '\\u20031px\\u2003' }}>Em spaces</span>
        <span style={{ fontSize: '\\uFEFF1px\\uFEFF' }}>Byte-order marks</span>
        <span style={{ fontSize: '1e309px' }}>Infinite pixel string</span>
        <span style={{ fontSize: 1e400 }}>Infinite number</span>
        <span style={{ fontSize: true }}>Boolean value</span>
        <span style={{ fontSize: null }}>Null value</span>
      </>
    `);

    expect(smallInlineTextRule.evaluate({ model })).toEqual([]);
  });

  it('supports a validated custom threshold and keeps the boundary exclusive', () => {
    const model = modelFromJsx(`
      <>
        <span style={{ fontSize: 12 }}>Below custom threshold</span>
        <span style={{ fontSize: 14 }}>At custom threshold</span>
      </>
    `);
    const customRule = createSmallInlineTextRule({ thresholdPx: 14 });

    expect(smallInlineTextRule.evaluate({ model })).toEqual([]);
    expect(customRule.evaluate({ model })).toHaveLength(1);
    expect(customRule.metadata.recommendation).toContain('at least 14px');
  });

  it('rejects invalid configuration without invoking accessors', () => {
    let getterCalled = false;
    const accessorConfiguration = Object.defineProperty({}, 'thresholdPx', {
      enumerable: true,
      get: () => {
        getterCalled = true;
        return 12;
      },
    });
    const invalidConfigurations: readonly unknown[] = [
      null,
      [],
      { thresholdPx: 0 },
      { thresholdPx: -1 },
      { thresholdPx: Number.NaN },
      { thresholdPx: Number.POSITIVE_INFINITY },
      { thresholdPx: '12' },
      { thresholdPx: 12, unexpected: true },
      { [Symbol('thresholdPx')]: 12 },
      new Date(),
      accessorConfiguration,
      new Proxy(
        {},
        {
          ownKeys: () => {
            throw new Error('PROXY_OWN_KEYS_SECRET');
          },
        },
      ),
      new Proxy(
        { thresholdPx: 12 },
        {
          getOwnPropertyDescriptor: () => {
            throw new Error('PROXY_DESCRIPTOR_SECRET');
          },
        },
      ),
    ];

    for (const configuration of invalidConfigurations) {
      expect(() =>
        createSmallInlineTextRule(configuration as SmallInlineTextRuleConfiguration),
      ).toThrow('Small inline text thresholdPx must be a finite number greater than zero.');
    }

    expect(getterCalled).toBe(false);
  });

  it('publishes stable complete metadata and a frozen default UX catalog', () => {
    expect(smallInlineTextRule.metadata).toMatchObject({
      category: 'ux',
      defaultSeverity: 'medium',
      id: 'ux/small-inline-text',
      reference: null,
      status: 'stable',
      title: 'Very small literal inline text',
    });
    expect(smallInlineTextRule.metadata.explanation.length).toBeGreaterThan(0);
    expect(smallInlineTextRule.metadata.recommendation).toContain('at least 12px');
    expect(smallInlineTextRule.metadata.limitations).toHaveLength(5);
    expect(Object.isFrozen(smallInlineTextRule)).toBe(true);
    expect(Object.isFrozen(smallInlineTextRule.metadata)).toBe(true);
    expect(Object.isFrozen(smallInlineTextRule.metadata.limitations)).toBe(true);
    expect(uxRules).toEqual([smallInlineTextRule]);
    expect(Object.isFrozen(uxRules)).toBe(true);
  });
});

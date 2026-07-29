import { describe, expect, it } from 'vitest';

import { inputLabelRule } from '../../../src/rules/accessibility/input-label.js';
import { modelFromJsx, modelFromSource } from '../model-from-source.js';

describe('accessibility/input-label', () => {
  it('finds unlabeled input, select, and textarea controls', () => {
    const model = modelFromJsx(`
      <>
        <input />
        <select />
        <textarea />
      </>
    `);

    const findings = inputLabelRule.evaluate({ model });

    expect(findings).toHaveLength(3);
    expect(findings.every((finding) => finding.confidence === 'high')).toBe(true);
    expect(findings.map((finding) => finding.message)).toEqual(
      Array.from(
        { length: 3 },
        () => 'Form control has no statically associated label or accessible name.',
      ),
    );
  });

  it('accepts nested labels, same-component htmlFor/id, and non-empty ARIA names', () => {
    const model = modelFromJsx(`
      <>
        <label><input /></label>
        <label htmlFor="email">Email</label>
        <input id="email" />
        <label for="query">Query</label>
        <input id="query" />
        <input aria-label="Search" />
        <select aria-labelledby="country-label" />
        <textarea aria-label="Notes" />
      </>
    `);

    expect(inputLabelRule.evaluate({ model })).toEqual([]);
  });

  it('excludes the documented input types case-insensitively', () => {
    const model = modelFromJsx(`
      <>
        <input type="hidden" />
        <input type="BUTTON" />
        <input type="submit" />
        <input type="reset" />
        <input type="image" />
      </>
    `);

    expect(inputLabelRule.evaluate({ model })).toEqual([]);
  });

  it('treats dynamic types, IDs, ARIA values, and spreads as unsupported', () => {
    const model = modelFromJsx(`
      <>
        <input type={dynamicType} />
        <input id={dynamicId} />
        <input aria-label={dynamicLabel} />
        <input aria-labelledby={dynamicId} />
        <input {...inputProps} />
        <label htmlFor={dynamicId}>Dynamic target</label>
        <input id="known-control" />
        <label {...labelProps}>Spread target</label>
        <input id="another-known-control" />
      </>
    `);

    expect(inputLabelRule.evaluate({ model })).toEqual([]);
  });

  it('finds empty or null ARIA names, empty IDs, and a null default input type', () => {
    const model = modelFromJsx(`
      <>
        <input id="" />
        <input aria-label="" />
        <input aria-label={null} />
        <textarea aria-labelledby=" " />
        <textarea aria-labelledby={null} />
        <input type={null} />
      </>
    `);

    expect(inputLabelRule.evaluate({ model })).toHaveLength(6);
  });

  it('requires literal htmlFor/id equality without trimming', () => {
    const model = modelFromJsx(`
      <>
        <label htmlFor=" spaced ">Spaced</label>
        <input id="spaced" />
      </>
    `);

    expect(inputLabelRule.evaluate({ model })).toHaveLength(1);
  });

  it('does not treat a nested label targeting another ID as association', () => {
    const model = modelFromJsx(`
      <label htmlFor="other">
        Email
        <input id="email" />
      </label>
    `);

    expect(inputLabelRule.evaluate({ model })).toHaveLength(1);
  });

  it('treats a known-null nested htmlFor as absent and preserves nesting', () => {
    const model = modelFromJsx('<label htmlFor={null}><input /></label>');

    expect(inputLabelRule.evaluate({ model })).toEqual([]);
  });

  it('does not associate a label and control across component scopes', () => {
    const model = modelFromSource(`
      export const LabelComponent = () => <label htmlFor="shared">Shared</label>;
      export const ControlComponent = () => <input id="shared" />;
    `);

    const findings = inputLabelRule.evaluate({ model });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.location?.start.line).toBe(3);
  });

  it('does not associate separate unowned JSX scopes through a file-level ID match', () => {
    const model = modelFromSource(`
      export const labelHelper = () => <label htmlFor="shared">Shared</label>;
      export const controlHelper = () => <input id="shared" />;
    `);

    const findings = inputLabelRule.evaluate({ model });

    expect(findings).toHaveLength(1);
  });

  it('documents the unsupported multi-control nested-label constraint', () => {
    const model = modelFromJsx(`
      <label>
        Group
        <input />
        <input />
      </label>
    `);

    expect(inputLabelRule.evaluate({ model })).toEqual([]);
  });

  it('publishes stable complete metadata and association limitations', () => {
    expect(inputLabelRule.metadata).toMatchObject({
      category: 'accessibility',
      defaultSeverity: 'high',
      id: 'accessibility/input-label',
      status: 'stable',
      title: 'Form input label',
    });
    expect(inputLabelRule.metadata.reference?.label).toContain('1.3.1');
    expect(inputLabelRule.metadata.limitations).toHaveLength(5);
    expect(inputLabelRule.metadata.limitations).toContain(
      'A nested label is not checked for the one-labelable-descendant content constraint.',
    );
  });
});

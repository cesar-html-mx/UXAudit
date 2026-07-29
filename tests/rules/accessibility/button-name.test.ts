import { describe, expect, it } from 'vitest';

import { buttonNameRule } from '../../../src/rules/accessibility/button-name.js';
import { modelFromJsx } from '../model-from-source.js';

describe('accessibility/button-name', () => {
  it('finds empty buttons and definitively empty naming attributes', () => {
    const model = modelFromJsx(`
      <>
        <button />
        <button>   </button>
        <button aria-label="" />
        <button aria-labelledby=" " />
      </>
    `);

    const findings = buttonNameRule.evaluate({ model });

    expect(findings).toHaveLength(4);
    expect(findings.every((finding) => finding.confidence === 'high')).toBe(true);
    expect(findings.every((finding) => finding.location?.filePath === 'src/RuleFixture.tsx')).toBe(
      true,
    );
    expect(findings.map((finding) => finding.message)).toEqual(
      Array.from({ length: 4 }, () => 'Button has no statically determinable accessible name.'),
    );
  });

  it('accepts visible static text, known partial text, and non-empty ARIA names', () => {
    const model = modelFromJsx(`
      <>
        <button>Save</button>
        <button><span>Delete item</span></button>
        <button>Save {dynamicSuffix}</button>
        <button aria-label="Close" />
        <button aria-labelledby="dialog-title" />
      </>
    `);

    expect(buttonNameRule.evaluate({ model })).toEqual([]);
  });

  it('treats dynamic-only names, custom icon content, and spreads as unsupported', () => {
    const model = modelFromJsx(`
      <>
        <button>{dynamicName}</button>
        <button><Icon /></button>
        <button {...buttonProps} />
        <button aria-label={dynamicName} />
        <button aria-labelledby={dynamicId} />
        <Button />
      </>
    `);

    expect(buttonNameRule.evaluate({ model })).toEqual([]);
  });

  it('does not let an empty ARIA attribute override proven visible text', () => {
    const model = modelFromJsx('<button aria-label="">Visible action</button>');

    expect(buttonNameRule.evaluate({ model })).toEqual([]);
  });

  it('treats exact null ARIA values as absent evidence', () => {
    const model = modelFromJsx(`
      <>
        <button aria-label={null} />
        <button aria-labelledby={null} />
      </>
    `);

    expect(buttonNameRule.evaluate({ model })).toHaveLength(2);
  });

  it('publishes stable complete metadata and accessible-name limitations', () => {
    expect(buttonNameRule.metadata).toMatchObject({
      category: 'accessibility',
      defaultSeverity: 'high',
      id: 'accessibility/button-name',
      status: 'stable',
      title: 'Button accessible name',
    });
    expect(buttonNameRule.metadata.reference?.label).toContain('4.1.2');
    expect(buttonNameRule.metadata.limitations).toHaveLength(3);
  });
});

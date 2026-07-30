import { describe, expect, it } from 'vitest';

import {
  AMBIGUOUS_LINK_TEXT_CONFIGURATION_ERROR_CODES,
  AmbiguousLinkTextConfigurationError,
  DEFAULT_AMBIGUOUS_LINK_TEXTS,
  ambiguousLinkTextRule,
  createAmbiguousLinkTextRule,
} from '../../../src/rules/seo/ambiguous-link-text.js';
import { modelFromJsx } from '../model-from-source.js';

describe('seo/ambiguous-link-text', () => {
  it('finds every exact default phrase after deterministic Unicode, whitespace, and case normalization', () => {
    const model = modelFromJsx(`
      <>
        <a href="/one">CLICK HERE</a>
        <a href="/two">  here  </a>
        <a href="/three">Read <span>more</span></a>
        <a href="/four">{'AQUI\\u0301'}</a>
        <a href="/five">VER MÁS</a>
      </>
    `);
    const expectedLocations = model.jsxNodes
      .filter((node) => node.kind === 'element' && node.name === 'a')
      .map((node) => node.location);

    const findings = ambiguousLinkTextRule.evaluate({ model });

    expect(findings).toHaveLength(5);
    expect(findings.map((finding) => finding.location)).toEqual(expectedLocations);
    expect(findings.every((finding) => finding.confidence === 'medium')).toBe(true);
    expect(findings.every((finding) => finding.message.includes('contextual review'))).toBe(true);
  });

  it('requires a complete phrase match and ignores descriptive, punctuated, empty, and custom links', () => {
    const model = modelFromJsx(`
      <>
        <a href="/guide">Read more about deterministic audits</a>
        <a href="/details">Read more!</a>
        <a href="/empty"></a>
        <Link href="/custom">Read more</Link>
        <UI.Link href="/member">Click here</UI.Link>
      </>
    `);

    expect(ambiguousLinkTextRule.evaluate({ model })).toEqual([]);
  });

  it('omits partial and dynamic text even when the retained portion matches a configured phrase', () => {
    const model = modelFromJsx(`
      <>
        <a href="/partial">Read more {dynamicSuffix}</a>
        <a href="/dynamic">{dynamicLabel}</a>
        <a href="/custom-child"><Icon />Read more</a>
      </>
    `);

    expect(ambiguousLinkTextRule.evaluate({ model })).toEqual([]);
  });

  it('reports exact ambiguous visible text even when another accessible name may add context', () => {
    const model = modelFromJsx(
      '<a href="/report" aria-label="Read the complete quarterly report">Read more</a>',
    );

    const findings = ambiguousLinkTextRule.evaluate({ model });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe('medium');
  });

  it('supports a normalized, deduplicated custom phrase set without retaining defaults', () => {
    const rule = createAmbiguousLinkTextRule({
      ambiguousTexts: ['Continue', ' CONTINUE ', 'Details'],
    });
    const model = modelFromJsx(`
      <>
        <a href="/continue">continue</a>
        <a href="/details">DETAILS</a>
        <a href="/default">Read more</a>
      </>
    `);

    const findings = rule.evaluate({ model });

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.location)).toEqual([
      model.jsxNodes[1]?.location,
      model.jsxNodes[2]?.location,
    ]);
  });

  it.each([
    { ambiguousTexts: [] },
    { ambiguousTexts: ['  '] },
    { ambiguousTexts: ['Valid', 7] },
    { ambiguousTexts: null },
    { ambiguousTexts: new Array(1) },
    { unknownOption: ['Here'] },
    { [Symbol('unknownOption')]: ['Here'] },
    Object.defineProperty({}, 'unknownOption', {
      value: ['Here'],
    }),
    Object.create({ ambiguousTexts: ['Here'] }),
    new Date(),
    null,
  ])('rejects malformed configuration without reflecting its value: %j', (configuration) => {
    let observed: unknown;

    try {
      createAmbiguousLinkTextRule(
        configuration as Parameters<typeof createAmbiguousLinkTextRule>[0],
      );
    } catch (error) {
      observed = error;
    }

    expect(observed).toBeInstanceOf(AmbiguousLinkTextConfigurationError);
    expect(observed).toMatchObject({
      code: AMBIGUOUS_LINK_TEXT_CONFIGURATION_ERROR_CODES.invalidConfiguration,
      message: 'Ambiguous link text rule configuration is invalid.',
      name: 'AmbiguousLinkTextConfigurationError',
    });
    expect(JSON.stringify(observed)).not.toContain(JSON.stringify(configuration));
  });

  it('rejects accessors and hostile proxies through the stable configuration error', () => {
    let getterCalled = false;
    const configurations: readonly unknown[] = [
      Object.defineProperty({}, 'ambiguousTexts', {
        get: () => {
          getterCalled = true;
          return ['Here'];
        },
      }),
      new Proxy(
        {},
        {
          ownKeys: () => {
            throw new Error('HOSTILE_OWN_KEYS_DETAIL');
          },
        },
      ),
      {
        ambiguousTexts: new Proxy(['Here'], {
          getOwnPropertyDescriptor: () => {
            throw new Error('HOSTILE_ARRAY_DETAIL');
          },
        }),
      },
    ];

    for (const configuration of configurations) {
      expect(() =>
        createAmbiguousLinkTextRule(
          configuration as Parameters<typeof createAmbiguousLinkTextRule>[0],
        ),
      ).toThrow(AmbiguousLinkTextConfigurationError);

      try {
        createAmbiguousLinkTextRule(
          configuration as Parameters<typeof createAmbiguousLinkTextRule>[0],
        );
      } catch (error) {
        expect(error).toMatchObject({
          code: AMBIGUOUS_LINK_TEXT_CONFIGURATION_ERROR_CODES.invalidConfiguration,
          message: 'Ambiguous link text rule configuration is invalid.',
        });
        expect(String(error)).not.toContain('HOSTILE_');
      }
    }

    expect(getterCalled).toBe(false);
  });

  it('publishes immutable defaults and stable complete metadata', () => {
    expect(DEFAULT_AMBIGUOUS_LINK_TEXTS).toEqual([
      'click here',
      'here',
      'read more',
      'aquí',
      'ver más',
    ]);
    expect(Object.isFrozen(DEFAULT_AMBIGUOUS_LINK_TEXTS)).toBe(true);
    expect(ambiguousLinkTextRule.metadata).toMatchObject({
      category: 'seo',
      defaultSeverity: 'medium',
      id: 'seo/ambiguous-link-text',
      reference: null,
      status: 'stable',
      title: 'Ambiguous link text',
    });
    expect(ambiguousLinkTextRule.metadata.explanation.length).toBeGreaterThan(0);
    expect(ambiguousLinkTextRule.metadata.recommendation.length).toBeGreaterThan(0);
    expect(ambiguousLinkTextRule.metadata.limitations).toHaveLength(3);
  });
});

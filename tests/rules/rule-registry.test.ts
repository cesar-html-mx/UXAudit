import { describe, expect, it } from 'vitest';

import type { Rule } from '../../src/domain/rules/rule.js';
import {
  RULE_REGISTRY_ERROR_CODES,
  RuleRegistryError,
  createRuleRegistry,
} from '../../src/rules/rule-registry.js';
import { createTestRule } from './rule-test-helpers.js';

describe('rule registry', () => {
  it('copies, freezes, and ordinally orders an explicit registry', () => {
    const first = createTestRule({
      category: 'accessibility',
      id: 'accessibility/alpha',
    });
    const mutableLimitations = ['Original limitation.'];
    const second = {
      ...createTestRule({
        category: 'seo',
        id: 'seo/zeta',
      }),
      metadata: {
        ...createTestRule({
          category: 'seo',
          id: 'seo/zeta',
        }).metadata,
        limitations: mutableLimitations,
        reference: {
          label: 'Owned reference',
          url: 'https://example.test/reference',
        },
      },
    };

    const registry = createRuleRegistry([second, first]);
    mutableLimitations[0] = 'Changed after registration.';

    expect(registry.rules.map((rule) => rule.metadata.id)).toEqual([
      'accessibility/alpha',
      'seo/zeta',
    ]);
    expect(registry.rules[1]?.metadata.limitations).toEqual(['Original limitation.']);
    expect(registry.rules[1]?.metadata.reference).toEqual({
      label: 'Owned reference',
      url: 'https://example.test/reference',
    });
    expect(registry.rules[1]?.metadata.reference).not.toBe(second.metadata.reference);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.rules)).toBe(true);
    expect(Object.isFrozen(registry.rules[0]?.metadata)).toBe(true);
    expect(Object.isFrozen(registry.rules[0]?.metadata.limitations)).toBe(true);
  });

  it('allows an explicit empty registry', () => {
    expect(createRuleRegistry([]).rules).toEqual([]);
  });

  it('rejects duplicate IDs without reflecting the ID into the error', () => {
    const duplicate = createTestRule();

    expect(() => createRuleRegistry([duplicate, duplicate])).toThrow(
      expect.objectContaining({
        code: RULE_REGISTRY_ERROR_CODES.duplicateRuleId,
        message: 'Rule registry contains a duplicate rule ID.',
        name: 'RuleRegistryError',
      }),
    );

    try {
      createRuleRegistry([duplicate, duplicate]);
    } catch (error) {
      expect(error).toBeInstanceOf(RuleRegistryError);
      expect(String(error)).not.toContain(duplicate.metadata.id);
      expect(error).not.toHaveProperty('cause');
    }
  });

  it.each([
    ['mismatched category', { id: 'seo/test-rule' }],
    ['invalid ID', { id: 'Accessibility/Test' }],
    ['empty title', { title: '' }],
    ['padded explanation', { explanation: ' padded ' }],
    ['unknown severity', { defaultSeverity: 'urgent' }],
    ['unknown status', { status: 'enabled' }],
    ['empty limitations', { limitations: [] }],
    ['invalid limitation', { limitations: [''] }],
    ['invalid reference', { reference: { label: '', url: null } }],
    ['invalid URL', { reference: { label: 'Reference', url: '' } }],
    ['unsafe URL scheme', { reference: { label: 'Reference', url: 'javascript:alert(1)' } }],
    [
      'credential-bearing URL',
      { reference: { label: 'Reference', url: 'https://user:secret@example.test/' } },
    ],
    ['deferred executable status', { status: 'deferred' }],
  ])('rejects %s metadata through one stable boundary', (_label, metadataOverride) => {
    const valid = createTestRule();
    const invalid = {
      ...valid,
      metadata: {
        ...valid.metadata,
        ...metadataOverride,
      },
    } as unknown as Rule;

    expect(() => createRuleRegistry([invalid])).toThrow(
      expect.objectContaining({
        code: RULE_REGISTRY_ERROR_CODES.invalidRule,
        message: 'Rule registry contains invalid rule metadata.',
      }),
    );
  });

  it('normalizes a throwing metadata accessor without leaking its cause', () => {
    const invalid = {
      evaluate: () => [],
      get metadata(): never {
        throw new Error('sensitive registry detail');
      },
    } as unknown as Rule;

    expect(() => createRuleRegistry([invalid])).toThrow(
      expect.objectContaining({
        code: RULE_REGISTRY_ERROR_CODES.invalidRule,
        message: 'Rule registry contains invalid rule metadata.',
      }),
    );

    try {
      createRuleRegistry([invalid]);
    } catch (error) {
      expect(String(error)).not.toContain('sensitive registry detail');
      expect(error).not.toHaveProperty('cause');
    }
  });

  it('rejects a value without an evaluation operation', () => {
    const invalid = {
      metadata: createTestRule().metadata,
    } as unknown as Rule;

    expect(() => createRuleRegistry([invalid])).toThrow(RuleRegistryError);
  });

  it('rejects a rule whose metadata is not a record', () => {
    const invalid = {
      evaluate: () => [],
      metadata: null,
    } as unknown as Rule;

    expect(() => createRuleRegistry([invalid])).toThrow(RuleRegistryError);
  });
});

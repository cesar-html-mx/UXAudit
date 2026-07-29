import { describe, expect, it } from 'vitest';

import { PRODUCT_NAME } from '../src/index.js';

describe('product metadata', () => {
  it('exposes the product name', () => {
    expect(PRODUCT_NAME).toBe('UXAudit');
  });
});

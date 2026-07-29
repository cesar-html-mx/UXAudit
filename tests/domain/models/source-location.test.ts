import { describe, expect, expectTypeOf, it } from 'vitest';

import type { SourceLocation, SourcePosition } from '../../../src/domain/models/source-location.js';

describe('source location contracts', () => {
  it('retains a portable relative path and a half-open UTF-16 range', () => {
    const start: SourcePosition = {
      column: 0,
      line: 1,
      offset: 0,
    };
    const end: SourcePosition = {
      column: 2,
      line: 1,
      offset: 2,
    };
    const location: SourceLocation = {
      end,
      filePath: 'src/emoji.tsx',
      start,
    };

    expect(location).toEqual({
      end: { column: 2, line: 1, offset: 2 },
      filePath: 'src/emoji.tsx',
      start: { column: 0, line: 1, offset: 0 },
    });
    expectTypeOf(location.start.line).toBeNumber();
    expectTypeOf(location.filePath).toBeString();
  });
});

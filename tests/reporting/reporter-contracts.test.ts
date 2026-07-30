import { describe, expect, expectTypeOf, it } from 'vitest';

import type { Reporter } from '../../src/reporting/reporter.js';
import { createAuditResultFixture } from './audit-result-fixture.js';

describe('Reporter contract', () => {
  it('renders exactly one supplied AuditResult without presentation state in the domain', () => {
    const received: unknown[] = [];
    const reporter: Reporter = {
      format: 'json',
      render: (result) => {
        received.push(result);
        return `${result.schemaVersion}\n`;
      },
    };
    const result = createAuditResultFixture();

    expect(reporter.render(result)).toBe('1.0.0\n');
    expect(received).toEqual([result]);
    expectTypeOf(reporter).toExtend<Reporter>();
  });
});

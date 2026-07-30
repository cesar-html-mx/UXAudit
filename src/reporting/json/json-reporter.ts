import { REPORT_FORMATS } from '../../configuration/configuration.js';
import type { AuditResult } from '../../domain/audit/audit-result.js';
import type { Reporter } from '../reporter.js';

export const renderJsonReport = (result: AuditResult): string =>
  `${JSON.stringify(result, null, 2)}\n`;

export const jsonReporter: Reporter = Object.freeze({
  format: REPORT_FORMATS.json,
  render: renderJsonReport,
});

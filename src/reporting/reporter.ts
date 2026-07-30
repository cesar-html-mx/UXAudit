import type { AuditResult } from '../domain/audit/audit-result.js';
import type { ReportFormat } from '../configuration/configuration.js';

/**
 * Pure presentation boundary. A reporter receives one completed result and
 * neither discovers source files nor evaluates rules.
 */
export interface Reporter {
  readonly format: ReportFormat;
  readonly render: (result: AuditResult) => string;
}

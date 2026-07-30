import { Command, CommanderError, InvalidArgumentError } from 'commander';

import {
  AuditProjectError,
  type AuditProject,
  type AuditProjectRequest,
  type AuditProjectResult,
} from '../application/audit-project.js';
import {
  AnalyzeProjectError,
  type AnalyzeProject,
  type AnalyzeProjectResult,
} from '../application/analyze-project.js';
import {
  SCAN_PROJECT_ERROR_CODES,
  ScanProjectError,
  type ScanProject,
  type ScanProjectResult,
} from '../application/scan-project.js';
import {
  ConfigurationError,
  REPORT_FORMATS,
  type AuditConfigurationOverrides,
  type ReportFormat,
} from '../configuration/configuration.js';
import { PROJECT_PATH_ERROR_CODES, ProjectPathError } from '../project/validate-project-path.js';
import { ReportWriteError } from '../reporting/files/write-report-file.js';
import { renderTerminalReport } from '../reporting/terminal/terminal-reporter.js';
import {
  RULE_CATEGORIES,
  RULE_SEVERITIES,
  type RuleCategory,
  type RuleSeverity,
} from '../domain/rules/rule.js';
import { PRODUCT_NAME, PRODUCT_VERSION } from '../index.js';
import {
  sanitizeTerminalOutput,
  sanitizeTerminalRecord,
  sanitizeTerminalValue,
} from './sanitize-terminal.js';

export const EXIT_CODES = {
  findingPolicy: 1,
  success: 0,
  input: 2,
  internal: 3,
} as const;

export interface CliIo {
  readonly writeOut: (value: string) => void;
  readonly writeErr: (value: string) => void;
}

export interface CliDependencies {
  readonly analyzeProject?: AnalyzeProject;
  readonly auditProject?: AuditProject;
  readonly io: CliIo;
  readonly scanProject: ScanProject;
}

interface ScanCommandOptions {
  readonly category?: readonly RuleCategory[];
  readonly color?: boolean;
  readonly config?: string;
  readonly format?: readonly ReportFormat[];
  readonly output?: string;
  readonly rule?: readonly string[];
  readonly severity?: RuleSeverity;
  readonly verbose?: boolean;
}

const categories: readonly RuleCategory[] = [
  RULE_CATEGORIES.accessibility,
  RULE_CATEGORIES.performance,
  RULE_CATEGORIES.seo,
  RULE_CATEGORIES.ux,
];
const formats: readonly ReportFormat[] = [
  REPORT_FORMATS.terminal,
  REPORT_FORMATS.json,
  REPORT_FORMATS.html,
];
const severities: readonly RuleSeverity[] = [
  RULE_SEVERITIES.info,
  RULE_SEVERITIES.low,
  RULE_SEVERITIES.medium,
  RULE_SEVERITIES.high,
  RULE_SEVERITIES.critical,
];

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown internal failure';

const collectOption = <Value>(value: Value, previous: readonly Value[] | undefined): Value[] =>
  previous?.includes(value) === true ? [...previous] : [...(previous ?? []), value];

const parseCategory = (
  value: string,
  previous: readonly RuleCategory[] | undefined,
): readonly RuleCategory[] => {
  if (!categories.includes(value as RuleCategory)) {
    throw new InvalidArgumentError(`allowed values: ${categories.join(', ')}`);
  }

  return collectOption(value as RuleCategory, previous);
};

const parseFormat = (
  value: string,
  previous: readonly ReportFormat[] | undefined,
): readonly ReportFormat[] => {
  if (value === 'all') {
    return [...formats];
  }

  if (!formats.includes(value as ReportFormat)) {
    throw new InvalidArgumentError(`allowed values: ${formats.join(', ')}, all`);
  }

  return collectOption(value as ReportFormat, previous);
};

const parseRule = (value: string, previous: readonly string[] | undefined): readonly string[] =>
  collectOption(value, previous);

const parseSeverity = (value: string): RuleSeverity => {
  if (!severities.includes(value as RuleSeverity)) {
    throw new InvalidArgumentError(`allowed values: ${severities.join(', ')}`);
  }

  return value as RuleSeverity;
};

const hasCliValue = (command: Command, name: string): boolean =>
  command.getOptionValueSource(name) === 'cli';

const createAuditRequest = (
  projectPath: string,
  command: Command,
  options: ScanCommandOptions,
): AuditProjectRequest => {
  const overrides: AuditConfigurationOverrides = {
    ...(hasCliValue(command, 'category') ? { categories: options.category ?? [] } : {}),
    ...(hasCliValue(command, 'color') ? { color: options.color } : {}),
    ...(hasCliValue(command, 'format') ? { formats: options.format ?? [] } : {}),
    ...(hasCliValue(command, 'output') ? { outputDirectory: options.output } : {}),
    ...(hasCliValue(command, 'rule') ? { ruleIds: options.rule ?? [] } : {}),
    ...(hasCliValue(command, 'severity') ? { minimumSeverity: options.severity } : {}),
    ...(hasCliValue(command, 'verbose') ? { verbose: options.verbose } : {}),
  };

  return {
    ...(hasCliValue(command, 'config') && options.config !== undefined
      ? { configurationPath: options.config }
      : {}),
    ...(Object.keys(overrides).length === 0 ? {} : { overrides }),
    projectPath,
  };
};

const writeScanResult = (io: CliIo, result: ScanProjectResult): void => {
  io.writeOut(`Project path validated: ${sanitizeTerminalValue(result.projectPath)}\n`);
  io.writeOut(
    [
      'Discovery summary:',
      `discovered=${String(result.summary.discoveredFiles)}`,
      `inventory=${String(result.summary.inventoryEntries)}`,
      `candidates=${String(result.summary.sourceCandidates)}`,
      `exclusions=${String(result.summary.excludedEntries)}`,
      `issues=${String(result.summary.recoverableErrors)}`,
    ].join(' ') + '\n',
  );
};

const writeParsingSummary = (io: CliIo, result: AnalyzeProjectResult): void => {
  io.writeOut(
    [
      'Parsing summary:',
      `parsed=${String(result.parsingSummary.parsedFiles)}`,
      `failed=${String(result.parsingSummary.failedFiles)}`,
      `components=${String(result.parsingSummary.components)}`,
      `jsx=${String(result.parsingSummary.jsxNodes)}`,
    ].join(' ') + '\n',
  );
};

const writeAuditResult = (io: CliIo, safeIo: CliIo, result: AuditProjectResult): void => {
  writeScanResult(safeIo, result.analysis);
  writeParsingSummary(safeIo, result.analysis);

  if (result.auditResult.configuration.formats.includes(REPORT_FORMATS.terminal)) {
    io.writeOut(renderTerminalReport(result.auditResult));
  }

  for (const report of result.writtenReports) {
    safeIo.writeOut(
      `Report generated: ${sanitizeTerminalValue(report.format)}=${sanitizeTerminalValue(
        report.relativePath,
      )}\n`,
    );
  }
};

export const createProgram = ({
  analyzeProject,
  auditProject,
  io,
  scanProject,
}: CliDependencies): Command => {
  const program = new Command();
  const safeIo: CliIo = {
    writeErr: (value) => {
      io.writeErr(sanitizeTerminalOutput(value));
    },
    writeOut: (value) => {
      io.writeOut(sanitizeTerminalOutput(value));
    },
  };

  program
    .name('ux-audit')
    .description(`${PRODUCT_NAME} static-analysis command line interface.`)
    .version(PRODUCT_VERSION)
    .configureOutput({
      writeOut: safeIo.writeOut,
      writeErr: safeIo.writeErr,
      outputError: (value, write) => {
        write(sanitizeTerminalRecord(value));
      },
    })
    .exitOverride()
    .showHelpAfterError();

  const scanCommand = program
    .command('scan')
    .description('Run the complete static audit and generate configured reports.')
    .argument('<project-path>', 'React or TypeScript project directory')
    .option('--config <path>', 'explicit JSON configuration file')
    .option(
      '--format <format>',
      'report format (terminal, json, html, or all); repeatable',
      parseFormat,
    )
    .option('--output <directory>', 'portable project-relative report directory')
    .option(
      '--category <category>',
      'rule category (accessibility, performance, seo, or ux); repeatable',
      parseCategory,
    )
    .option('--rule <rule-id>', 'exact rule ID; repeatable', parseRule)
    .option('--severity <severity>', 'minimum terminal severity', parseSeverity)
    .option('--no-color', 'disable fixed terminal badge colors')
    .option('--verbose', 'show normalized recoverable processing errors')
    .action(async (projectPath: string) => {
      if (auditProject !== undefined) {
        const options = scanCommand.opts<ScanCommandOptions>();
        const result = await auditProject(createAuditRequest(projectPath, scanCommand, options));
        writeAuditResult(io, safeIo, result);
        return;
      }

      if (analyzeProject === undefined) {
        writeScanResult(safeIo, await scanProject({ projectPath }));
        return;
      }

      const result = await analyzeProject({ projectPath });
      writeScanResult(safeIo, result);
      writeParsingSummary(safeIo, result);
    });

  return program;
};

export const runCli = async (
  args: readonly string[],
  dependencies: CliDependencies,
): Promise<number> => {
  try {
    await createProgram(dependencies).parseAsync([...args], { from: 'user' });
    return EXIT_CODES.success;
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode === EXIT_CODES.success ? EXIT_CODES.success : EXIT_CODES.input;
    }

    if (error instanceof ProjectPathError) {
      dependencies.io.writeErr(`${sanitizeTerminalValue(error.message)}\n`);
      return error.code === PROJECT_PATH_ERROR_CODES.validationFailed
        ? EXIT_CODES.internal
        : EXIT_CODES.input;
    }

    if (error instanceof ConfigurationError) {
      dependencies.io.writeErr(`${sanitizeTerminalValue(error.message)}\n`);
      return EXIT_CODES.input;
    }

    if (error instanceof ScanProjectError) {
      dependencies.io.writeErr(`${sanitizeTerminalValue(error.message)}\n`);
      return error.code === SCAN_PROJECT_ERROR_CODES.invalidPath
        ? EXIT_CODES.input
        : EXIT_CODES.internal;
    }

    if (error instanceof AnalyzeProjectError) {
      dependencies.io.writeErr(`${sanitizeTerminalValue(error.message)}\n`);
      return EXIT_CODES.internal;
    }

    if (error instanceof AuditProjectError) {
      dependencies.io.writeErr(`${sanitizeTerminalValue(error.message)}\n`);
      return EXIT_CODES.internal;
    }

    if (error instanceof ReportWriteError) {
      dependencies.io.writeErr(`${sanitizeTerminalValue(error.message)}\n`);
      return EXIT_CODES.internal;
    }

    dependencies.io.writeErr(`Internal error: ${sanitizeTerminalValue(getErrorMessage(error))}\n`);
    return EXIT_CODES.internal;
  }
};

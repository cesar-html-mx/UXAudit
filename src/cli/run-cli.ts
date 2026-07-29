import { Command, CommanderError } from 'commander';

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
import { PRODUCT_NAME, PRODUCT_VERSION } from '../index.js';
import {
  sanitizeTerminalOutput,
  sanitizeTerminalRecord,
  sanitizeTerminalValue,
} from './sanitize-terminal.js';

export const EXIT_CODES = {
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
  readonly io: CliIo;
  readonly scanProject: ScanProject;
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown internal failure';

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

export const createProgram = ({ analyzeProject, io, scanProject }: CliDependencies): Command => {
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

  program
    .command('scan')
    .description('Discover, analyze, and model project source files for static analysis.')
    .argument('<project-path>', 'React or TypeScript project directory')
    .action(async (projectPath: string) => {
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

    dependencies.io.writeErr(`Internal error: ${sanitizeTerminalValue(getErrorMessage(error))}\n`);
    return EXIT_CODES.internal;
  }
};

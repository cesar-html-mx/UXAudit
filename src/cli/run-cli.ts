import { Command, CommanderError } from 'commander';

import {
  SCAN_PROJECT_ERROR_CODES,
  ScanProjectError,
  type ScanProject,
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
  readonly io: CliIo;
  readonly scanProject: ScanProject;
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown internal failure';

export const createProgram = ({ io, scanProject }: CliDependencies): Command => {
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
    .description('Validate a project directory for static analysis.')
    .argument('<project-path>', 'React or TypeScript project directory')
    .action(async (projectPath: string) => {
      const result = await scanProject({ projectPath });
      safeIo.writeOut(`Project path validated: ${sanitizeTerminalValue(result.projectPath)}\n`);
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
      return error.code === SCAN_PROJECT_ERROR_CODES.validationFailed
        ? EXIT_CODES.internal
        : EXIT_CODES.input;
    }

    dependencies.io.writeErr(`Internal error: ${sanitizeTerminalValue(getErrorMessage(error))}\n`);
    return EXIT_CODES.internal;
  }
};

#!/usr/bin/env node

import process from 'node:process';

import { scanProject } from '../application/scan-project.js';
import { runCli } from './run-cli.js';

process.exitCode = await runCli(process.argv.slice(2), {
  io: {
    writeErr: (value) => process.stderr.write(value),
    writeOut: (value) => process.stdout.write(value),
  },
  scanProject,
});

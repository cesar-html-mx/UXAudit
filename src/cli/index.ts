#!/usr/bin/env node

import process from 'node:process';

import { analyzeProject } from '../application/analyze-project.js';
import { auditProject } from '../application/audit-project.js';
import { scanProject } from '../application/scan-project.js';
import { runCli } from './run-cli.js';

process.exitCode = await runCli(process.argv.slice(2), {
  analyzeProject,
  auditProject,
  io: {
    writeErr: (value) => process.stderr.write(value),
    writeOut: (value) => process.stdout.write(value),
  },
  scanProject,
});

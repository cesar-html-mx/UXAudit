import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const packagePath = path.join(process.cwd(), 'package.json');

let pkg;
try {
  pkg = JSON.parse(await readFile(packagePath, 'utf8'));
} catch {
  console.error('package.json is required to run the UXAudit product quality gate.');
  process.exit(1);
}

const preferred = ['format:check', 'docs:check', 'lint', 'typecheck', 'test', 'build'];
const missing = preferred.filter((name) => !pkg.scripts?.[name]);
const npmExecPath = process.env.npm_execpath;

if (missing.length > 0) {
  console.error(`Missing required package scripts: ${missing.join(', ')}`);
  process.exit(1);
}

if (!npmExecPath) {
  console.error('npm executable path is unavailable; run this gate through `npm run verify`.');
  process.exit(1);
}

for (const name of preferred) {
  console.log(`\n> npm run ${name}`);
  const result = spawnSync(process.execPath, [npmExecPath, 'run', name], {
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('\nUXAudit product quality checks: PASS');

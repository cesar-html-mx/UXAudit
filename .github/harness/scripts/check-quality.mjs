import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const packagePath = path.join(process.cwd(), 'package.json');

let pkg;
try {
  pkg = JSON.parse(await readFile(packagePath, 'utf8'));
} catch {
  console.log('package.json does not exist yet; product quality checks begin in M01.');
  process.exit(0);
}

const preferred = ['format:check', 'lint', 'typecheck', 'test', 'build'];
const missing = preferred.filter((name) => !pkg.scripts?.[name]);

if (missing.length > 0) {
  console.error(`Missing required package scripts: ${missing.join(', ')}`);
  process.exit(1);
}

for (const name of preferred) {
  console.log(`\n> npm run ${name}`);
  const result = spawnSync('npm', ['run', name], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('\nUXAudit product quality checks: PASS');

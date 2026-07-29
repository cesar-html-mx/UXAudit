import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const required = [
  'AGENTS.md',
  '.github/harness/HARNESS_CONFIG.yml',
  '.github/harness/milestones.json',
  '.github/harness/state/state.json',
  '.github/harness/CURRENT_STATE.md',
  '.github/harness/PLANS.md',
  'docs/00_INDEX.md',
  'docs/03_REQUIREMENTS.md',
  'docs/04_ARCHITECTURE.md',
  'docs/06_TEST_STRATEGY.md',
  'docs/08_RULE_CATALOG.md',
  'docs/12_TRACEABILITY_MATRIX.md',
];

const errors = [];

for (const relative of required) {
  try {
    await access(path.join(root, relative));
  } catch {
    errors.push(`Missing required file: ${relative}`);
  }
}

let milestones;
let state;

try {
  milestones = JSON.parse(
    await readFile(path.join(root, '.github/harness/milestones.json'), 'utf8'),
  );
} catch (error) {
  errors.push(`Invalid milestones.json: ${error.message}`);
}

try {
  state = JSON.parse(await readFile(path.join(root, '.github/harness/state/state.json'), 'utf8'));
} catch (error) {
  errors.push(`Invalid state.json: ${error.message}`);
}

if (milestones && state) {
  const all = milestones.milestones ?? [];
  const active = all.filter((item) => item.status === 'active');
  const selected = all.find((item) => item.id === state.activeMilestone);

  if (active.length !== 1) {
    errors.push(`Expected exactly one active milestone, found ${active.length}`);
  }

  if (!selected) {
    errors.push(`State active milestone not found: ${state.activeMilestone}`);
  } else if (selected.status !== 'active') {
    errors.push(`State milestone ${selected.id} is not marked active`);
  } else {
    try {
      await access(path.join(root, selected.plan));
    } catch {
      errors.push(`Active ExecPlan is missing: ${selected.plan}`);
    }

    if (!selected.tasks.some((task) => task.id === state.activeTask)) {
      errors.push(`Active task ${state.activeTask} is not part of ${selected.id}`);
    }
  }

  const ids = all.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    errors.push('Duplicate milestone IDs');
  }

  const taskIds = all.flatMap((item) => item.tasks.map((task) => task.id));
  if (new Set(taskIds).size !== taskIds.length) {
    errors.push('Duplicate task IDs');
  }
}

if (errors.length > 0) {
  console.error('UXAudit harness validation: FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('UXAudit harness validation: PASS');
console.log(`Active milestone: ${state.activeMilestone}`);
console.log(`Active task: ${state.activeTask}`);

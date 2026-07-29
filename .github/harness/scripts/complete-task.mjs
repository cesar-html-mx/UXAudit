import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const taskId = value('--task');
const verification = value('--verification');

if (!taskId || !verification) {
  console.error(
    'Usage: node .github/harness/scripts/complete-task.mjs --task M01-T01 --verification "npm run build"',
  );
  process.exit(2);
}

const root = process.cwd();
const statePath = path.join(root, '.github/harness/state/state.json');
const milestonesPath = path.join(root, '.github/harness/milestones.json');
const state = JSON.parse(await readFile(statePath, 'utf8'));
const data = JSON.parse(await readFile(milestonesPath, 'utf8'));
const milestone = data.milestones.find((item) => item.id === state.activeMilestone);

if (!milestone) {
  console.error('No active milestone');
  process.exit(1);
}

if (state.activeTask !== taskId) {
  console.error(`Refusing to complete ${taskId}; active task is ${state.activeTask}`);
  process.exit(1);
}

const task = milestone.tasks.find((item) => item.id === taskId);
if (!task) {
  console.error(`Task not found: ${taskId}`);
  process.exit(1);
}

task.status = 'completed';
task.verification = verification;
task.completedAt = new Date().toISOString();

const next = milestone.tasks.find((item) => item.status !== 'completed');
state.activeTask = next?.id ?? null;
state.lastVerifiedAt = task.completedAt;
state.lastVerificationCommand = verification;
state.lastVerificationResult = 'PASS';

await writeFile(milestonesPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
await writeFile(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');

console.log(`Completed ${taskId}`);
console.log(next ? `Next task: ${next.id}` : `All tasks in ${milestone.id} are complete`);

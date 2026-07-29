import { access, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const expectedId = value('--milestone');
const verification = value('--verification');
const commit = value('--commit');

if (!expectedId || !verification) {
  console.error(
    'Usage: node .github/harness/scripts/advance-milestone.mjs --milestone M01 --verification "npm run verify" [--commit <sha>]',
  );
  process.exit(2);
}

const root = process.cwd();
const statePath = path.join(root, '.github/harness/state/state.json');
const milestonesPath = path.join(root, '.github/harness/milestones.json');

const state = JSON.parse(await readFile(statePath, 'utf8'));
const data = JSON.parse(await readFile(milestonesPath, 'utf8'));

if (state.activeMilestone !== expectedId) {
  console.error(`Refusing to close ${expectedId}; active milestone is ${state.activeMilestone}`);
  process.exit(1);
}

const index = data.milestones.findIndex((item) => item.id === expectedId);
const current = data.milestones[index];

if (!current) {
  console.error(`Unknown milestone: ${expectedId}`);
  process.exit(1);
}

const incomplete = current.tasks.filter((task) => task.status !== 'completed');
if (incomplete.length > 0) {
  console.error(`Refusing to close milestone with incomplete tasks: ${incomplete.map((t) => t.id).join(', ')}`);
  process.exit(1);
}

current.status = 'completed';
const activeSource = path.join(root, current.plan);
const completedRelative = `.github/harness/exec-plans/completed/${path.basename(current.plan)}`;
const completedTarget = path.join(root, completedRelative);
await access(activeSource);
await rename(activeSource, completedTarget);
current.plan = completedRelative;

state.completedMilestones = [...new Set([...state.completedMilestones, expectedId])];
state.lastVerifiedAt = new Date().toISOString();
state.lastVerificationCommand = verification;
state.lastVerificationResult = 'PASS';
state.lastCommit = commit ?? state.lastCommit;

const next = data.milestones[index + 1];
if (next) {
  next.status = 'active';
  const queuedSource = path.join(root, next.plan);
  const activeRelative = `.github/harness/exec-plans/active/${path.basename(next.plan)}`;
  const activeTarget = path.join(root, activeRelative);
  await access(queuedSource);
  await rename(queuedSource, activeTarget);
  next.plan = activeRelative;
  state.activeMilestone = next.id;
  state.activeTask = next.tasks.find((task) => task.status !== 'completed')?.id ?? null;
  state.status = 'ready';
} else {
  state.activeMilestone = null;
  state.activeTask = null;
  state.status = 'complete';
}

await writeFile(milestonesPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
await writeFile(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');

console.log(`Closed ${expectedId}`);
console.log(next ? `Activated ${next.id}` : 'All milestones complete');
console.log('Run sync-state-doc.mjs and validate-harness.mjs next.');

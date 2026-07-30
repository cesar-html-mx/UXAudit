import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const state = JSON.parse(
  await readFile(path.join(root, '.github/harness/state/state.json'), 'utf8'),
);
const data = JSON.parse(await readFile(path.join(root, '.github/harness/milestones.json'), 'utf8'));
const milestone = data.milestones.find((item) => item.id === state.activeMilestone);
const completedMilestones =
  state.completedMilestones.length > 0 ? state.completedMilestones.join(', ') : 'none';
const completedMilestoneSet = new Set(state.completedMilestones);
const terminalState =
  state.status === 'complete' &&
  state.activeMilestone === null &&
  state.activeTask === null &&
  data.milestones.length > 0 &&
  data.milestones.every(
    (item) => item.status === 'completed' && completedMilestoneSet.has(item.id),
  ) &&
  completedMilestoneSet.size === state.completedMilestones.length &&
  completedMilestoneSet.size === data.milestones.length;

if (state.status === 'complete' && !terminalState) {
  throw new Error('Refusing to show an incoherent complete harness state.');
}

console.log(`Project: ${state.project}`);
console.log(`Status: ${state.status}`);
console.log(`Active milestone: ${milestone?.id ?? 'none'} — ${milestone?.title ?? 'none'}`);
console.log(`Current branch: ${state.currentBranch ?? milestone?.branch ?? 'none'}`);
console.log(`Active task: ${state.activeTask ?? 'none'}`);
console.log(`Completed milestones: ${completedMilestones}`);

if (milestone) {
  for (const task of milestone.tasks) {
    const mark = task.status === 'completed' ? 'x' : task.id === state.activeTask ? '>' : ' ';
    console.log(`[${mark}] ${task.id} ${task.title}`);
  }
}

if (terminalState) {
  console.log('Lifecycle: all configured milestones are complete.');
}

if (state.blockers?.length) {
  console.log('Blockers:');
  for (const blocker of state.blockers) console.log(`- ${blocker}`);
}

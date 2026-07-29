import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const state = JSON.parse(
  await readFile(path.join(root, '.github/harness/state/state.json'), 'utf8'),
);
const data = JSON.parse(
  await readFile(path.join(root, '.github/harness/milestones.json'), 'utf8'),
);
const milestone = data.milestones.find((item) => item.id === state.activeMilestone);

console.log(`Project: ${state.project}`);
console.log(`Status: ${state.status}`);
console.log(`Active milestone: ${milestone?.id ?? 'none'} — ${milestone?.title ?? 'none'}`);
console.log(`Branch: ${milestone?.branch ?? 'none'}`);
console.log(`Active task: ${state.activeTask ?? 'none'}`);

if (milestone) {
  for (const task of milestone.tasks) {
    const mark = task.status === 'completed' ? 'x' : task.id === state.activeTask ? '>' : ' ';
    console.log(`[${mark}] ${task.id} ${task.title}`);
  }
}

if (state.blockers?.length) {
  console.log('Blockers:');
  for (const blocker of state.blockers) console.log(`- ${blocker}`);
}

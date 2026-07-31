import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const statePath = path.join(root, '.github/harness/state/state.json');
const milestonesPath = path.join(root, '.github/harness/milestones.json');
const outputPath = path.join(root, '.github/harness/CURRENT_STATE.md');

const state = JSON.parse(await readFile(statePath, 'utf8'));
const data = JSON.parse(await readFile(milestonesPath, 'utf8'));
const milestone = data.milestones.find((item) => item.id === state.activeMilestone);
const task = milestone?.tasks.find((item) => item.id === state.activeTask);

const completed = state.completedMilestones.length ? state.completedMilestones.join(', ') : 'None';
const blockers = state.blockers.length
  ? state.blockers.map((item) => `- ${item}`).join('\n')
  : 'None';
const completedMilestoneSet = new Set(state.completedMilestones);
const allMilestonesComplete =
  data.milestones.length > 0 &&
  data.milestones.every(
    (item) => item.status === 'completed' && completedMilestoneSet.has(item.id),
  ) &&
  completedMilestoneSet.size === state.completedMilestones.length &&
  completedMilestoneSet.size === data.milestones.length;
const terminalState =
  state.status === 'complete' &&
  state.activeMilestone === null &&
  state.activeTask === null &&
  allMilestonesComplete;

if (state.status === 'complete' && !terminalState) {
  throw new Error('Refusing to render an incoherent complete harness state.');
}

const continuation = terminalState
  ? `## Completion

All configured milestones are complete. No active milestone or task remains.`
  : `## Next execution

Open Codex at the repository root and use:

> Ejecuta el harness definido en AGENTS.md y completa el hito activo de principio a fin.`;

const content = `# Current State

## Status

- Project: ${state.project}
- Harness status: ${state.status}
- Active milestone: **${milestone ? `${milestone.id} — ${milestone.title}` : 'None'}**
- Active task: **${task ? `${task.id} — ${task.title}` : 'None'}**
- Completed milestones: ${completed}
- Current branch: ${state.currentBranch ?? 'Not recorded'}
- Last verification: ${state.lastVerificationResult ?? 'Not recorded'}
- Last verified at: ${state.lastVerifiedAt ?? 'Not recorded'}
- Last commit: ${state.lastCommit ?? 'Not recorded'}

## Blockers

${blockers}

${continuation}

This file was generated from \`.github/harness/state/state.json\`.
`;

await writeFile(outputPath, content, 'utf8');
console.log(`Updated ${path.relative(root, outputPath)}`);

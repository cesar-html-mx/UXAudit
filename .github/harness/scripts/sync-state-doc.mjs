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

const completed = state.completedMilestones.length
  ? state.completedMilestones.join(', ')
  : 'None';
const blockers = state.blockers.length
  ? state.blockers.map((item) => `- ${item}`).join('\n')
  : 'None';

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

## Next execution

Open Codex at the repository root and use:

> Ejecuta el harness definido en AGENTS.md y completa el hito activo de principio a fin.

This file was generated from \`.github/harness/state/state.json\`.
`;

await writeFile(outputPath, content, 'utf8');
console.log(`Updated ${path.relative(root, outputPath)}`);

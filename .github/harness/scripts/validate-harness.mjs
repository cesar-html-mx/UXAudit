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
  const all = Array.isArray(milestones.milestones) ? milestones.milestones : [];
  const active = all.filter((item) => item.status === 'active');
  const selected =
    typeof state.activeMilestone === 'string'
      ? all.find((item) => item.id === state.activeMilestone)
      : undefined;

  if (!Array.isArray(milestones.milestones) || all.length === 0) {
    errors.push('Milestone catalog must contain at least one milestone');
  }

  const ids = all.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    errors.push('Duplicate milestone IDs');
  }

  const taskIds = all.flatMap((item) =>
    Array.isArray(item.tasks) ? item.tasks.map((task) => task.id) : [],
  );
  if (new Set(taskIds).size !== taskIds.length) {
    errors.push('Duplicate task IDs');
  }

  const allowedMilestoneStatuses = new Set(['active', 'completed', 'pending']);
  const allowedTaskStatuses = new Set(['completed', 'pending']);
  for (const milestone of all) {
    if (!allowedMilestoneStatuses.has(milestone.status)) {
      errors.push(`Milestone ${milestone.id} has invalid status: ${milestone.status}`);
    }

    if (!Array.isArray(milestone.tasks) || milestone.tasks.length === 0) {
      errors.push(`Milestone ${milestone.id} must contain at least one task`);
      continue;
    }

    for (const task of milestone.tasks) {
      if (!allowedTaskStatuses.has(task.status)) {
        errors.push(`Task ${task.id} has invalid status: ${task.status}`);
      }
    }

    if (
      milestone.status === 'completed' &&
      milestone.tasks.some((task) => task.status !== 'completed')
    ) {
      errors.push(`Completed milestone ${milestone.id} has incomplete tasks`);
    }
  }

  const completedIds = Array.isArray(state.completedMilestones) ? state.completedMilestones : [];
  const completedIdSet = new Set(completedIds);
  const milestoneIdSet = new Set(ids);

  if (!Array.isArray(state.completedMilestones)) {
    errors.push('State completedMilestones must be an array');
  }

  if (completedIdSet.size !== completedIds.length) {
    errors.push('Duplicate completed milestone IDs in state');
  }

  for (const completedId of completedIds) {
    if (!milestoneIdSet.has(completedId)) {
      errors.push(`State completed milestone not found: ${completedId}`);
    }
  }

  for (const milestone of all) {
    if (milestone.status === 'completed' && !completedIdSet.has(milestone.id)) {
      errors.push(`Completed milestone ${milestone.id} is missing from state`);
    }

    if (milestone.status !== 'completed' && completedIdSet.has(milestone.id)) {
      errors.push(`State marks non-completed milestone ${milestone.id} as completed`);
    }
  }

  if (state.status === 'ready') {
    if (active.length !== 1) {
      errors.push(
        `Ready harness state requires exactly one active milestone, found ${active.length}`,
      );
    }

    if (typeof state.activeMilestone !== 'string') {
      errors.push('Ready harness state requires a non-null active milestone');
    } else if (!selected) {
      errors.push(`State active milestone not found: ${state.activeMilestone}`);
    } else if (selected.status !== 'active') {
      errors.push(`State milestone ${selected.id} is not marked active`);
    } else {
      try {
        await access(path.join(root, selected.plan));
      } catch {
        errors.push(`Active ExecPlan is missing: ${selected.plan}`);
      }

      const selectedTasks = Array.isArray(selected.tasks) ? selected.tasks : [];
      const incompleteTasks = selectedTasks.filter((task) => task.status !== 'completed');

      if (incompleteTasks.length === 0) {
        if (state.activeTask !== null) {
          errors.push(
            `Ready harness state requires activeTask to be null after all tasks in ${selected.id} are complete`,
          );
        }
      } else if (typeof state.activeTask !== 'string') {
        errors.push(
          `Ready harness state requires an active task while ${selected.id} has incomplete tasks`,
        );
      } else {
        const activeTask = selectedTasks.find((task) => task.id === state.activeTask);

        if (!activeTask) {
          errors.push(`Active task ${state.activeTask} is not part of ${selected.id}`);
        } else if (activeTask.status === 'completed') {
          errors.push(`Active task ${state.activeTask} is already completed`);
        }
      }
    }
  } else if (state.status === 'complete') {
    if (active.length !== 0) {
      errors.push(`Complete harness state requires zero active milestones, found ${active.length}`);
    }

    if (state.activeMilestone !== null) {
      errors.push('Complete harness state requires activeMilestone to be null');
    }

    if (state.activeTask !== null) {
      errors.push('Complete harness state requires activeTask to be null');
    }

    const nonCompleted = all.filter((item) => item.status !== 'completed');
    if (nonCompleted.length > 0) {
      errors.push(
        `Complete harness state has non-completed milestones: ${nonCompleted
          .map((item) => item.id)
          .join(', ')}`,
      );
    }

    const missingCompletedIds = ids.filter((id) => !completedIdSet.has(id));
    if (missingCompletedIds.length > 0) {
      errors.push(
        `Complete harness state is missing completed milestones: ${missingCompletedIds.join(', ')}`,
      );
    }
  } else {
    errors.push(`Unsupported harness status: ${state.status}`);
  }
}

if (errors.length > 0) {
  console.error('UXAudit harness validation: FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('UXAudit harness validation: PASS');
console.log(`Harness status: ${state.status}`);
console.log(`Active milestone: ${state.activeMilestone ?? 'none'}`);
console.log(`Active task: ${state.activeTask ?? 'none'}`);

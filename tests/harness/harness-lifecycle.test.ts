import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { describe, expect, it } from 'vitest';

type HarnessStatus = 'complete' | 'ready';
type MilestoneStatus = 'active' | 'completed' | 'pending';
type TaskStatus = 'completed' | 'pending';

interface HarnessTask {
  readonly id: string;
  readonly status: TaskStatus;
  readonly title: string;
}

interface HarnessMilestone {
  readonly branch: string;
  readonly id: string;
  readonly plan: string;
  readonly slug: string;
  status: MilestoneStatus;
  readonly tasks: HarnessTask[];
  readonly title: string;
}

interface HarnessState {
  activeMilestone: null | string;
  activeTask: null | string;
  readonly blockers: readonly string[];
  completedMilestones: string[];
  readonly currentBranch: string;
  readonly lastCommit: string;
  readonly lastVerificationResult: string;
  readonly lastVerifiedAt: string;
  readonly project: string;
  readonly schemaVersion: number;
  status: HarnessStatus;
}

interface LifecycleFixture {
  readonly milestones: HarnessMilestone[];
  readonly state: HarnessState;
}

interface ScriptExecution {
  readonly exitCode: null | number;
  readonly stderr: string;
  readonly stdout: string;
}

const repositoryRoot = process.cwd();
const harnessScriptDirectory = path.join(repositoryRoot, '.github', 'harness', 'scripts');
const requiredPlaceholders = [
  'AGENTS.md',
  '.github/harness/HARNESS_CONFIG.yml',
  '.github/harness/CURRENT_STATE.md',
  '.github/harness/PLANS.md',
  'docs/00_INDEX.md',
  'docs/03_REQUIREMENTS.md',
  'docs/04_ARCHITECTURE.md',
  'docs/06_TEST_STRATEGY.md',
  'docs/08_RULE_CATALOG.md',
  'docs/12_TRACEABILITY_MATRIX.md',
];

const createMilestones = (
  secondStatus: MilestoneStatus,
  secondTaskStatus: TaskStatus,
  terminal: boolean,
): HarnessMilestone[] => [
  {
    branch: 'milestone/m01-first',
    id: 'M01',
    plan: '.github/harness/exec-plans/completed/M01-first.md',
    slug: 'first',
    status: 'completed',
    tasks: [{ id: 'M01-T01', status: 'completed', title: 'First task' }],
    title: 'First milestone',
  },
  {
    branch: 'milestone/m02-second',
    id: 'M02',
    plan: terminal
      ? '.github/harness/exec-plans/completed/M02-second.md'
      : '.github/harness/exec-plans/active/M02-second.md',
    slug: 'second',
    status: secondStatus,
    tasks: [
      { id: 'M02-T01', status: 'completed', title: 'Completed task' },
      { id: 'M02-T02', status: secondTaskStatus, title: 'Lifecycle task' },
    ],
    title: 'Second milestone',
  },
];

const createFixture = (lifecycle: 'ready' | 'terminal' | 'transitional'): LifecycleFixture => {
  const terminal = lifecycle === 'terminal';

  return {
    milestones: createMilestones(
      terminal ? 'completed' : 'active',
      lifecycle === 'ready' ? 'pending' : 'completed',
      terminal,
    ),
    state: {
      activeMilestone: terminal ? null : 'M02',
      activeTask: lifecycle === 'ready' ? 'M02-T02' : null,
      blockers: [],
      completedMilestones: terminal ? ['M01', 'M02'] : ['M01'],
      currentBranch: 'milestone/m02-second',
      lastCommit: '0123456789abcdef',
      lastVerificationResult: 'PASS',
      lastVerifiedAt: '2026-07-30T08:00:00.000Z',
      project: 'UXAudit lifecycle fixture',
      schemaVersion: 1,
      status: terminal ? 'complete' : 'ready',
    },
  };
};

const writeFixture = async (root: string, fixture: LifecycleFixture): Promise<void> => {
  for (const relativePath of requiredPlaceholders) {
    const targetPath = path.join(root, relativePath);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, 'fixture\n', 'utf8');
  }

  const milestonesPath = path.join(root, '.github', 'harness', 'milestones.json');
  const statePath = path.join(root, '.github', 'harness', 'state', 'state.json');

  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(
    milestonesPath,
    `${JSON.stringify({ schemaVersion: 1, milestones: fixture.milestones }, null, 2)}\n`,
    'utf8',
  );
  await writeFile(statePath, `${JSON.stringify(fixture.state, null, 2)}\n`, 'utf8');

  for (const milestone of fixture.milestones) {
    const planPath = path.join(root, milestone.plan);

    await mkdir(path.dirname(planPath), { recursive: true });
    await writeFile(planPath, `# ${milestone.id}\n`, 'utf8');
  }
};

const executeHarnessScript = (
  root: string,
  scriptName: string,
  argumentsList: readonly string[] = [],
): Promise<ScriptExecution> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(harnessScriptDirectory, scriptName), ...argumentsList],
      {
        cwd: root,
        env: process.env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const stdout: string[] = [];
    const stderr: string[] = [];

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk: string) => {
      stderr.push(chunk);
    });
    child.once('error', reject);
    child.once('close', (exitCode) => {
      resolve({
        exitCode,
        stderr: stderr.join(''),
        stdout: stdout.join(''),
      });
    });
  });

const withFixture = async <Value>(
  fixture: LifecycleFixture,
  callback: (root: string) => Promise<Value>,
): Promise<Value> => {
  const root = await mkdtemp(path.join(tmpdir(), 'uxaudit-harness-lifecycle-'));

  try {
    await writeFixture(root, fixture);
    return await callback(root);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
};

describe('harness lifecycle scripts', () => {
  it.each(['ready', 'transitional', 'terminal'] as const)(
    'validates a coherent %s lifecycle state',
    async (lifecycle) => {
      await withFixture(createFixture(lifecycle), async (root) => {
        const execution = await executeHarnessScript(root, 'validate-harness.mjs');

        expect(execution.exitCode).toBe(0);
        expect(execution.stderr).toBe('');
        expect(execution.stdout).toContain('UXAudit harness validation: PASS');
        expect(execution.stdout).toContain(
          `Harness status: ${lifecycle === 'terminal' ? 'complete' : 'ready'}`,
        );
        expect(execution.stdout).toContain(
          `Active milestone: ${lifecycle === 'terminal' ? 'none' : 'M02'}`,
        );
        expect(execution.stdout).toContain(
          `Active task: ${lifecycle === 'ready' ? 'M02-T02' : 'none'}`,
        );
      });
    },
  );

  it('shows active, transitional, and terminal states without inventing a milestone', async () => {
    for (const lifecycle of ['ready', 'transitional', 'terminal'] as const) {
      await withFixture(createFixture(lifecycle), async (root) => {
        const execution = await executeHarnessScript(root, 'show-status.mjs');

        expect(execution.exitCode).toBe(0);
        expect(execution.stderr).toBe('');
        expect(execution.stdout).toContain('Current branch: milestone/m02-second');
        expect(execution.stdout).toContain('Completed milestones: M01');

        if (lifecycle === 'terminal') {
          expect(execution.stdout).toContain('Active milestone: none — none');
          expect(execution.stdout).toContain('Active task: none');
          expect(execution.stdout).toContain('Completed milestones: M01, M02');
          expect(execution.stdout).toContain('Lifecycle: all configured milestones are complete.');
        } else {
          expect(execution.stdout).toContain('Active milestone: M02 — Second milestone');
          expect(execution.stdout).toContain(
            `Active task: ${lifecycle === 'ready' ? 'M02-T02' : 'none'}`,
          );
        }
      });
    }
  });

  it('synchronizes ready and terminal documentation only inside a temporary repository', async () => {
    await withFixture(createFixture('ready'), async (root) => {
      const execution = await executeHarnessScript(root, 'sync-state-doc.mjs');
      const currentState = await readFile(
        path.join(root, '.github', 'harness', 'CURRENT_STATE.md'),
        'utf8',
      );

      expect(execution.exitCode).toBe(0);
      expect(currentState).toContain('## Next execution');
      expect(currentState).not.toContain('## Completion');
    });

    await withFixture(createFixture('terminal'), async (root) => {
      const execution = await executeHarnessScript(root, 'sync-state-doc.mjs');
      const currentState = await readFile(
        path.join(root, '.github', 'harness', 'CURRENT_STATE.md'),
        'utf8',
      );

      expect(execution.exitCode).toBe(0);
      expect(currentState).toContain('- Harness status: complete');
      expect(currentState).toContain('- Active milestone: **None**');
      expect(currentState).toContain('- Active task: **None**');
      expect(currentState).toContain('## Completion');
      expect(currentState).toContain(
        'All configured milestones are complete. No active milestone or task remains.',
      );
      expect(currentState).not.toContain('## Next execution');
    });
  });

  it('advances a transitional final milestone and renders the resulting terminal state', async () => {
    await withFixture(createFixture('transitional'), async (root) => {
      const activePlan = path.join(
        root,
        '.github',
        'harness',
        'exec-plans',
        'active',
        'M02-second.md',
      );
      const completedPlan = path.join(
        root,
        '.github',
        'harness',
        'exec-plans',
        'completed',
        'M02-second.md',
      );
      const advance = await executeHarnessScript(root, 'advance-milestone.mjs', [
        '--milestone',
        'M02',
        '--verification',
        'fixture terminal verification PASS',
        '--commit',
        'fedcba9876543210',
      ]);

      expect(advance.exitCode).toBe(0);
      expect(advance.stderr).toBe('');
      expect(advance.stdout).toContain('Closed M02');
      expect(advance.stdout).toContain('All milestones complete');
      await expect(access(activePlan)).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(readFile(completedPlan, 'utf8')).resolves.toBe('# M02\n');

      const state = JSON.parse(
        await readFile(path.join(root, '.github', 'harness', 'state', 'state.json'), 'utf8'),
      ) as HarnessState;
      const milestoneDocument = JSON.parse(
        await readFile(path.join(root, '.github', 'harness', 'milestones.json'), 'utf8'),
      ) as { readonly milestones: readonly HarnessMilestone[] };
      const finalMilestone = milestoneDocument.milestones.find(({ id }) => id === 'M02');

      expect(state).toMatchObject({
        activeMilestone: null,
        activeTask: null,
        completedMilestones: ['M01', 'M02'],
        lastCommit: 'fedcba9876543210',
        lastVerificationCommand: 'fixture terminal verification PASS',
        lastVerificationResult: 'PASS',
        status: 'complete',
      });
      expect(finalMilestone).toMatchObject({
        plan: '.github/harness/exec-plans/completed/M02-second.md',
        status: 'completed',
      });

      const sync = await executeHarnessScript(root, 'sync-state-doc.mjs');
      const validation = await executeHarnessScript(root, 'validate-harness.mjs');
      const shown = await executeHarnessScript(root, 'show-status.mjs');
      const currentState = await readFile(
        path.join(root, '.github', 'harness', 'CURRENT_STATE.md'),
        'utf8',
      );

      expect(sync.exitCode).toBe(0);
      expect(validation.exitCode).toBe(0);
      expect(validation.stdout).toContain('Harness status: complete');
      expect(validation.stdout).toContain('Active milestone: none');
      expect(validation.stdout).toContain('Active task: none');
      expect(shown.exitCode).toBe(0);
      expect(shown.stdout).toContain('Status: complete');
      expect(shown.stdout).toContain('Active milestone: none — none');
      expect(shown.stdout).toContain('Lifecycle: all configured milestones are complete.');
      expect(currentState).toContain('## Completion');
      expect(currentState).not.toContain('## Next execution');
    });
  });

  it('refuses to synchronize or show an incoherent terminal state', async () => {
    const fixture = createFixture('terminal');

    fixture.state.completedMilestones = ['M01'];
    await withFixture(fixture, async (root) => {
      const currentStatePath = path.join(root, '.github', 'harness', 'CURRENT_STATE.md');
      const before = await readFile(currentStatePath, 'utf8');
      const sync = await executeHarnessScript(root, 'sync-state-doc.mjs');
      const shown = await executeHarnessScript(root, 'show-status.mjs');

      expect(sync.exitCode).toBe(1);
      expect(sync.stderr).toContain('Refusing to render an incoherent complete harness state.');
      expect(await readFile(currentStatePath, 'utf8')).toBe(before);
      expect(shown.exitCode).toBe(1);
      expect(shown.stderr).toContain('Refusing to show an incoherent complete harness state.');
    });
  });

  it.each([
    {
      expected: 'Ready harness state requires an active task',
      label: 'ready state with incomplete tasks and no active task',
      mutate: (fixture: LifecycleFixture) => {
        fixture.state.activeTask = null;
      },
      source: 'ready' as const,
    },
    {
      expected: 'Active task M01-T01 is not part of M02',
      label: 'ready state selecting a task from another milestone',
      mutate: (fixture: LifecycleFixture) => {
        fixture.state.activeTask = 'M01-T01';
      },
      source: 'ready' as const,
    },
    {
      expected: 'requires activeTask to be null after all tasks',
      label: 'transitional state retaining a completed active task',
      mutate: (fixture: LifecycleFixture) => {
        fixture.state.activeTask = 'M02-T02';
      },
      source: 'transitional' as const,
    },
    {
      expected: 'requires zero active milestones',
      label: 'complete state retaining an active milestone record',
      mutate: (fixture: LifecycleFixture) => {
        const secondMilestone = fixture.milestones[1];

        if (secondMilestone === undefined) {
          throw new Error('Lifecycle fixture is missing M02.');
        }

        secondMilestone.status = 'active';
      },
      source: 'terminal' as const,
    },
    {
      expected: 'requires activeMilestone to be null',
      label: 'complete state retaining an active milestone identifier',
      mutate: (fixture: LifecycleFixture) => {
        fixture.state.activeMilestone = 'M02';
      },
      source: 'terminal' as const,
    },
    {
      expected: 'requires activeTask to be null',
      label: 'complete state retaining an active task identifier',
      mutate: (fixture: LifecycleFixture) => {
        fixture.state.activeTask = 'M02-T02';
      },
      source: 'terminal' as const,
    },
    {
      expected: 'Completed milestone M02 is missing from state',
      label: 'complete state with an incomplete completed-milestone set',
      mutate: (fixture: LifecycleFixture) => {
        fixture.state.completedMilestones = ['M01'];
      },
      source: 'terminal' as const,
    },
  ])('rejects $label', async ({ expected, mutate, source }) => {
    const fixture = createFixture(source);

    mutate(fixture);
    await withFixture(fixture, async (root) => {
      const execution = await executeHarnessScript(root, 'validate-harness.mjs');

      expect(execution.exitCode).toBe(1);
      expect(execution.stdout).toBe('');
      expect(execution.stderr).toContain('UXAudit harness validation: FAIL');
      expect(execution.stderr).toContain(expected);
    });
  });
});

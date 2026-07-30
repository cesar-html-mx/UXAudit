import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { format } from 'prettier';
import { describe, expect, it } from 'vitest';

const contractPath = fileURLToPath(
  new URL('../../../fixtures/system-validation/heuristic-review.json', import.meta.url),
);
const expectedTaskIds = [
  'discover-scan',
  'analyze-project',
  'identify-highest-priority',
  'locate-source',
  'understand-recommendation',
  'find-json-html-reports',
] as const;
const topLevelKeys = [
  'controlledProject',
  'method',
  'reviewId',
  'schemaVersion',
  'severityVocabulary',
  'tasks',
] as const;
const taskKeys = ['expected', 'id', 'objective', 'order', 'procedure', 'review'] as const;
const reviewKeys = ['correctiveAction', 'observation', 'severity'] as const;

interface ReviewTask {
  readonly expected: Readonly<Record<string, unknown>>;
  readonly id: string;
  readonly objective: string;
  readonly order: number;
  readonly procedure: string;
  readonly review: {
    readonly correctiveAction: string;
    readonly observation: string;
    readonly severity: string;
  };
}

interface HeuristicReviewContract {
  readonly controlledProject: {
    readonly directory: string;
    readonly expectedFindingCount: number;
    readonly htmlReportPath: string;
    readonly jsonReportPath: string;
    readonly projectId: string;
    readonly reportDirectory: string;
  };
  readonly method: {
    readonly kind: string;
    readonly participantCount: number;
    readonly participantReason: string;
    readonly participantTestingStatus: string;
    readonly susScore: number | null;
    readonly susStatus: string;
    readonly timingInterpretation: string;
    readonly timingKind: string;
  };
  readonly reviewId: string;
  readonly schemaVersion: number;
  readonly severityVocabulary: readonly string[];
  readonly tasks: readonly ReviewTask[];
}

const readContract = async (): Promise<{
  readonly contract: HeuristicReviewContract;
  readonly text: string;
}> => {
  const text = await readFile(contractPath, 'utf8');

  return {
    contract: JSON.parse(text) as HeuristicReviewContract,
    text,
  };
};

describe('expert heuristic review contract', () => {
  it('is canonical JSON with one closed six-task sequence', async () => {
    const { contract, text } = await readContract();

    expect(text).toBe(
      await format(JSON.stringify(contract, null, 2), {
        endOfLine: 'lf',
        parser: 'json',
        printWidth: 100,
      }),
    );
    expect(Object.keys(contract).sort()).toEqual([...topLevelKeys].sort());
    expect(contract.schemaVersion).toBe(1);
    expect(contract.reviewId).toBe('UXAUDIT-EXPERT-HEURISTIC-REVIEW');
    expect(contract.tasks.map(({ id }) => id)).toEqual(expectedTaskIds);
    expect(contract.tasks.map(({ order }) => order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(contract.tasks.map(({ id }) => id)).size).toBe(contract.tasks.length);

    for (const task of contract.tasks) {
      expect(Object.keys(task).sort()).toEqual([...taskKeys].sort());
      expect(Object.keys(task.review).sort()).toEqual([...reviewKeys].sort());
      expect(task.objective.trim()).toBe(task.objective);
      expect(task.procedure.trim()).toBe(task.procedure);
      expect(task.review.observation.length).toBeGreaterThan(0);
      expect(task.review.correctiveAction.length).toBeGreaterThan(0);
    }
  });

  it('records an expert procedure without participant or SUS data', async () => {
    const { contract } = await readContract();

    expect(contract.method).toEqual({
      kind: 'expert-heuristic-review',
      participantTestingStatus: 'unexecuted',
      participantCount: 0,
      participantReason:
        'No real participant observations or responses are available in the repository.',
      susStatus: 'not-applicable',
      susScore: null,
      timingKind: 'scripted-expert-procedure-wall-clock',
      timingInterpretation:
        'Durations measure the executed expert-review procedure, not user task time.',
    });
    expect(contract.method.participantReason).not.toMatch(/participant (?:completed|passed)/iu);
  });

  it('locks the controlled outputs and honest reviewed observations', async () => {
    const { contract } = await readContract();

    expect(contract.controlledProject).toEqual({
      projectId: 'invalid-project',
      directory: 'invalid-project',
      expectedFindingCount: 8,
      reportDirectory: 'uxaudit-usability',
      jsonReportPath: 'uxaudit-usability/audit-report.json',
      htmlReportPath: 'uxaudit-usability/audit-report.html',
    });
    expect(contract.severityVocabulary).toEqual(['none', 'low', 'medium', 'high']);
    expect(contract.tasks.map(({ review }) => review.severity)).toEqual([
      'none',
      'none',
      'low',
      'none',
      'none',
      'none',
    ]);
    expect(
      contract.tasks.every(({ review }) => contract.severityVocabulary.includes(review.severity)),
    ).toBe(true);
    expect(contract.tasks[2]?.review.observation).toContain('three findings tie');
    expect(contract.tasks[5]?.review.correctiveAction).toContain('no interactive filter');
  });
});

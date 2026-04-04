import { buildSprintBatchPlan, deriveTriagePriority } from '@/lib/agents/planner';

describe('agent planner', () => {
  it('derives higher triage priority for urgent blocker bugs', () => {
    const priority = deriveTriagePriority({
      id: 'issue_1',
      key: 'API-1',
      title: 'Payments outage',
      type: 'bug',
      priority: 'medium',
      labels: ['incident', 'blocker'],
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    expect(priority).toBe('critical');
  });

  it('builds sprint batches with bounded capacity', () => {
    const plan = buildSprintBatchPlan({
      issues: Array.from({ length: 5 }).map((_, index) => ({
        id: `issue_${index}`,
        key: `API-${index + 1}`,
        title: `Issue ${index + 1}`,
        type: 'task',
        priority: index === 0 ? 'high' : 'medium',
        labels: [],
        dueDate: null,
      })),
      sprintBatchSize: 2,
      sprintLengthDays: 14,
      issueCapacityPerSprint: 2,
      startDate: new Date('2026-04-06T00:00:00.000Z'),
      existingSprintCount: 3,
    });

    expect(plan).toHaveLength(2);
    expect(plan[0]?.name).toBe('Sprint 4');
    expect(plan[0]?.issues).toHaveLength(2);
    expect(plan[1]?.name).toBe('Sprint 5');
    expect(plan[1]?.issues).toHaveLength(2);
  });
});

import {
  computeRoadmapPlacement,
  getRoadmapPeriod,
  roadmapEndDate,
  roadmapStartDate,
} from './roadmap';

describe('mobile roadmap utilities', () => {
  it('builds a current-quarter period from the current date', () => {
    const period = getRoadmapPeriod('quarterly', new Date('2026-06-28T12:00:00.000Z'));

    expect(period.columns).toHaveLength(3);
    expect(
      period.columns.map((column) => [
        column.start.getFullYear(),
        column.start.getMonth(),
        column.start.getDate(),
      ]),
    ).toEqual([
      [2026, 3, 1],
      [2026, 4, 1],
      [2026, 5, 1],
    ]);
    expect(period.columns.map((column) => column.isCurrent)).toEqual([false, false, true]);
  });

  it('computes clipped bar placement inside the visible period', () => {
    const period = getRoadmapPeriod('quarterly', new Date('2026-06-28T12:00:00.000Z'));

    expect(
      computeRoadmapPlacement('2026-05-01T00:00:00.000Z', '2026-05-31T00:00:00.000Z', period),
    ).toEqual({
      left: 32.967032967032964,
      width: 34.065934065934066,
    });
    expect(
      computeRoadmapPlacement('2026-01-01T00:00:00.000Z', '2026-03-31T00:00:00.000Z', period),
    ).toBeNull();
  });

  it('derives roadmap dates from custom fields with web-compatible fallbacks', () => {
    const issue = {
      createdAt: '2026-04-10T10:00:00.000Z',
      dueDate: '2026-06-30T00:00:00.000Z',
      customFields: {
        startDate: '2026-05-01T00:00:00.000Z',
        targetDate: '2026-05-20T00:00:00.000Z',
      },
    };

    expect(roadmapStartDate(issue)).toBe('2026-05-01T00:00:00.000Z');
    expect(roadmapEndDate(issue)).toBe('2026-05-20T00:00:00.000Z');
    expect(roadmapStartDate({ createdAt: issue.createdAt })).toBe(issue.createdAt);
    expect(roadmapEndDate({ dueDate: issue.dueDate })).toBe(issue.dueDate);
  });
});

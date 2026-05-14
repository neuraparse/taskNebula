/**
 * Tests for the catch-me-up summarizer's deterministic native fallback.
 *
 * The Anthropic / OpenAI codepaths are network-bound and exercised by an
 * e2e flow; here we verify the heuristic produces stable, validated output
 * so the dashboard banner has a guaranteed render path when no LLM key is
 * configured.
 */

import {
  catchMeUpNative,
  catchMeUpResponseSchema,
  type NotificationDigestInput,
} from '../catch-me-up';

const baseSince = new Date('2026-05-14T00:00:00.000Z');

function makeNotification(overrides: Partial<NotificationDigestInput>): NotificationDigestInput {
  return {
    id: 'n1',
    type: 'mention',
    title: 'You were mentioned in TASK-123',
    message: 'Please review the new spec',
    isRead: false,
    createdAt: new Date('2026-05-14T08:00:00.000Z'),
    actorName: 'Alice',
    projectKey: 'TN',
    projectName: 'TaskNebula',
    issueKey: 'TASK-123',
    issueId: 'issue-1',
    ...overrides,
  };
}

describe('catchMeUpNative', () => {
  it('returns a "no activity" digest for an empty list', () => {
    const result = catchMeUpNative({
      since: baseSince,
      notifications: [],
      provider: 'native',
      apiKey: null,
    });
    expect(result.summary_markdown).toMatch(/No new activity/i);
    expect(result.action_items).toEqual([]);
    expect(catchMeUpResponseSchema.safeParse(result).success).toBe(true);
  });

  it('groups notifications by project and surfaces all of them', () => {
    const result = catchMeUpNative({
      since: baseSince,
      notifications: [
        makeNotification({ id: '1', projectKey: 'TN', projectName: 'TaskNebula' }),
        makeNotification({ id: '2', projectKey: 'TN', projectName: 'TaskNebula', type: 'comment', title: 'Bob commented' }),
        makeNotification({ id: '3', projectKey: 'SV', projectName: 'Servo', actorName: 'Carol' }),
      ],
      provider: 'native',
      apiKey: null,
    });

    expect(result.summary_markdown).toContain('TaskNebula');
    expect(result.summary_markdown).toContain('Servo');
    expect(result.summary_markdown).toContain('3 updates');
    expect(result.summary_markdown).toContain('2 projects');
    expect(catchMeUpResponseSchema.safeParse(result).success).toBe(true);
  });

  it('flags mentions and assignments as high-urgency action items', () => {
    const result = catchMeUpNative({
      since: baseSince,
      notifications: [
        makeNotification({ id: '1', type: 'mention' }),
        makeNotification({ id: '2', type: 'assigned', title: 'New assignment: TASK-99' }),
        makeNotification({ id: '3', type: 'comment', title: 'Bob commented' }),
        makeNotification({ id: '4', type: 'issue_updated', title: 'Updated field' }),
      ],
      provider: 'native',
      apiKey: null,
    });

    expect(result.action_items.length).toBeGreaterThanOrEqual(2);
    for (const item of result.action_items) {
      expect(item.urgency).toBe('high');
      expect(item.link).toMatch(/^\/(issues|inbox)/);
    }
  });

  it('skips read notifications when picking action items', () => {
    const result = catchMeUpNative({
      since: baseSince,
      notifications: [
        makeNotification({ id: '1', type: 'mention', isRead: true }),
      ],
      provider: 'native',
      apiKey: null,
    });
    expect(result.action_items).toEqual([]);
  });

  it('treats AI/agent failures as actionable', () => {
    const result = catchMeUpNative({
      since: baseSince,
      notifications: [
        makeNotification({
          id: '1',
          type: 'ai_draft_failed',
          title: 'AI draft failed',
          issueId: null,
        }),
      ],
      provider: 'native',
      apiKey: null,
    });
    expect(result.action_items).toHaveLength(1);
    expect(result.action_items[0].urgency).toBe('high');
    expect(result.action_items[0].link).toBe('/inbox');
  });

  it('caps action items at 6', () => {
    const lots: NotificationDigestInput[] = Array.from({ length: 12 }).map((_, i) =>
      makeNotification({ id: `n${i}`, type: 'mention', title: `Mention ${i}` })
    );
    const result = catchMeUpNative({
      since: baseSince,
      notifications: lots,
      provider: 'native',
      apiKey: null,
    });
    expect(result.action_items.length).toBeLessThanOrEqual(6);
  });
});

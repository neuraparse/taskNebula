import type { QueryClient } from '@tanstack/react-query';

import { configureApi } from '@/api/client';
import { handleRealtimeEvent } from './realtime-sync';

function mockQueryClient() {
  return {
    invalidateQueries: jest.fn(),
  } as unknown as QueryClient & {
    invalidateQueries: jest.Mock;
  };
}

describe('mobile realtime sync', () => {
  beforeEach(() => {
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: 'authjs.session-token=abc' });
  });

  it('invalidates issue caches for issue update events', () => {
    const queryClient = mockQueryClient();

    handleRealtimeEvent(queryClient, {
      type: 'issue.updated',
      projectId: 'project_1',
      sprintId: 'sprint_1',
      issueId: 'issue_1',
      organizationId: 'org_1',
      userId: 'user_2',
      timestamp: 123,
    });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['https://tasks.example.com', 'issues'],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['https://tasks.example.com', 'issue', 'issue_1'],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['https://tasks.example.com', 'project', 'project_1'],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['https://tasks.example.com', 'project', 'project_1', 'sprints'],
    });
  });

  it('invalidates comments and activity for comment events', () => {
    const queryClient = mockQueryClient();

    handleRealtimeEvent(queryClient, {
      type: 'issue.commented',
      issueId: 'issue_1',
      organizationId: 'org_1',
      userId: 'user_2',
      timestamp: 123,
    });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['https://tasks.example.com', 'issue', 'issue_1', 'comments'],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['https://tasks.example.com', 'issue', 'issue_1', 'activities'],
    });
  });

  it('invalidates organization and project member caches for member events', () => {
    const queryClient = mockQueryClient();

    handleRealtimeEvent(queryClient, {
      type: 'member.updated',
      projectId: 'project_1',
      organizationId: 'org_1',
      userId: 'user_2',
      timestamp: 123,
    });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['https://tasks.example.com', 'organization', 'org_1', 'members'],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['https://tasks.example.com', 'project', 'project_1', 'members'],
    });
  });
});

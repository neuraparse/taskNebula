import type { QueryClient } from '@tanstack/react-query';

import { qk } from '@/hooks/queries';

export type RealtimeEventType =
  | 'issue.created'
  | 'issue.updated'
  | 'issue.deleted'
  | 'issue.commented'
  | 'sprint.created'
  | 'sprint.updated'
  | 'sprint.deleted'
  | 'sprint.issues.changed'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'member.added'
  | 'member.updated'
  | 'member.removed';

export interface RealtimeEvent {
  type: RealtimeEventType | string;
  projectId?: string;
  sprintId?: string;
  issueId?: string;
  organizationId?: string;
  targetUserId?: string;
  userId?: string;
  timestamp?: number;
}

function invalidateIssueCaches(queryClient: QueryClient, event: RealtimeEvent): void {
  queryClient.invalidateQueries({ queryKey: qk.projects() });
  queryClient.invalidateQueries({ queryKey: qk.issuesRoot() });
  queryClient.invalidateQueries({ queryKey: qk.myIssues('assigned') });
  queryClient.invalidateQueries({ queryKey: qk.myIssues('created') });
  queryClient.invalidateQueries({ queryKey: qk.myIssues('subscribed') });
  queryClient.invalidateQueries({ queryKey: qk.myIssues('mentioned') });

  if (event.projectId) {
    queryClient.invalidateQueries({ queryKey: qk.project(event.projectId) });
    queryClient.invalidateQueries({ queryKey: qk.sprints(event.projectId) });
  }
  if (event.sprintId) {
    queryClient.invalidateQueries({ queryKey: qk.sprint(event.sprintId) });
    queryClient.invalidateQueries({ queryKey: qk.sprintIssues(event.sprintId) });
  }
  if (event.issueId) {
    queryClient.invalidateQueries({ queryKey: qk.issue(event.issueId) });
    queryClient.invalidateQueries({ queryKey: qk.issueSubtasks(event.issueId) });
    queryClient.invalidateQueries({ queryKey: qk.issueActivities(event.issueId) });
    queryClient.invalidateQueries({ queryKey: qk.comments(event.issueId) });
    queryClient.invalidateQueries({ queryKey: qk.issueAttachments(event.issueId) });
  }
}

export function handleRealtimeEvent(queryClient: QueryClient, event: RealtimeEvent): void {
  switch (event.type) {
    case 'issue.created':
    case 'issue.updated':
    case 'issue.deleted':
    case 'sprint.issues.changed':
      invalidateIssueCaches(queryClient, event);
      break;

    case 'issue.commented':
      if (event.issueId) {
        queryClient.invalidateQueries({ queryKey: qk.issue(event.issueId) });
        queryClient.invalidateQueries({ queryKey: qk.comments(event.issueId) });
        queryClient.invalidateQueries({ queryKey: qk.issueActivities(event.issueId) });
      }
      break;

    case 'sprint.created':
    case 'sprint.updated':
    case 'sprint.deleted':
      if (event.projectId) {
        queryClient.invalidateQueries({ queryKey: qk.sprints(event.projectId) });
      }
      if (event.sprintId) {
        queryClient.invalidateQueries({ queryKey: qk.sprint(event.sprintId) });
        queryClient.invalidateQueries({ queryKey: qk.sprintIssues(event.sprintId) });
      }
      invalidateIssueCaches(queryClient, event);
      break;

    case 'project.created':
    case 'project.updated':
    case 'project.deleted':
      queryClient.invalidateQueries({ queryKey: qk.projects() });
      if (event.projectId) {
        queryClient.invalidateQueries({ queryKey: qk.project(event.projectId) });
      }
      break;

    case 'member.added':
    case 'member.updated':
    case 'member.removed':
      queryClient.invalidateQueries({ queryKey: qk.projects() });
      if (event.organizationId) {
        queryClient.invalidateQueries({ queryKey: qk.organizationMembers(event.organizationId) });
      }
      if (event.projectId) {
        queryClient.invalidateQueries({ queryKey: qk.project(event.projectId) });
        queryClient.invalidateQueries({ queryKey: qk.projectMembers(event.projectId) });
      } else {
        queryClient.invalidateQueries({ queryKey: qk.projects() });
      }
      break;
  }
}

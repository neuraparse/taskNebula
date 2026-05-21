import { z } from 'zod';
import type { ToolDefinition } from './types.js';

export const searchIssuesInput = z.object({
  query: z
    .string()
    .min(1)
    .describe('Free-text query — matches title, description, and key (e.g. "TN-123").'),
  organizationId: z.string().min(1).describe('Workspace / organization id to search within.'),
  projectId: z.string().optional().describe('Restrict results to a single project.'),
  status: z.string().optional().describe('Workflow status name, e.g. "In Progress".'),
  assigneeId: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
});

export const searchIssuesTool: ToolDefinition<typeof searchIssuesInput> = {
  name: 'search_issues',
  description:
    'Full-text search across issues in TaskNebula. Supports filtering by project, status, and assignee.',
  inputSchema: searchIssuesInput,
  async handler(input, { client }) {
    return client.get('/api/search', {
      q: input.query,
      organizationId: input.organizationId,
      type: 'issue',
      projectId: input.projectId,
      status: input.status,
      assigneeId: input.assigneeId,
      limit: input.limit,
      offset: input.offset,
    });
  },
};

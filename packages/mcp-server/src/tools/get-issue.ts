import { z } from 'zod';
import type { ToolDefinition } from './types.js';

export const getIssueInput = z.object({
  issueId: z.string().min(1).describe('Issue id (cuid) or key like "TN-123".'),
});

export const getIssueTool: ToolDefinition<typeof getIssueInput> = {
  name: 'get_issue',
  description: 'Fetch a single issue with comments, links, assignee, and status.',
  inputSchema: getIssueInput,
  async handler(input, { client }) {
    return client.get(`/api/issues/${encodeURIComponent(input.issueId)}`);
  },
};

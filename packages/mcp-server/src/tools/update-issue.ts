import { z } from 'zod';
import type { ToolDefinition } from './types.js';

export const updateIssueInput = z.object({
  issueId: z.string().min(1),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest']).optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimateHours: z.number().nonnegative().optional(),
});

export const updateIssueTool: ToolDefinition<typeof updateIssueInput> = {
  name: 'update_issue',
  description: 'Patch fields on an existing issue (title, description, priority, labels, due date, estimate).',
  inputSchema: updateIssueInput,
  async handler(input, { client }) {
    const { issueId, ...patch } = input;
    return client.patch(`/api/issues/${encodeURIComponent(issueId)}`, patch);
  },
};

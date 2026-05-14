import { z } from 'zod';
import type { ToolDefinition } from './types.js';

export const assignIssueInput = z.object({
  issueId: z.string().min(1),
  assigneeId: z
    .string()
    .nullable()
    .describe('User id to assign, or null to unassign.'),
});

export const assignIssueTool: ToolDefinition<typeof assignIssueInput> = {
  name: 'assign_issue',
  description: 'Assign or unassign an issue.',
  inputSchema: assignIssueInput,
  async handler(input, { client }) {
    return client.patch(`/api/issues/${encodeURIComponent(input.issueId)}`, {
      assigneeId: input.assigneeId,
    });
  },
};

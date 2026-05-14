import { z } from 'zod';
import type { ToolDefinition } from './types.js';

export const listMyAssignedInput = z.object({
  status: z
    .enum(['open', 'in_progress', 'blocked', 'done', 'all'])
    .default('open')
    .describe('Filter by high-level status bucket.'),
  limit: z.number().int().min(1).max(100).default(25),
});

export const listMyAssignedTool: ToolDefinition<typeof listMyAssignedInput> = {
  name: 'list_my_assigned',
  description: 'List issues assigned to the authenticated user.',
  inputSchema: listMyAssignedInput,
  async handler(input, { client }) {
    return client.get('/api/issues/my-issues', {
      status: input.status,
      limit: input.limit,
    });
  },
};

import { z } from 'zod';
import type { ToolDefinition } from './types.js';

export const createSubtaskInput = z.object({
  parentIssueId: z.string().min(1),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest']).optional(),
});

export const createSubtaskTool: ToolDefinition<typeof createSubtaskInput> = {
  name: 'create_subtask',
  description: 'Create a subtask under an existing issue.',
  inputSchema: createSubtaskInput,
  async handler(input, { client }) {
    const { parentIssueId, ...body } = input;
    return client.post('/api/issues', {
      ...body,
      type: 'subtask',
      parentIssueId,
    });
  },
};

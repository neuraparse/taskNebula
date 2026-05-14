import { z } from 'zod';
import type { ToolDefinition } from './types.js';

export const addCommentInput = z.object({
  issueId: z.string().min(1),
  body: z.string().min(1).describe('Markdown-formatted comment body.'),
  mentions: z.array(z.string()).optional().describe('User ids to @-mention.'),
});

export const addCommentTool: ToolDefinition<typeof addCommentInput> = {
  name: 'add_comment',
  description: 'Add a comment to an issue.',
  inputSchema: addCommentInput,
  async handler(input, { client }) {
    return client.post(`/api/issues/${encodeURIComponent(input.issueId)}/comments`, {
      body: input.body,
      mentions: input.mentions,
    });
  },
};

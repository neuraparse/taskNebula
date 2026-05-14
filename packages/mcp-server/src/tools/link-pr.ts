import { z } from 'zod';
import type { ToolDefinition } from './types.js';

export const linkPrInput = z.object({
  issueId: z.string().min(1),
  url: z
    .string()
    .url()
    .describe('Full URL of the pull/merge request (GitHub, GitLab, etc.).'),
  provider: z.enum(['github', 'gitlab', 'bitbucket', 'other']).default('github'),
  status: z.enum(['open', 'merged', 'closed', 'draft']).optional(),
});

export const linkPrTool: ToolDefinition<typeof linkPrInput> = {
  name: 'link_pr',
  description: 'Attach a pull/merge request link to an issue.',
  inputSchema: linkPrInput,
  async handler(input, { client }) {
    return client.post(`/api/issues/${encodeURIComponent(input.issueId)}/links`, {
      type: 'pull_request',
      url: input.url,
      provider: input.provider,
      status: input.status,
    });
  },
};

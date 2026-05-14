import { z } from 'zod';
import type { ToolDefinition } from './types.js';

export const listProjectsInput = z.object({
  organizationId: z.string().optional(),
  includeArchived: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(50),
});

export const listProjectsTool: ToolDefinition<typeof listProjectsInput> = {
  name: 'list_projects',
  description: 'List projects accessible to the authenticated user.',
  inputSchema: listProjectsInput,
  async handler(input, { client }) {
    return client.get('/api/projects', {
      organizationId: input.organizationId,
      includeArchived: input.includeArchived,
      limit: input.limit,
    });
  },
};

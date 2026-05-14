import { z } from 'zod';
import type { ToolDefinition } from './types.js';

export const getMyWorkloadInput = z.object({
  window: z
    .enum(['today', 'this_week', 'this_sprint', 'overdue'])
    .default('this_week')
    .describe('Time window to summarize.'),
});

export const getMyWorkloadTool: ToolDefinition<typeof getMyWorkloadInput> = {
  name: 'get_my_workload',
  description:
    'Return an aggregated workload snapshot for the authenticated user: counts by status, priority, and the issues due in the selected window.',
  inputSchema: getMyWorkloadInput,
  async handler(input, { client }) {
    return client.get('/api/metrics/my-workload', { window: input.window });
  },
};

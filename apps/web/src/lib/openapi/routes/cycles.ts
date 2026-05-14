import { z } from 'zod';
import { registerRoute, TAGS } from '../registry';
import {
  CycleListQuerySchema,
  CycleSchema,
  ErrorResponseSchema,
} from '../schemas';

// GET /api/cycles
//
// Note: The runtime route is currently mounted at `/api/sprints`. We expose it
// here under the canonical "cycles" name that the public/MCP surface uses;
// when the runtime route is renamed/aliased, this entry stays correct.
registerRoute({
  method: 'get',
  path: '/api/cycles',
  summary: 'List cycles (sprints) for a project',
  description:
    'Returns cycles (a.k.a. sprints) for the specified project, with issue counts. `projectId` may be a project id or project key.',
  tags: [TAGS.Cycles],
  request: { query: CycleListQuerySchema },
  responses: {
    '200': {
      description: 'A list of cycles.',
      content: { 'application/json': { schema: z.array(CycleSchema) } },
    },
    '400': {
      description: '`projectId` is required.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Project not found.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

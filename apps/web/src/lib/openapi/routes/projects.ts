import { z } from 'zod';
import { registerRoute, TAGS } from '../registry';
import {
  ErrorResponseSchema,
  ProjectListQuerySchema,
  ProjectSchema,
} from '../schemas';

// GET /api/projects
registerRoute({
  method: 'get',
  path: '/api/projects',
  summary: 'List projects accessible to the current user',
  description:
    'Returns projects from organizations the caller is a member of, optionally narrowed by `organizationId` and/or `teamId`. Super admins see all projects in the scope.',
  tags: [TAGS.Projects],
  request: { query: ProjectListQuerySchema },
  responses: {
    '200': {
      description: 'A list of projects.',
      content: { 'application/json': { schema: z.array(ProjectSchema) } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '403': {
      description: 'Forbidden — caller is not in the requested organization.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

import { registerRoute, TAGS } from '../registry';
import { ErrorResponseSchema, HealthResponseSchema } from '../schemas';

// GET /api/health — public, no auth required.
registerRoute({
  method: 'get',
  path: '/api/health',
  summary: 'Service health check',
  description:
    'Returns the health status of the application — database, memory, redis, livekit and smtp checks. Used by container orchestrators and monitoring.',
  tags: [TAGS.Health],
  security: [],
  responses: {
    '200': {
      description: 'Service is healthy or degraded.',
      content: { 'application/json': { schema: HealthResponseSchema } },
    },
    '503': {
      description: 'Service is unhealthy (database or memory failure).',
      content: { 'application/json': { schema: HealthResponseSchema } },
    },
    '500': {
      description: 'Unexpected error.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

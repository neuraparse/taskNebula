import { registerRoute, TAGS } from '../registry';
import { CurrentUserSchema, ErrorResponseSchema } from '../schemas';

// GET /api/users/me
//
// The runtime route lives at `/api/user/me`. The "users/me" path is the
// documented public surface; both forms should be aliased server-side.
registerRoute({
  method: 'get',
  path: '/api/users/me',
  summary: 'Get the current authenticated user',
  description:
    'Returns the authenticated user with their super-admin and account status. Equivalent to the legacy `/api/user/me` endpoint.',
  tags: [TAGS.Users],
  responses: {
    '200': {
      description: 'The current user.',
      content: { 'application/json': { schema: CurrentUserSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'User not found.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

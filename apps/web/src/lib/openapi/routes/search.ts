import { registerRoute, TAGS } from '../registry';
import {
  ErrorResponseSchema,
  SearchBodySchema,
  SearchResponseSchema,
} from '../schemas';

// POST /api/search
//
// The runtime route currently accepts the same parameters via GET query
// string. We expose `POST` here because the MCP server (task #5) and other
// programmatic clients prefer a JSON body for complex JQL queries.
registerRoute({
  method: 'post',
  path: '/api/search',
  summary: 'Execute a JQL-style search',
  description:
    'Run a structured search query against issues. Accepts JQL-style expressions like `assignee = me AND status = "In Progress"`.',
  tags: [TAGS.Search],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: SearchBodySchema } },
    },
  },
  responses: {
    '200': {
      description: 'Search results.',
      content: { 'application/json': { schema: SearchResponseSchema } },
    },
    '400': {
      description: 'Invalid query syntax or missing required fields.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

import { registerRoute, TAGS } from '../registry';
import {
  CreateCommentBodySchema,
  CommentSchema,
  CreateIssueBodySchema,
  DeleteIssueResponseSchema,
  ErrorResponseSchema,
  IssueIdParamSchema,
  IssueListQuerySchema,
  IssueListResponseSchema,
  IssueSchema,
  UpdateIssueBodySchema,
} from '../schemas';

// GET /api/issues
registerRoute({
  method: 'get',
  path: '/api/issues',
  summary: 'List issues',
  description:
    'Returns issues visible to the authenticated user. Optionally filter by project, assignee, status category, sprint, parent, or type.',
  tags: [TAGS.Issues],
  request: { query: IssueListQuerySchema },
  responses: {
    '200': {
      description: 'A list of issues.',
      content: { 'application/json': { schema: IssueListResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '403': {
      description: 'Forbidden — caller has no access to the requested project.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// POST /api/issues
registerRoute({
  method: 'post',
  path: '/api/issues',
  summary: 'Create an issue',
  description:
    'Creates a new issue in the given project. The caller must have `create` permission for the project.',
  tags: [TAGS.Issues],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: CreateIssueBodySchema } },
    },
  },
  responses: {
    '201': {
      description: 'The created issue.',
      content: { 'application/json': { schema: IssueSchema } },
    },
    '400': {
      description: 'Validation failed.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '403': {
      description: 'Forbidden — insufficient permissions to create issues.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Project not found.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// GET /api/issues/{issueId}
registerRoute({
  method: 'get',
  path: '/api/issues/{issueId}',
  summary: 'Get an issue',
  description: 'Fetch a single issue by id.',
  tags: [TAGS.Issues],
  request: { params: IssueIdParamSchema },
  responses: {
    '200': {
      description: 'The issue.',
      content: { 'application/json': { schema: IssueSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '403': {
      description: 'Forbidden — caller has no view access.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Issue not found.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// PATCH /api/issues/{issueId}
registerRoute({
  method: 'patch',
  path: '/api/issues/{issueId}',
  summary: 'Update an issue',
  description:
    'Partial update. The required permission depends on which fields are changed (edit, assign, transition, schedule).',
  tags: [TAGS.Issues],
  request: {
    params: IssueIdParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: UpdateIssueBodySchema } },
    },
  },
  responses: {
    '200': {
      description: 'The updated issue.',
      content: { 'application/json': { schema: IssueSchema } },
    },
    '400': {
      description: 'Validation failed.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '403': {
      description: 'Forbidden — missing permission for one of the requested changes.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Issue or referenced status not found.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// DELETE /api/issues/{issueId}
registerRoute({
  method: 'delete',
  path: '/api/issues/{issueId}',
  summary: 'Delete an issue',
  tags: [TAGS.Issues],
  request: { params: IssueIdParamSchema },
  responses: {
    '200': {
      description: 'Issue deleted.',
      content: { 'application/json': { schema: DeleteIssueResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '403': {
      description: 'Forbidden — insufficient permissions.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Issue not found.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// POST /api/issues/{issueId}/comments
registerRoute({
  method: 'post',
  path: '/api/issues/{issueId}/comments',
  summary: 'Comment on an issue',
  tags: [TAGS.Comments],
  request: {
    params: IssueIdParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: CreateCommentBodySchema } },
    },
  },
  responses: {
    '201': {
      description: 'The created comment.',
      content: { 'application/json': { schema: CommentSchema } },
    },
    '400': {
      description: 'Validation failed.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

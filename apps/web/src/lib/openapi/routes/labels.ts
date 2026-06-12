import { registerRoute, TAGS } from '../registry';
import {
  CreateLabelBodySchema,
  DeleteLabelResponseSchema,
  ErrorResponseSchema,
  LabelIdParamSchema,
  LabelListQuerySchema,
  LabelListResponseSchema,
  LabelSchema,
  UpdateLabelBodySchema,
} from '../schemas';

// GET /api/labels
registerRoute({
  method: 'get',
  path: '/api/labels',
  summary: 'List labels for an organization',
  description:
    "Returns the organization's labels with per-label usage counts, ordered by name. " +
    "When `projectId` is given, returns that project's labels plus org-wide labels. " +
    '`q` filters by case-insensitive name prefix.',
  tags: [TAGS.Labels],
  request: { query: LabelListQuerySchema },
  responses: {
    '200': {
      description: 'A list of labels with usage counts.',
      content: { 'application/json': { schema: LabelListResponseSchema } },
    },
    '400': {
      description: '`organizationId` is required.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '403': {
      description: 'Forbidden — caller is not an active member of the organization.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Project not found in the organization.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// POST /api/labels
registerRoute({
  method: 'post',
  path: '/api/labels',
  summary: 'Create a label',
  description:
    'Creates an org-wide label, or a project-scoped one when `projectId` is provided. ' +
    'Label names are unique per (organization, project) scope.',
  tags: [TAGS.Labels],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: CreateLabelBodySchema } },
    },
  },
  responses: {
    '201': {
      description: 'The created label.',
      content: { 'application/json': { schema: LabelSchema } },
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
      description: 'Forbidden — caller is not an active member of the organization.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Project not found in the organization.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '409': {
      description: 'A label with this name already exists in this scope.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// PATCH /api/labels/{labelId}
registerRoute({
  method: 'patch',
  path: '/api/labels/{labelId}',
  summary: 'Update a label',
  description:
    'Rename / recolor / re-describe a label. On rename, the legacy `issues.labels` JSONB arrays ' +
    'in the organization are rewritten in the same transaction.',
  tags: [TAGS.Labels],
  request: {
    params: LabelIdParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: UpdateLabelBodySchema } },
    },
  },
  responses: {
    '200': {
      description: 'The updated label.',
      content: { 'application/json': { schema: LabelSchema } },
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
      description: "Forbidden — caller is not a member of the label's organization.",
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Label not found.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '409': {
      description: 'A label with this name already exists in this scope.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// DELETE /api/labels/{labelId}
registerRoute({
  method: 'delete',
  path: '/api/labels/{labelId}',
  summary: 'Delete a label',
  description:
    'Deletes the label. Issue associations cascade, and the name is removed from the legacy ' +
    '`issues.labels` JSONB arrays org-wide in the same transaction.',
  tags: [TAGS.Labels],
  request: { params: LabelIdParamSchema },
  responses: {
    '200': {
      description: 'Label deleted.',
      content: { 'application/json': { schema: DeleteLabelResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '403': {
      description: "Forbidden — caller is not a member of the label's organization.",
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Label not found.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

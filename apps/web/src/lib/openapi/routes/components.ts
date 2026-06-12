import { registerRoute, TAGS } from '../registry';
import {
  ComponentListResponseSchema,
  ComponentParamsSchema,
  ComponentResponseSchema,
  CreateComponentBodySchema,
  ErrorResponseSchema,
  IssueComponentsResponseSchema,
  IssueIdParamSchema,
  ProjectIdParamSchema,
  SetIssueComponentsBodySchema,
  SuccessResponseSchema,
  UpdateComponentBodySchema,
} from '../schemas';

// GET /api/projects/{projectId}/components
registerRoute({
  method: 'get',
  path: '/api/projects/{projectId}/components',
  summary: 'List components for a project',
  description: "Returns the project's components ordered by name, with per-component issue counts.",
  tags: [TAGS.Components],
  request: { params: ProjectIdParamSchema },
  responses: {
    '200': {
      description: 'A list of components with issue counts.',
      content: { 'application/json': { schema: ComponentListResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Project not found (or not visible to the caller).',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// POST /api/projects/{projectId}/components
registerRoute({
  method: 'post',
  path: '/api/projects/{projectId}/components',
  summary: 'Create a component',
  description:
    'Creates a component in the project. Requires project-manage permission. Component names ' +
    'are unique per project; `leadId` must be an active member of the organization.',
  tags: [TAGS.Components],
  request: {
    params: ProjectIdParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: CreateComponentBodySchema } },
    },
  },
  responses: {
    '201': {
      description: 'The created component.',
      content: { 'application/json': { schema: ComponentResponseSchema } },
    },
    '400': {
      description: 'Validation failed, or the lead is not an active organization member.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '403': {
      description: 'Forbidden — caller cannot manage the project.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Project not found (or not visible to the caller).',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '409': {
      description: 'A component with this name already exists in this project.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// GET /api/projects/{projectId}/components/{componentId}
registerRoute({
  method: 'get',
  path: '/api/projects/{projectId}/components/{componentId}',
  summary: 'Get a component',
  tags: [TAGS.Components],
  request: { params: ComponentParamsSchema },
  responses: {
    '200': {
      description: 'The component.',
      content: { 'application/json': { schema: ComponentResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Project or component not found.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// PATCH /api/projects/{projectId}/components/{componentId}
registerRoute({
  method: 'patch',
  path: '/api/projects/{projectId}/components/{componentId}',
  summary: 'Update a component',
  description:
    'Partial update, including archiving via `archived`. Requires project-manage permission.',
  tags: [TAGS.Components],
  request: {
    params: ComponentParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: UpdateComponentBodySchema } },
    },
  },
  responses: {
    '200': {
      description: 'The updated component.',
      content: { 'application/json': { schema: ComponentResponseSchema } },
    },
    '400': {
      description: 'Validation failed, or the lead is not an active organization member.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '403': {
      description: 'Forbidden — caller cannot manage the project.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Project or component not found.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '409': {
      description: 'A component with this name already exists in this project.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// DELETE /api/projects/{projectId}/components/{componentId}
registerRoute({
  method: 'delete',
  path: '/api/projects/{projectId}/components/{componentId}',
  summary: 'Delete a component',
  description:
    'Deletes the component. Issue associations cascade. Requires project-manage permission.',
  tags: [TAGS.Components],
  request: { params: ComponentParamsSchema },
  responses: {
    '200': {
      description: 'Component deleted.',
      content: { 'application/json': { schema: SuccessResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '403': {
      description: 'Forbidden — caller cannot manage the project.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Project or component not found.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// GET /api/issues/{issueId}/components
registerRoute({
  method: 'get',
  path: '/api/issues/{issueId}/components',
  summary: 'List components linked to an issue',
  tags: [TAGS.Components],
  request: { params: IssueIdParamSchema },
  responses: {
    '200': {
      description: "The issue's components.",
      content: { 'application/json': { schema: IssueComponentsResponseSchema } },
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

// PUT /api/issues/{issueId}/components
registerRoute({
  method: 'put',
  path: '/api/issues/{issueId}/components',
  summary: "Replace an issue's components",
  description:
    "Replaces the issue's component set. Every component must belong to the issue's project.",
  tags: [TAGS.Components],
  request: {
    params: IssueIdParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: SetIssueComponentsBodySchema } },
    },
  },
  responses: {
    '200': {
      description: "The issue's updated components.",
      content: { 'application/json': { schema: IssueComponentsResponseSchema } },
    },
    '400': {
      description:
        "Validation failed, or some components do not belong to the issue's project (response includes `invalidIds`).",
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '403': {
      description: 'Forbidden — caller cannot edit the issue.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Issue not found.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

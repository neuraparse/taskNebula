import { registerRoute, TAGS } from '../registry';
import {
  CreateVersionBodySchema,
  ErrorResponseSchema,
  IssueIdParamSchema,
  IssueVersionsResponseSchema,
  ProjectIdParamSchema,
  ReleaseVersionBodySchema,
  ReleaseVersionResponseSchema,
  SetIssueVersionsBodySchema,
  SuccessResponseSchema,
  UpdateVersionBodySchema,
  VersionListResponseSchema,
  VersionParamsSchema,
  VersionResponseSchema,
} from '../schemas';

// GET /api/projects/{projectId}/versions
registerRoute({
  method: 'get',
  path: '/api/projects/{projectId}/versions',
  summary: 'List versions for a project',
  description:
    "Returns the project's versions ordered by sort order then name, with per-version issue " +
    'counts (`doneIssueCount` = issues with a non-null resolution).',
  tags: [TAGS.Versions],
  request: { params: ProjectIdParamSchema },
  responses: {
    '200': {
      description: 'A list of versions with issue counts.',
      content: { 'application/json': { schema: VersionListResponseSchema } },
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

// POST /api/projects/{projectId}/versions
registerRoute({
  method: 'post',
  path: '/api/projects/{projectId}/versions',
  summary: 'Create a version',
  description:
    'Creates a version in the project. Requires project-manage permission. Version names are ' +
    'unique per project; the new version is appended to the sort order.',
  tags: [TAGS.Versions],
  request: {
    params: ProjectIdParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: CreateVersionBodySchema } },
    },
  },
  responses: {
    '201': {
      description: 'The created version.',
      content: { 'application/json': { schema: VersionResponseSchema } },
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
      description: 'Forbidden — caller cannot manage the project.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Project not found (or not visible to the caller).',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '409': {
      description: 'A version with this name already exists in this project.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// GET /api/projects/{projectId}/versions/{versionId}
registerRoute({
  method: 'get',
  path: '/api/projects/{projectId}/versions/{versionId}',
  summary: 'Get a version',
  tags: [TAGS.Versions],
  request: { params: VersionParamsSchema },
  responses: {
    '200': {
      description: 'The version.',
      content: { 'application/json': { schema: VersionResponseSchema } },
    },
    '401': {
      description: 'Unauthorized.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Project or version not found.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// PATCH /api/projects/{projectId}/versions/{versionId}
registerRoute({
  method: 'patch',
  path: '/api/projects/{projectId}/versions/{versionId}',
  summary: 'Update a version',
  description:
    'Partial update. Transitioning `status` to `released` stamps `releasedAt` (if unset); back ' +
    'to `unreleased` clears it. Requires project-manage permission.',
  tags: [TAGS.Versions],
  request: {
    params: VersionParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: UpdateVersionBodySchema } },
    },
  },
  responses: {
    '200': {
      description: 'The updated version.',
      content: { 'application/json': { schema: VersionResponseSchema } },
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
      description: 'Forbidden — caller cannot manage the project.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '404': {
      description: 'Project or version not found.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    '409': {
      description: 'A version with this name already exists in this project.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// DELETE /api/projects/{projectId}/versions/{versionId}
registerRoute({
  method: 'delete',
  path: '/api/projects/{projectId}/versions/{versionId}',
  summary: 'Delete a version',
  description:
    'Deletes the version. Issue fix/affects associations cascade. Requires project-manage permission.',
  tags: [TAGS.Versions],
  request: { params: VersionParamsSchema },
  responses: {
    '200': {
      description: 'Version deleted.',
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
      description: 'Project or version not found.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// POST /api/projects/{projectId}/versions/{versionId}/release
registerRoute({
  method: 'post',
  path: '/api/projects/{projectId}/versions/{versionId}/release',
  summary: 'Release a version',
  description:
    'Marks the version as released (stamps `releasedAt`). Optionally re-points unresolved ' +
    "issues' fix-version to another version of the same project via `moveOpenIssuesToVersionId`. " +
    'The body may be omitted entirely. Requires project-manage permission.',
  tags: [TAGS.Versions],
  request: {
    params: VersionParamsSchema,
    body: {
      required: false,
      content: { 'application/json': { schema: ReleaseVersionBodySchema } },
    },
  },
  responses: {
    '200': {
      description: 'The released version and the number of issues moved.',
      content: { 'application/json': { schema: ReleaseVersionResponseSchema } },
    },
    '400': {
      description:
        'Invalid JSON body, validation failed, or the move target is invalid (same version or not in this project).',
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
      description: 'Project or version not found.',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// GET /api/issues/{issueId}/versions
registerRoute({
  method: 'get',
  path: '/api/issues/{issueId}/versions',
  summary: 'List fix and affects versions for an issue',
  tags: [TAGS.Versions],
  request: { params: IssueIdParamSchema },
  responses: {
    '200': {
      description: "The issue's fix and affects versions.",
      content: { 'application/json': { schema: IssueVersionsResponseSchema } },
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

// PUT /api/issues/{issueId}/versions
registerRoute({
  method: 'put',
  path: '/api/issues/{issueId}/versions',
  summary: "Replace an issue's fix and/or affects versions",
  description:
    'Replaces the provided association set(s). At least one of `fixVersionIds` or ' +
    "`affectsVersionIds` must be provided; every version must belong to the issue's project.",
  tags: [TAGS.Versions],
  request: {
    params: IssueIdParamSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: SetIssueVersionsBodySchema } },
    },
  },
  responses: {
    '200': {
      description: "The issue's updated fix and affects versions.",
      content: { 'application/json': { schema: IssueVersionsResponseSchema } },
    },
    '400': {
      description:
        "Validation failed, or some versions do not belong to the issue's project (response includes `invalidIds`).",
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

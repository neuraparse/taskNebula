/**
 * Shared Zod schemas for OpenAPI documentation.
 *
 * These mirror the runtime contracts of the registered API routes. When a
 * route's request/response shape changes, update the schema here AND the
 * route's runtime validation — they are intentionally duplicated so the
 * docs can drift only with explicit intent.
 */

import { z } from 'zod';
import './registry'; // ensure `.openapi()` extension is loaded

// ---- shared building blocks -------------------------------------------------

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: 'Unauthorized' }),
    code: z.string().optional().openapi({ example: 'UNAUTHORIZED' }),
    details: z.unknown().optional(),
  })
  .openapi('ErrorResponse');

export const IssueTypeSchema = z.enum(['story', 'task', 'bug', 'epic']).openapi('IssueType');

export const IssuePrioritySchema = z
  .enum(['critical', 'high', 'medium', 'low', 'none'])
  .openapi('IssuePriority');

export const IssueStatusCategorySchema = z
  .enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'])
  .openapi('IssueStatusCategory');

export const IssueResolutionSchema = z
  .enum(['fixed', 'wont_do', 'duplicate', 'cannot_reproduce', 'done'])
  .openapi('IssueResolution');

export const UserSummarySchema = z
  .object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    image: z.string().nullable().optional(),
  })
  .openapi('UserSummary');

// ---- Issues -----------------------------------------------------------------

export const IssueSchema = z
  .object({
    id: z.string(),
    organizationId: z.string(),
    projectId: z.string(),
    key: z.string().openapi({ example: 'PROJ-12' }),
    number: z.number().int().nullable(),
    type: IssueTypeSchema,
    title: z.string(),
    description: z.string().nullable(),
    statusId: z.string().nullable(),
    priority: IssuePrioritySchema,
    assigneeId: z.string().nullable(),
    reporterId: z.string().nullable(),
    labels: z.array(z.string()).default([]),
    sprintId: z.string().nullable(),
    epicId: z.string().nullable(),
    parentId: z.string().nullable(),
    estimate: z.number().nullable(),
    dueDate: z.string().datetime().nullable(),
    resolution: IssueResolutionSchema.nullable(),
    resolvedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('Issue');

export const IssueListResponseSchema = z
  .object({
    issues: z.array(IssueSchema),
    total: z.number().int(),
  })
  .openapi('IssueListResponse');

export const IssueListQuerySchema = z
  .object({
    projectId: z.string().optional(),
    assigneeId: z.string().optional(),
    status: IssueStatusCategorySchema.optional(),
    sprintId: z.string().optional(),
    parentId: z.string().optional(),
    type: IssueTypeSchema.optional(),
  })
  .openapi('IssueListQuery');

export const CreateIssueBodySchema = z
  .object({
    projectId: z.string(),
    type: IssueTypeSchema,
    title: z.string().min(1).max(500),
    description: z.string().nullable().optional(),
    priority: IssuePrioritySchema.default('medium'),
    assigneeId: z.string().optional(),
    labels: z.array(z.string()).default([]),
    sprintId: z.string().optional(),
    epicId: z.string().optional(),
    parentId: z.string().optional(),
    estimate: z.number().optional(),
    dueDate: z.string().datetime().optional(),
    customFields: z.record(z.unknown()).default({}),
    statusId: z.string().optional(),
  })
  .openapi('CreateIssueBody');

export const UpdateIssueBodySchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().optional(),
    status: IssueStatusCategorySchema.optional(),
    statusId: z.string().optional(),
    priority: IssuePrioritySchema.optional(),
    assigneeId: z.string().nullable().optional(),
    labels: z.array(z.string()).optional(),
    sprintId: z.string().nullable().optional(),
    epicId: z.string().nullable().optional(),
    parentId: z.string().nullable().optional(),
    estimate: z.number().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    customFields: z.record(z.unknown()).optional(),
    resolution: IssueResolutionSchema.nullable().optional().openapi({
      description:
        'Jira-style resolution. Setting a value stamps `resolvedAt`; an explicit `null` clears both fields.',
    }),
  })
  .openapi('UpdateIssueBody');

export const IssueIdParamSchema = z
  .object({ issueId: z.string().openapi({ param: { name: 'issueId', in: 'path' } }) })
  .openapi('IssueIdParam');

export const DeleteIssueResponseSchema = z
  .object({ success: z.boolean(), id: z.string() })
  .openapi('DeleteIssueResponse');

// ---- Comments ---------------------------------------------------------------

export const CommentSchema = z
  .object({
    id: z.string(),
    issueId: z.string(),
    content: z.string(),
    parentId: z.string().nullable(),
    mentions: z.array(z.string()),
    reactions: z.array(z.unknown()),
    isInternal: z.string().openapi({ description: '"true" | "false" (stored as string)' }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    createdBy: z.string().nullable(),
    updatedBy: z.string().nullable(),
  })
  .openapi('Comment');

export const CreateCommentBodySchema = z
  .object({
    content: z.string().min(1),
    parentId: z.string().optional(),
    mentions: z.array(z.string()).default([]),
    isInternal: z.boolean().default(false),
  })
  .openapi('CreateCommentBody');

// ---- Projects ---------------------------------------------------------------

export const ProjectSchema = z
  .object({
    id: z.string(),
    organizationId: z.string(),
    teamId: z.string().nullable(),
    key: z.string().openapi({ example: 'PROJ' }),
    name: z.string(),
    description: z.string().nullable(),
    status: z.string(),
    settings: z.record(z.unknown()).default({}),
    defaultWorkflowId: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    organizationName: z.string().optional(),
    team: z.object({ id: z.string(), name: z.string(), slug: z.string() }).nullable().optional(),
  })
  .openapi('Project');

export const ProjectListQuerySchema = z
  .object({
    organizationId: z.string().optional(),
    teamId: z.string().optional(),
  })
  .openapi('ProjectListQuery');

// ---- Labels -----------------------------------------------------------------

export const LabelSchema = z
  .object({
    id: z.string(),
    organizationId: z.string(),
    projectId: z.string().nullable().openapi({ description: '`null` = org-wide label' }),
    name: z.string(),
    color: z.string().openapi({ example: '#6B7280' }),
    description: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    createdBy: z.string().nullable(),
  })
  .openapi('Label');

export const LabelWithUsageSchema = LabelSchema.extend({
  usageCount: z
    .number()
    .int()
    .openapi({ description: 'Number of issues currently tagged with this label.' }),
}).openapi('LabelWithUsage');

export const LabelListQuerySchema = z
  .object({
    organizationId: z.string(),
    projectId: z.string().optional().openapi({
      description:
        "When given, returns that project's labels plus org-wide labels (`projectId = null`).",
    }),
    q: z.string().optional().openapi({ description: 'Case-insensitive name prefix filter.' }),
  })
  .openapi('LabelListQuery');

export const LabelListResponseSchema = z
  .object({ labels: z.array(LabelWithUsageSchema) })
  .openapi('LabelListResponse');

export const CreateLabelBodySchema = z
  .object({
    organizationId: z.string().min(1),
    projectId: z.string().min(1).nullable().optional().openapi({
      description: 'Optional project scope; `null`/absent = org-wide label.',
    }),
    name: z.string().trim().min(1).max(100),
    color: z
      .string()
      .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
      .optional()
      .openapi({ description: 'Hex color like `#6B7280`. Defaults to `#6B7280`.' }),
    description: z.string().max(2000).nullable().optional(),
  })
  .openapi('CreateLabelBody');

export const UpdateLabelBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional().openapi({
      description:
        'Renaming also rewrites the legacy `issues.labels` JSONB arrays org-wide in the same transaction.',
    }),
    color: z
      .string()
      .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
      .optional(),
    description: z.string().max(2000).nullable().optional(),
  })
  .openapi('UpdateLabelBody');

export const LabelIdParamSchema = z
  .object({ labelId: z.string().openapi({ param: { name: 'labelId', in: 'path' } }) })
  .openapi('LabelIdParam');

export const DeleteLabelResponseSchema = z
  .object({ success: z.boolean(), id: z.string() })
  .openapi('DeleteLabelResponse');

// ---- Versions ---------------------------------------------------------------

export const VersionStatusSchema = z
  .enum(['unreleased', 'released', 'archived'])
  .openapi('VersionStatus');

export const ProjectVersionSchema = z
  .object({
    id: z.string(),
    organizationId: z.string(),
    projectId: z.string(),
    name: z.string().openapi({ example: '1.4.0' }),
    description: z.string().nullable(),
    status: VersionStatusSchema,
    startDate: z.string().datetime().nullable(),
    releaseDate: z.string().datetime().nullable().openapi({ description: 'Planned release date.' }),
    releasedAt: z
      .string()
      .datetime()
      .nullable()
      .openapi({ description: 'Stamped when the version is released.' }),
    sortOrder: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    createdBy: z.string().nullable(),
  })
  .openapi('ProjectVersion');

export const ProjectVersionWithCountsSchema = ProjectVersionSchema.extend({
  issueCount: z.number().int(),
  doneIssueCount: z.number().int().openapi({ description: 'Issues with a non-null resolution.' }),
}).openapi('ProjectVersionWithCounts');

export const VersionListResponseSchema = z
  .object({
    versions: z.array(ProjectVersionWithCountsSchema),
    total: z.number().int(),
  })
  .openapi('VersionListResponse');

export const VersionResponseSchema = z
  .object({ version: ProjectVersionSchema })
  .openapi('VersionResponse');

export const CreateVersionBodySchema = z
  .object({
    name: z.string().min(1).max(120),
    description: z.string().max(10000).nullable().optional(),
    startDate: z.string().datetime().nullable().optional(),
    releaseDate: z.string().datetime().nullable().optional(),
  })
  .openapi('CreateVersionBody');

export const UpdateVersionBodySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(10000).nullable().optional(),
    startDate: z.string().datetime().nullable().optional(),
    releaseDate: z.string().datetime().nullable().optional(),
    status: VersionStatusSchema.optional().openapi({
      description:
        'Transitioning to `released` stamps `releasedAt` (if unset); back to `unreleased` clears it.',
    }),
    sortOrder: z.number().int().optional(),
  })
  .openapi('UpdateVersionBody');

export const ReleaseVersionBodySchema = z
  .object({
    moveOpenIssuesToVersionId: z.string().optional().openapi({
      description:
        "Optional: re-point unresolved issues' fix-version to another version of the same project.",
    }),
  })
  .openapi('ReleaseVersionBody');

export const ReleaseVersionResponseSchema = z
  .object({
    version: ProjectVersionSchema,
    movedIssueCount: z.number().int(),
  })
  .openapi('ReleaseVersionResponse');

export const ProjectIdParamSchema = z
  .object({
    projectId: z
      .string()
      .openapi({ param: { name: 'projectId', in: 'path' }, description: 'Project id or key' }),
  })
  .openapi('ProjectIdParam');

export const VersionParamsSchema = z
  .object({
    projectId: z
      .string()
      .openapi({ param: { name: 'projectId', in: 'path' }, description: 'Project id or key' }),
    versionId: z.string().openapi({ param: { name: 'versionId', in: 'path' } }),
  })
  .openapi('VersionParams');

export const SuccessResponseSchema = z.object({ success: z.boolean() }).openapi('SuccessResponse');

// ---- Components -------------------------------------------------------------

export const ComponentDefaultAssigneeTypeSchema = z
  .enum(['project_default', 'component_lead', 'unassigned'])
  .openapi('ComponentDefaultAssigneeType');

export const ComponentSchema = z
  .object({
    id: z.string(),
    organizationId: z.string(),
    projectId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    leadId: z.string().nullable(),
    defaultAssigneeType: ComponentDefaultAssigneeTypeSchema,
    archived: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('Component');

export const ComponentWithCountSchema = ComponentSchema.extend({
  issueCount: z.number().int(),
}).openapi('ComponentWithCount');

export const ComponentListResponseSchema = z
  .object({
    components: z.array(ComponentWithCountSchema),
    total: z.number().int(),
  })
  .openapi('ComponentListResponse');

export const ComponentResponseSchema = z
  .object({ component: ComponentSchema })
  .openapi('ComponentResponse');

export const CreateComponentBodySchema = z
  .object({
    name: z.string().min(1).max(120),
    description: z.string().max(10000).nullable().optional(),
    leadId: z.string().nullable().optional().openapi({
      description: 'Must be an active member of the organization.',
    }),
    defaultAssigneeType: ComponentDefaultAssigneeTypeSchema.default('project_default'),
  })
  .openapi('CreateComponentBody');

export const UpdateComponentBodySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(10000).nullable().optional(),
    leadId: z.string().nullable().optional().openapi({
      description: 'Must be an active member of the organization.',
    }),
    defaultAssigneeType: ComponentDefaultAssigneeTypeSchema.optional(),
    archived: z.boolean().optional(),
  })
  .openapi('UpdateComponentBody');

export const ComponentParamsSchema = z
  .object({
    projectId: z
      .string()
      .openapi({ param: { name: 'projectId', in: 'path' }, description: 'Project id or key' }),
    componentId: z.string().openapi({ param: { name: 'componentId', in: 'path' } }),
  })
  .openapi('ComponentParams');

// ---- Issue versions / components --------------------------------------------

export const IssueVersionsResponseSchema = z
  .object({
    fixVersions: z.array(ProjectVersionSchema),
    affectsVersions: z.array(ProjectVersionSchema),
  })
  .openapi('IssueVersionsResponse');

export const SetIssueVersionsBodySchema = z
  .object({
    fixVersionIds: z.array(z.string()).optional(),
    affectsVersionIds: z.array(z.string()).optional(),
  })
  .openapi('SetIssueVersionsBody', {
    description:
      'Replaces the respective association set(s). At least one of `fixVersionIds` or `affectsVersionIds` must be provided. ' +
      "Every referenced version must belong to the issue's project.",
  });

export const IssueComponentsResponseSchema = z
  .object({ components: z.array(ComponentSchema) })
  .openapi('IssueComponentsResponse');

export const SetIssueComponentsBodySchema = z
  .object({
    componentIds: z.array(z.string()).openapi({
      description:
        "Replaces the issue's component set. Every component must belong to the issue's project.",
    }),
  })
  .openapi('SetIssueComponentsBody');

// ---- Users ------------------------------------------------------------------

export const CurrentUserSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    image: z.string().nullable(),
    isSuperAdmin: z.boolean(),
    status: z.string().nullable(),
  })
  .openapi('CurrentUser');

// ---- Search -----------------------------------------------------------------

export const SearchResultIssueSchema = z
  .object({
    id: z.string(),
    key: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.string().nullable(),
    priority: z.string().nullable(),
    type: z.string().nullable(),
    labels: z.array(z.string()).nullable(),
    assigneeId: z.string().nullable(),
    reporterId: z.string().nullable(),
    projectId: z.string(),
    sprintId: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('SearchResultIssue');

export const SearchBodySchema = z
  .object({
    q: z.string().min(1).openapi({
      description: 'JQL-style query string',
      example: 'assignee = me AND status = "In Progress"',
    }),
    organizationId: z.string(),
    projectId: z.string().optional(),
    saveHistory: z.boolean().default(true).optional(),
    limit: z.number().int().min(1).max(500).default(100).optional(),
    offset: z.number().int().min(0).default(0).optional(),
  })
  .openapi('SearchBody');

export const SearchResponseSchema = z
  .object({
    results: z.array(SearchResultIssueSchema),
    count: z.number().int(),
    query: z.string(),
    criteria: z.record(z.unknown()),
  })
  .openapi('SearchResponse');

// ---- Health -----------------------------------------------------------------

export const HealthResponseSchema = z
  .object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    timestamp: z.string().datetime(),
    uptime: z.number(),
    checks: z.object({
      database: z.string(),
      memory: z.string(),
      redis: z.string(),
      livekit: z.string(),
      smtp: z.string(),
    }),
    details: z.record(z.string()).optional(),
    version: z.string().optional(),
  })
  .openapi('HealthResponse');

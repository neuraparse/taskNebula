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
    details: z.unknown().optional(),
  })
  .openapi('ErrorResponse');

export const IssueTypeSchema = z
  .enum(['story', 'task', 'bug', 'epic'])
  .openapi('IssueType');

export const IssuePrioritySchema = z
  .enum(['critical', 'high', 'medium', 'low', 'none'])
  .openapi('IssuePriority');

export const IssueStatusCategorySchema = z
  .enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'])
  .openapi('IssueStatusCategory');

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

// ---- Transitions ------------------------------------------------------------

export const TransitionIssueBodySchema = z
  .object({
    statusId: z
      .string()
      .openapi({ description: 'Target workflow status id (UUID/cuid)' }),
    comment: z.string().optional().openapi({
      description: 'Optional comment to attach to the transition',
    }),
  })
  .openapi('TransitionIssueBody');

export const TransitionResponseSchema = z
  .object({
    issue: IssueSchema,
    transitionedAt: z.string().datetime(),
  })
  .openapi('TransitionResponse');

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
    team: z
      .object({ id: z.string(), name: z.string(), slug: z.string() })
      .nullable()
      .optional(),
  })
  .openapi('Project');

export const ProjectListQuerySchema = z
  .object({
    organizationId: z.string().optional(),
    teamId: z.string().optional(),
  })
  .openapi('ProjectListQuery');

// ---- Cycles / Sprints -------------------------------------------------------

export const CycleSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    goal: z.string().nullable(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    status: z.string().openapi({ example: 'planned' }),
    issueCount: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('Cycle');

export const CycleListQuerySchema = z
  .object({
    projectId: z.string().openapi({ description: 'Project id or key' }),
  })
  .openapi('CycleListQuery');

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

/**
 * Plan Limits Checker
 * Server-side functions to check if organization has reached limits
 */

import { db, organizations, organizationMembers, projects, issues, sprints, customFields, webhooks, teams } from '@tasknebula/db';
import { eq, and, count } from 'drizzle-orm';
import { PLAN_LIMITS, type OrganizationPlan } from './plan-limits';

/**
 * Get organization's plan limits
 */
export async function getOrganizationLimits(organizationId: string) {
  const [org] = await db
    .select({ plan: organizations.plan })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    throw new Error('Organization not found');
  }

  return PLAN_LIMITS[org.plan as OrganizationPlan];
}

/**
 * Get organization's current usage
 */
export async function getOrganizationUsage(organizationId: string) {
  // Count members
  const [memberCount] = await db
    .select({ count: count() })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId));

  // Count projects
  const [projectCount] = await db
    .select({ count: count() })
    .from(projects)
    .where(eq(projects.organizationId, organizationId));

  // Count issues
  const [issueCount] = await db
    .select({ count: count() })
    .from(issues)
    .where(eq(issues.organizationId, organizationId));

  // Count custom fields
  const [customFieldCount] = await db
    .select({ count: count() })
    .from(customFields)
    .where(eq(customFields.organizationId, organizationId));

  // Count webhooks
  const [webhookCount] = await db
    .select({ count: count() })
    .from(webhooks)
    .where(eq(webhooks.organizationId, organizationId));

  // Count teams
  const [teamCount] = await db
    .select({ count: count() })
    .from(teams)
    .where(eq(teams.organizationId, organizationId));

  return {
    members: memberCount?.count || 0,
    projects: projectCount?.count || 0,
    issues: issueCount?.count || 0,
    customFields: customFieldCount?.count || 0,
    webhooks: webhookCount?.count || 0,
    teams: teamCount?.count || 0,
  };
}

/**
 * Check if organization can add more members
 */
export async function canAddMember(organizationId: string): Promise<{ allowed: boolean; reason?: string; current: number; limit: number }> {
  const limits = await getOrganizationLimits(organizationId);
  const usage = await getOrganizationUsage(organizationId);

  // -1 means unlimited
  if (limits.maxMembers === -1) {
    return { allowed: true, current: usage.members, limit: -1 };
  }

  const allowed = usage.members < limits.maxMembers;
  return {
    allowed,
    reason: allowed ? undefined : `Member limit reached. Your plan allows ${limits.maxMembers} members.`,
    current: usage.members,
    limit: limits.maxMembers,
  };
}

/**
 * Check if organization can create more projects
 */
export async function canCreateProject(organizationId: string): Promise<{ allowed: boolean; reason?: string; current: number; limit: number }> {
  const limits = await getOrganizationLimits(organizationId);
  const usage = await getOrganizationUsage(organizationId);

  if (limits.maxProjects === -1) {
    return { allowed: true, current: usage.projects, limit: -1 };
  }

  const allowed = usage.projects < limits.maxProjects;
  return {
    allowed,
    reason: allowed ? undefined : `Project limit reached. Your plan allows ${limits.maxProjects} projects.`,
    current: usage.projects,
    limit: limits.maxProjects,
  };
}

/**
 * Check if organization can create more issues in a project
 */
export async function canCreateIssue(projectId: string): Promise<{ allowed: boolean; reason?: string; current: number; limit: number }> {
  // Get project's organization
  const [project] = await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new Error('Project not found');
  }

  const limits = await getOrganizationLimits(project.organizationId);

  if (limits.maxIssuesPerProject === -1) {
    return { allowed: true, current: 0, limit: -1 };
  }

  // Count issues in this project
  const [issueCount] = await db
    .select({ count: count() })
    .from(issues)
    .where(eq(issues.projectId, projectId));

  const current = issueCount?.count || 0;
  const allowed = current < limits.maxIssuesPerProject;

  return {
    allowed,
    reason: allowed ? undefined : `Issue limit reached for this project. Your plan allows ${limits.maxIssuesPerProject} issues per project.`,
    current,
    limit: limits.maxIssuesPerProject,
  };
}

/**
 * Check if organization can create more custom fields
 */
export async function canCreateCustomField(organizationId: string): Promise<{ allowed: boolean; reason?: string; current: number; limit: number }> {
  const limits = await getOrganizationLimits(organizationId);
  const usage = await getOrganizationUsage(organizationId);

  if (limits.maxCustomFields === -1) {
    return { allowed: true, current: usage.customFields, limit: -1 };
  }

  const allowed = usage.customFields < limits.maxCustomFields;
  return {
    allowed,
    reason: allowed ? undefined : `Custom field limit reached. Your plan allows ${limits.maxCustomFields} custom fields.`,
    current: usage.customFields,
    limit: limits.maxCustomFields,
  };
}

/**
 * Check if organization can create more webhooks
 */
export async function canCreateWebhook(organizationId: string): Promise<{ allowed: boolean; reason?: string; current: number; limit: number }> {
  const limits = await getOrganizationLimits(organizationId);
  const usage = await getOrganizationUsage(organizationId);

  if (limits.maxWebhooks === -1) {
    return { allowed: true, current: usage.webhooks, limit: -1 };
  }

  const allowed = usage.webhooks < limits.maxWebhooks;
  return {
    allowed,
    reason: allowed ? undefined : `Webhook limit reached. Your plan allows ${limits.maxWebhooks} webhooks.`,
    current: usage.webhooks,
    limit: limits.maxWebhooks,
  };
}

/**
 * Check if organization can create more teams
 */
export async function canCreateTeam(organizationId: string): Promise<{ allowed: boolean; reason?: string; current: number; limit: number }> {
  const limits = await getOrganizationLimits(organizationId);
  const usage = await getOrganizationUsage(organizationId);

  if (limits.maxTeams === -1) {
    return { allowed: true, current: usage.teams, limit: -1 };
  }

  const allowed = usage.teams < limits.maxTeams;
  return {
    allowed,
    reason: allowed ? undefined : `Team limit reached. Your plan allows ${limits.maxTeams} teams.`,
    current: usage.teams,
    limit: limits.maxTeams,
  };
}

/**
 * Check if file size is within limits
 */
export async function canUploadFile(organizationId: string, fileSize: number): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getOrganizationLimits(organizationId);

  if (limits.maxStoragePerFile === -1) {
    return { allowed: true };
  }

  const allowed = fileSize <= limits.maxStoragePerFile;
  const maxSizeMB = Math.round(limits.maxStoragePerFile / (1024 * 1024));

  return {
    allowed,
    reason: allowed ? undefined : `File size exceeds limit. Your plan allows files up to ${maxSizeMB} MB.`,
  };
}

/**
 * Check if organization has access to a feature
 */
export async function hasFeatureAccess(organizationId: string, feature: keyof typeof PLAN_LIMITS.free.features): Promise<boolean> {
  const limits = await getOrganizationLimits(organizationId);
  return limits.features[feature];
}

/**
 * Get organization limits and usage summary
 */
export async function getOrganizationLimitsAndUsage(organizationId: string) {
  const limits = await getOrganizationLimits(organizationId);
  const usage = await getOrganizationUsage(organizationId);

  return {
    limits,
    usage,
    percentages: {
      members: limits.maxMembers === -1 ? 0 : Math.round((usage.members / limits.maxMembers) * 100),
      projects: limits.maxProjects === -1 ? 0 : Math.round((usage.projects / limits.maxProjects) * 100),
      customFields: limits.maxCustomFields === -1 ? 0 : Math.round((usage.customFields / limits.maxCustomFields) * 100),
      webhooks: limits.maxWebhooks === -1 ? 0 : Math.round((usage.webhooks / limits.maxWebhooks) * 100),
      teams: limits.maxTeams === -1 ? 0 : Math.round((usage.teams / limits.maxTeams) * 100),
    },
  };
}


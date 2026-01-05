import { eq, and, desc } from 'drizzle-orm';
import { db } from '../client';
import { projects, workflows, workflowStatuses, sprints } from '../schema';

// Get all projects for an organization
export async function getProjects(organizationId: string) {
  return await db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, organizationId))
    .orderBy(desc(projects.createdAt));
}

// Get single project by ID
export async function getProjectById(projectId: string) {
  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  return result[0] || null;
}

// Get project with workflow
export async function getProjectWithWorkflow(projectId: string) {
  const project = await getProjectById(projectId);
  if (!project || !project.defaultWorkflowId) return null;

  const workflow = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, project.defaultWorkflowId))
    .limit(1);

  const statuses = await db
    .select()
    .from(workflowStatuses)
    .where(eq(workflowStatuses.workflowId, project.defaultWorkflowId))
    .orderBy(workflowStatuses.position);

  return {
    ...project,
    workflow: workflow[0],
    statuses,
  };
}

// Get active sprint for project
export async function getActiveSprint(projectId: string) {
  const result = await db
    .select()
    .from(sprints)
    .where(and(eq(sprints.projectId, projectId), eq(sprints.status, 'active')))
    .limit(1);

  return result[0] || null;
}

// Create project
export async function createProject(data: typeof projects.$inferInsert) {
  const result = await db.insert(projects).values(data).returning();
  return result[0];
}

// Update project
export async function updateProject(projectId: string, data: Partial<typeof projects.$inferInsert>) {
  const result = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();

  return result[0];
}


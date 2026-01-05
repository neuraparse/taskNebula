/**
 * Production Database Seeder
 * 
 * Seeds initial data for production environment.
 * Only creates essential data (no demo data).
 * 
 * Usage: pnpm tsx scripts/seed-production.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { resolve } from 'path';
import { createId } from '@paralleldrive/cuid2';
import * as schema from '../src/schema';

// Load environment variables only in development
try {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dotenv = require('dotenv');
    dotenv.config({ path: resolve(__dirname, '../../../.env') });
  }
} catch (error) {
  // Dotenv not available in production, use environment variables directly
}

async function seedProduction() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }

  console.log('🌱 Starting production database seeding...');
  console.log(`📍 Database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);

  const client = postgres(databaseUrl);
  const db = drizzle(client, { schema });

  try {
    // Check if data already exists
    const existingOrgs = await db.query.organizations.findMany({ limit: 1 });
    
    if (existingOrgs.length > 0) {
      console.log('⚠️  Database already contains data. Skipping seed.');
      return;
    }

    // Create demo admin user first
    console.log('👤 Creating demo admin user...');
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('demo123', 10);

    const adminUserId = createId();
    await db.insert(schema.users).values({
      id: adminUserId,
      email: 'admin@tasknebula.io',
      name: 'Admin User',
      image: 'https://avatar.vercel.sh/admin',
      password: passwordHash,
      settings: {},
      status: 'active',
      isSuperAdmin: true,
    });

    // Create demo organization
    console.log('🏢 Creating demo organization...');
    const demoOrgId = createId();
    await db.insert(schema.organizations).values({
      id: demoOrgId,
      name: 'TaskNebula Demo',
      slug: 'tasknebula-demo',
      domain: 'tasknebula.io',
      settings: {},
      plan: 'growth',
      status: 'active',
      createdBy: adminUserId,
    });

    // Add admin user to organization
    console.log('🔗 Adding admin to organization...');
    await db.insert(schema.organizationMembers).values({
      id: createId(),
      organizationId: demoOrgId,
      userId: adminUserId,
      role: 'owner',
      status: 'active',
    });

    console.log('📝 Creating default workflow statuses...');

    // Create default workflow
    const defaultWorkflowId = createId();
    await db.insert(schema.workflows).values({
      id: defaultWorkflowId,
      organizationId: demoOrgId,
      name: 'Default Workflow',
      description: 'Default workflow for all projects',
      isDefault: true,
      isActive: true,
      createdBy: adminUserId,
      updatedBy: adminUserId,
    });

    // Create default statuses
    const statusIds = {
      todo: createId(),
      inProgress: createId(),
      inReview: createId(),
      done: createId(),
    };

    await db.insert(schema.workflowStatuses).values([
      {
        id: statusIds.todo,
        workflowId: defaultWorkflowId,
        name: 'To Do',
        category: 'backlog',
        color: '#94a3b8',
        position: 0,
      },
      {
        id: statusIds.inProgress,
        workflowId: defaultWorkflowId,
        name: 'In Progress',
        category: 'in_progress',
        color: '#3b82f6',
        position: 1,
      },
      {
        id: statusIds.inReview,
        workflowId: defaultWorkflowId,
        name: 'In Review',
        category: 'in_progress',
        color: '#f59e0b',
        position: 2,
      },
      {
        id: statusIds.done,
        workflowId: defaultWorkflowId,
        name: 'Done',
        category: 'done',
        color: '#10b981',
        position: 3,
      },
    ]);

    // Create default transitions
    await db.insert(schema.workflowTransitions).values([
      {
        id: createId(),
        workflowId: defaultWorkflowId,
        name: 'Start Progress',
        fromStatusId: statusIds.todo,
        toStatusId: statusIds.inProgress,
      },
      {
        id: createId(),
        workflowId: defaultWorkflowId,
        name: 'Submit for Review',
        fromStatusId: statusIds.inProgress,
        toStatusId: statusIds.inReview,
      },
      {
        id: createId(),
        workflowId: defaultWorkflowId,
        name: 'Complete',
        fromStatusId: statusIds.inReview,
        toStatusId: statusIds.done,
      },
      {
        id: createId(),
        workflowId: defaultWorkflowId,
        name: 'Reopen',
        fromStatusId: statusIds.done,
        toStatusId: statusIds.todo,
      },
    ]);

    // Create demo users
    console.log('👥 Creating demo users...');
    const demoUsers = [];
    const userRoles = [
      { email: 'po@tasknebula.io', name: 'Product Owner', role: 'Product Owner' },
      { email: 'sm@tasknebula.io', name: 'Scrum Master', role: 'Scrum Master' },
      { email: 'lead@tasknebula.io', name: 'Tech Lead', role: 'Tech Lead' },
      { email: 'dev1@tasknebula.io', name: 'Developer', role: 'Developer' },
      { email: 'qa@tasknebula.io', name: 'QA Engineer', role: 'QA Engineer' },
      { email: 'design@tasknebula.io', name: 'Designer', role: 'Designer' },
      { email: 'viewer@tasknebula.io', name: 'Viewer', role: 'Viewer' },
    ];

    for (const user of userRoles) {
      const userId = createId();
      await db.insert(schema.users).values({
        id: userId,
        email: user.email,
        name: user.name,
        image: `https://avatar.vercel.sh/${user.email}`,
        password: passwordHash,
        settings: {},
        status: 'active',
        isSuperAdmin: false,
      });

      // Add to organization
      await db.insert(schema.organizationMembers).values({
        id: createId(),
        organizationId: demoOrgId,
        userId: userId,
        role: 'member',
        status: 'active',
      });

      demoUsers.push({ userId, ...user });
    }

    // Create demo projects
    console.log('📦 Creating demo projects...');
    const projects = [
      {
        key: 'WEB',
        name: 'Website Redesign',
        description: 'Complete redesign of our company website with modern UI/UX',
        leadId: demoUsers[0].userId,
      },
      {
        key: 'MOB',
        name: 'Mobile App',
        description: 'Native mobile application for iOS and Android',
        leadId: demoUsers[1].userId,
      },
      {
        key: 'API',
        name: 'API Platform',
        description: 'RESTful API platform for third-party integrations',
        leadId: demoUsers[1].userId,
      },
    ];

    const projectIds = [];
    for (const project of projects) {
      const projectId = createId();
      await db.insert(schema.projects).values({
        id: projectId,
        organizationId: demoOrgId,
        key: project.key,
        name: project.name,
        description: project.description,
        leadId: project.leadId,
        defaultWorkflowId: defaultWorkflowId,
        visibility: 'internal',
        status: 'active',
        settings: {},
        createdBy: adminUserId,
        updatedBy: adminUserId,
      });

      // Add project members
      const members = [
        { userId: adminUserId, role: 'product_owner' },
        { userId: demoUsers[0].userId, role: 'product_owner' },
        { userId: demoUsers[1].userId, role: 'tech_lead' },
        { userId: demoUsers[2].userId, role: 'designer' },
        { userId: demoUsers[3].userId, role: 'qa_engineer' },
        { userId: demoUsers[4].userId, role: 'developer' },
      ];

      for (const member of members) {
        await db.insert(schema.projectMembers).values({
          id: createId(),
          projectId: projectId,
          userId: member.userId,
          role: member.role,
          canManageSprints: member.role === 'product_owner' || member.role === 'tech_lead' ? 'true' : 'false',
          canStartSprint: member.role === 'product_owner' || member.role === 'tech_lead' ? 'true' : 'false',
          canAssignIssues: member.role === 'product_owner' || member.role === 'tech_lead' ? 'true' : 'false',
        });
      }

      projectIds.push({ projectId, key: project.key });
    }

    // Create demo issues
    console.log('📝 Creating demo issues...');
    const issueTemplates = [
      // Website Redesign issues
      { projectIdx: 0, type: 'epic', title: 'Homepage Redesign', description: 'Redesign the entire homepage with new branding', priority: 'high', statusKey: 'inProgress', assigneeIdx: 2 },
      { projectIdx: 0, type: 'story', title: 'Design new hero section', description: 'Create mockups for hero section with CTA', priority: 'high', statusKey: 'done', assigneeIdx: 2 },
      { projectIdx: 0, type: 'task', title: 'Implement responsive navigation', description: 'Build mobile-first navigation component', priority: 'medium', statusKey: 'inProgress', assigneeIdx: 4 },
      { projectIdx: 0, type: 'bug', title: 'Fix footer alignment on mobile', description: 'Footer is not aligned properly on small screens', priority: 'high', statusKey: 'todo', assigneeIdx: 4 },
      { projectIdx: 0, type: 'task', title: 'Add dark mode support', description: 'Implement dark mode toggle and theme switching', priority: 'low', statusKey: 'todo', assigneeIdx: 1 },

      // Mobile App issues
      { projectIdx: 1, type: 'epic', title: 'User Authentication', description: 'Complete authentication flow for mobile app', priority: 'critical', statusKey: 'inProgress', assigneeIdx: 1 },
      { projectIdx: 1, type: 'story', title: 'Social login integration', description: 'Add Google and Apple sign-in', priority: 'high', statusKey: 'inReview', assigneeIdx: 1 },
      { projectIdx: 1, type: 'task', title: 'Design onboarding screens', description: 'Create welcome and tutorial screens', priority: 'medium', statusKey: 'done', assigneeIdx: 2 },
      { projectIdx: 1, type: 'bug', title: 'App crashes on iOS 16', description: 'App crashes when opening camera on iOS 16', priority: 'critical', statusKey: 'inProgress', assigneeIdx: 1 },
      { projectIdx: 1, type: 'task', title: 'Setup push notifications', description: 'Integrate Firebase Cloud Messaging', priority: 'high', statusKey: 'todo', assigneeIdx: 4 },

      // API Platform issues
      { projectIdx: 2, type: 'epic', title: 'REST API v2', description: 'Build new version of REST API with better performance', priority: 'high', statusKey: 'inProgress', assigneeIdx: 1 },
      { projectIdx: 2, type: 'story', title: 'Rate limiting implementation', description: 'Add rate limiting to all API endpoints', priority: 'high', statusKey: 'inReview', assigneeIdx: 1 },
      { projectIdx: 2, type: 'task', title: 'Write API documentation', description: 'Complete OpenAPI/Swagger documentation', priority: 'medium', statusKey: 'todo', assigneeIdx: 0 },
      { projectIdx: 2, type: 'bug', title: 'Authentication token expires too soon', description: 'JWT tokens expire after 5 minutes instead of 1 hour', priority: 'high', statusKey: 'inProgress', assigneeIdx: 1 },
      { projectIdx: 2, type: 'task', title: 'Add GraphQL endpoint', description: 'Create GraphQL API alongside REST', priority: 'low', statusKey: 'todo', assigneeIdx: 1 },
    ];

    let issueCounter = { WEB: 1, MOB: 1, API: 1 };
    for (const template of issueTemplates) {
      const project = projectIds[template.projectIdx];
      const assignee = template.assigneeIdx !== undefined ? demoUsers[template.assigneeIdx].userId : null;

      await db.insert(schema.issues).values({
        id: createId(),
        organizationId: demoOrgId,
        projectId: project.projectId,
        key: `${project.key}-${issueCounter[project.key]}`,
        number: issueCounter[project.key]++,
        type: template.type,
        title: template.title,
        description: template.description,
        statusId: statusIds[template.statusKey],
        priority: template.priority,
        assigneeId: assignee,
        reporterId: adminUserId,
        labels: [],
        customFields: {},
        metadata: {},
        createdBy: adminUserId,
        updatedBy: adminUserId,
      });
    }

    console.log('✅ Production seeding completed successfully!');
    console.log('📊 Created:');
    console.log('  - 1 demo organization');
    console.log('  - 8 demo users (all password: demo123):');
    console.log('    • admin@tasknebula.io (Admin)');
    console.log('    • po@tasknebula.io (Product Owner)');
    console.log('    • sm@tasknebula.io (Scrum Master)');
    console.log('    • lead@tasknebula.io (Tech Lead)');
    console.log('    • dev1@tasknebula.io (Developer)');
    console.log('    • qa@tasknebula.io (QA Engineer)');
    console.log('    • design@tasknebula.io (Designer)');
    console.log('    • viewer@tasknebula.io (Viewer)');
    console.log('  - 3 demo projects (WEB, MOB, API)');
    console.log('  - 15 demo issues (stories, tasks, bugs, epics)');
    console.log('  - 1 default workflow');
    console.log('  - 4 workflow statuses');
    console.log('  - 4 workflow transitions');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run seeding
seedProduction().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});


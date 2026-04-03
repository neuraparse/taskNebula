import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createId } from '@paralleldrive/cuid2';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import bcrypt from 'bcryptjs';
import * as schema from './schema';
import { ROLE_DEFAULT_PERMISSIONS, type ProjectRole } from './utils/permissions';
import { getDatabaseConnectionString } from './utils/connection-string';

// Load environment variables from root .env file
dotenv.config({ path: resolve(__dirname, '../../../.env') });

// ============================================
// DEMO USERS - All roles represented
// Password for all users: demo123
// ============================================
const DEMO_PASSWORD = 'demo123';

interface DemoUser {
  id: string;
  email: string;
  name: string;
  image: string;
  password: string;
  settings: object;
  status: 'active' | 'inactive' | 'invited';
  isSuperAdmin?: boolean;
  orgRole: 'owner' | 'admin' | 'member' | 'viewer';
  projectRole: 'product_owner' | 'scrum_master' | 'tech_lead' | 'developer' | 'qa_engineer' | 'designer' | 'viewer';
}

const createDemoUsers = (): DemoUser[] => [
  // Super Admin / Owner
  {
    id: createId(),
    email: 'admin@tasknebula.io',
    name: 'Admin User',
    image: 'https://avatar.vercel.sh/admin',
    password: '',
    settings: {},
    status: 'active',
    isSuperAdmin: true,
    orgRole: 'owner',
    projectRole: 'product_owner',
  },
  // Product Owner
  {
    id: createId(),
    email: 'po@tasknebula.io',
    name: 'Emma Wilson',
    image: 'https://avatar.vercel.sh/emma',
    password: '',
    settings: {},
    status: 'active',
    orgRole: 'admin',
    projectRole: 'product_owner',
  },
  // Scrum Master
  {
    id: createId(),
    email: 'sm@tasknebula.io',
    name: 'Michael Brown',
    image: 'https://avatar.vercel.sh/michael',
    password: '',
    settings: {},
    status: 'active',
    orgRole: 'admin',
    projectRole: 'scrum_master',
  },
  // Tech Lead
  {
    id: createId(),
    email: 'lead@tasknebula.io',
    name: 'David Kim',
    image: 'https://avatar.vercel.sh/david',
    password: '',
    settings: {},
    status: 'active',
    orgRole: 'member',
    projectRole: 'tech_lead',
  },
  // Developer 1
  {
    id: createId(),
    email: 'dev1@tasknebula.io',
    name: 'Sarah Chen',
    image: 'https://avatar.vercel.sh/sarah',
    password: '',
    settings: {},
    status: 'active',
    orgRole: 'member',
    projectRole: 'developer',
  },
  // Developer 2
  {
    id: createId(),
    email: 'dev2@tasknebula.io',
    name: 'Alex Johnson',
    image: 'https://avatar.vercel.sh/alex',
    password: '',
    settings: {},
    status: 'active',
    orgRole: 'member',
    projectRole: 'developer',
  },
  // QA Engineer
  {
    id: createId(),
    email: 'qa@tasknebula.io',
    name: 'Lisa Park',
    image: 'https://avatar.vercel.sh/lisa',
    password: '',
    settings: {},
    status: 'active',
    orgRole: 'member',
    projectRole: 'qa_engineer',
  },
  // Designer
  {
    id: createId(),
    email: 'design@tasknebula.io',
    name: 'James Miller',
    image: 'https://avatar.vercel.sh/james',
    password: '',
    settings: {},
    status: 'active',
    orgRole: 'member',
    projectRole: 'designer',
  },
  // Viewer / Stakeholder
  {
    id: createId(),
    email: 'viewer@tasknebula.io',
    name: 'Robert Taylor',
    image: 'https://avatar.vercel.sh/robert',
    password: '',
    settings: {},
    status: 'active',
    orgRole: 'viewer',
    projectRole: 'viewer',
  },
];

// Seed data containers
const seedData = {
  organizations: [] as any[],
  users: [] as DemoUser[],
  teams: [] as any[],
  projects: [] as any[],
  projectMembers: [] as any[],
  workflows: [] as any[],
  workflowStatuses: [] as any[],
  sprints: [] as any[],
  issues: [] as any[],
  documentSpaces: [] as any[],
  documentPages: [] as any[],
  documentPageRevisions: [] as any[],
  issueDocumentLinks: [] as any[],
};

async function seed() {
  const connectionString = getDatabaseConnectionString();
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  console.log('🌱 Seeding database with demo users...');
  console.log('📧 All users password: demo123\n');

  try {
    // Clean up existing seed data first (ignore errors for non-existent tables)
    console.log('🧹 Cleaning up existing data...');
    try { await db.delete(schema.issueDocumentLinks); } catch (e) { /* ignore */ }
    try { await db.delete(schema.documentPageLinks); } catch (e) { /* ignore */ }
    try { await db.delete(schema.documentPageRevisions); } catch (e) { /* ignore */ }
    try { await db.delete(schema.documentPageAttachments); } catch (e) { /* ignore */ }
    try { await db.delete(schema.documentPages); } catch (e) { /* ignore */ }
    try { await db.delete(schema.documentSpaces); } catch (e) { /* ignore */ }
    try { await db.delete(schema.issues); } catch (e) { /* ignore */ }
    try { await db.delete(schema.sprints); } catch (e) { /* ignore */ }
    try { await db.delete(schema.workflowStatuses); } catch (e) { /* ignore */ }
    try { await db.delete(schema.workflows); } catch (e) { /* ignore */ }
    try { await db.delete(schema.projectMembers); } catch (e) { /* ignore */ }
    try { await db.delete(schema.projects); } catch (e) { /* ignore */ }
    try { await db.delete(schema.organizationMembers); } catch (e) { /* ignore */ }
    try { await db.delete(schema.sessions); } catch (e) { /* ignore */ }
    try { await db.delete(schema.accounts); } catch (e) { /* ignore */ }
    try { await db.delete(schema.users); } catch (e) { /* ignore */ }
    try { await db.delete(schema.organizations); } catch (e) { /* ignore */ }
    console.log('✅ Cleanup complete\n');

    // Hash password for all users
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    // Create demo users
    seedData.users = createDemoUsers();
    seedData.users.forEach(user => {
      user.password = passwordHash;
    });

    // Create organization
    const org = {
      id: createId(),
      name: 'TaskNebula Demo',
      slug: 'tasknebula-demo',
      domain: 'tasknebula.io',
      settings: {},
      plan: 'growth' as const,
      status: 'active' as const,
    };
    seedData.organizations.push(org);

    console.log('Creating organization...');
    await db.insert(schema.organizations).values(seedData.organizations);

    // Insert users
    console.log('Creating users...');
    const usersToInsert = seedData.users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      image: u.image,
      password: u.password,
      settings: u.settings,
      status: u.status,
      isSuperAdmin: u.isSuperAdmin || false,
    }));
    await db.insert(schema.users).values(usersToInsert);

    // Add users to organization
    console.log('Creating organization members...');
    const orgMembers = seedData.users.map(u => ({
      id: createId(),
      organizationId: org.id,
      userId: u.id,
      role: u.orgRole,
    }));
    await db.insert(schema.organizationMembers).values(orgMembers);

    // Create teams
    const adminUser = seedData.users.find(u => u.isSuperAdmin)!;
    const scrumMaster = seedData.users.find(u => u.projectRole === 'scrum_master')!;

    const teams = [
      {
        id: createId(),
        organizationId: org.id,
        name: 'Product Team',
        slug: 'product',
        description: 'Product development team',
        leadId: scrumMaster.id,
        settings: {},
      },
      {
        id: createId(),
        organizationId: org.id,
        name: 'Design Team',
        slug: 'design',
        description: 'UI/UX design team',
        settings: {},
      },
    ];
    const productTeam = teams[0]!;
    const designTeam = teams[1]!;
    seedData.teams = teams;
    await db.insert(schema.teams).values(teams);

    // Add users to teams
    const developers = seedData.users.filter(u =>
      ['developer', 'tech_lead', 'qa_engineer'].includes(u.projectRole)
    );
    const designers = seedData.users.filter(u => u.projectRole === 'designer');

    const teamMembers = [
      // Product team members
      ...developers.map(u => ({
        id: createId(),
        teamId: productTeam.id,
        userId: u.id,
        role: u.projectRole === 'tech_lead' ? 'lead' as const : 'member' as const,
      })),
      { id: createId(), teamId: productTeam.id, userId: scrumMaster.id, role: 'lead' as const },
      // Design team members
      ...designers.map(u => ({
        id: createId(),
        teamId: designTeam.id,
        userId: u.id,
        role: 'member' as const,
      })),
    ];
    await db.insert(schema.teamMembers).values(teamMembers);

    // Create projects
    console.log('Creating projects...');
    const productOwner = seedData.users.find(u => u.projectRole === 'product_owner' && !u.isSuperAdmin)!;
    const techLead = seedData.users.find(u => u.projectRole === 'tech_lead')!;

    const projects = [
      {
        id: createId(),
        organizationId: org.id,
        teamId: productTeam.id,
        key: 'DEMO',
        name: 'Demo Project',
        description: 'Main demo project showcasing TaskNebula features',
        leadId: techLead.id,
        status: 'active' as const,
        settings: {},
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
      },
      {
        id: createId(),
        organizationId: org.id,
        teamId: productTeam.id,
        key: 'MOBILE',
        name: 'Mobile App',
        description: 'React Native mobile application',
        leadId: techLead.id,
        status: 'active' as const,
        settings: {},
        createdBy: productOwner.id,
        updatedBy: productOwner.id,
      },
    ];
    seedData.projects = projects;
    await db.insert(schema.projects).values(projects);

    // Create project members with roles (skip if table doesn't exist)
    console.log('Creating project members...');
    try {
      const projectMembersData = [];

      for (const project of projects) {
        for (const user of seedData.users) {
          const roleDefaults = ROLE_DEFAULT_PERMISSIONS[user.projectRole as ProjectRole];
          const permissionValues: Record<string, string> = {};
          for (const [key, value] of Object.entries(roleDefaults)) {
            permissionValues[key] = value ? 'true' : 'false';
          }

          projectMembersData.push({
            id: createId(),
            projectId: project.id,
            userId: user.id,
            role: user.projectRole,
            ...permissionValues,
            invitedBy: adminUser.id,
          });
        }
      }
      seedData.projectMembers = projectMembersData;
      await db.insert(schema.projectMembers).values(projectMembersData);
      console.log('✅ Project members created');
    } catch (error) {
      console.log('⚠️  Project members table not found, skipping...');
    }

    // Create workflows for each project
    console.log('Creating workflows...');
    for (const project of projects) {
      const workflow = {
        id: createId(),
        organizationId: org.id,
        projectId: project.id,
        name: 'Scrum Workflow',
        description: 'Standard Scrum workflow',
        isDefault: true,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
      };
      seedData.workflows.push(workflow);

      const statuses = [
        { name: 'Backlog', category: 'backlog' as const, color: '#64748b', position: 0 },
        { name: 'To Do', category: 'backlog' as const, color: '#94a3b8', position: 1 },
        { name: 'In Progress', category: 'in_progress' as const, color: '#3b82f6', position: 2 },
        { name: 'Code Review', category: 'in_review' as const, color: '#8b5cf6', position: 3 },
        { name: 'QA Testing', category: 'in_review' as const, color: '#f59e0b', position: 4 },
        { name: 'Done', category: 'done' as const, color: '#22c55e', position: 5 },
      ];

      const workflowStatuses = statuses.map(status => ({
        id: createId(),
        workflowId: workflow.id,
        ...status,
      }));
      seedData.workflowStatuses.push(...workflowStatuses);
    }

    await db.insert(schema.workflows).values(seedData.workflows);
    await db.insert(schema.workflowStatuses).values(seedData.workflowStatuses);

    // Create sprints
    console.log('Creating sprints...');
    const mainProject = projects[0]!;
    const mainWorkflowStatuses = seedData.workflowStatuses.slice(0, 6);

    const sprints = [
      {
        id: createId(),
        projectId: mainProject.id,
        name: 'Sprint 1',
        goal: 'Core infrastructure and authentication',
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Started 1 week ago
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Ends in 1 week
        status: 'active' as const,
        createdBy: scrumMaster.id,
        updatedBy: scrumMaster.id,
      },
      {
        id: createId(),
        projectId: mainProject.id,
        name: 'Sprint 2',
        goal: 'User management and permissions',
        startDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000),
        status: 'planned' as const,
        createdBy: scrumMaster.id,
        updatedBy: scrumMaster.id,
      },
    ];
    seedData.sprints = sprints;
    await db.insert(schema.sprints).values(sprints);
    const activeSprint = sprints[0]!;

    // Create issues
    console.log('Creating issues...');
    const dev1 = seedData.users.find(u => u.email === 'dev1@tasknebula.io')!;
    const dev2 = seedData.users.find(u => u.email === 'dev2@tasknebula.io')!;
    const qa = seedData.users.find(u => u.projectRole === 'qa_engineer')!;
    const designer = seedData.users.find(u => u.projectRole === 'designer')!;

    const backlogStatus = mainWorkflowStatuses.find(s => s.name === 'Backlog')!;
    const todoStatus = mainWorkflowStatuses.find(s => s.name === 'To Do')!;
    const inProgressStatus = mainWorkflowStatuses.find(s => s.category === 'in_progress')!;
    const reviewStatus = mainWorkflowStatuses.find(s => s.name === 'Code Review')!;
    const qaStatus = mainWorkflowStatuses.find(s => s.name === 'QA Testing')!;
    const doneStatus = mainWorkflowStatuses.find(s => s.category === 'done')!;

    seedData.issues = [
      // Sprint 1 issues
      {
        id: createId(),
        organizationId: org.id,
        projectId: mainProject.id,
        key: 'DEMO-1',
        number: 1,
        type: 'epic',
        title: 'User Authentication & Authorization',
        description: 'Implement complete auth system with role-based access control',
        statusId: inProgressStatus.id,
        priority: 'critical',
        assigneeId: techLead.id,
        reporterId: productOwner.id,
        labels: ['epic', 'auth', 'security'],
        sprintId: activeSprint.id,
        estimate: 40,
        customFields: {},
        metadata: {},
        createdBy: productOwner.id,
        updatedBy: productOwner.id,
      },
      {
        id: createId(),
        organizationId: org.id,
        projectId: mainProject.id,
        key: 'DEMO-2',
        number: 2,
        type: 'story',
        title: 'Login with email/password',
        description: 'Users can login with their email and password',
        statusId: doneStatus.id,
        priority: 'high',
        assigneeId: dev1.id,
        reporterId: productOwner.id,
        labels: ['auth', 'frontend'],
        sprintId: activeSprint.id,
        estimate: 8,
        customFields: {},
        metadata: {},
        createdBy: productOwner.id,
        updatedBy: dev1.id,
      },
      {
        id: createId(),
        organizationId: org.id,
        projectId: mainProject.id,
        key: 'DEMO-3',
        number: 3,
        type: 'story',
        title: 'OAuth integration (Google, GitHub)',
        description: 'Allow users to login with Google or GitHub accounts',
        statusId: reviewStatus.id,
        priority: 'high',
        assigneeId: dev2.id,
        reporterId: productOwner.id,
        labels: ['auth', 'oauth'],
        sprintId: activeSprint.id,
        estimate: 13,
        customFields: {},
        metadata: {},
        createdBy: productOwner.id,
        updatedBy: dev2.id,
      },
      {
        id: createId(),
        organizationId: org.id,
        projectId: mainProject.id,
        key: 'DEMO-4',
        number: 4,
        type: 'task',
        title: 'Setup role permissions matrix',
        description: 'Define and implement project role permissions',
        statusId: qaStatus.id,
        priority: 'high',
        assigneeId: techLead.id,
        reporterId: scrumMaster.id,
        labels: ['backend', 'security'],
        sprintId: activeSprint.id,
        estimate: 5,
        customFields: {},
        metadata: {},
        createdBy: scrumMaster.id,
        updatedBy: techLead.id,
      },
      {
        id: createId(),
        organizationId: org.id,
        projectId: mainProject.id,
        key: 'DEMO-5',
        number: 5,
        type: 'bug',
        title: 'Session expires unexpectedly',
        description: 'Users report being logged out randomly after 10 minutes',
        statusId: inProgressStatus.id,
        priority: 'critical',
        assigneeId: dev1.id,
        reporterId: qa.id,
        labels: ['bug', 'auth', 'urgent'],
        sprintId: activeSprint.id,
        estimate: 3,
        customFields: {},
        metadata: {},
        createdBy: qa.id,
        updatedBy: dev1.id,
      },
      {
        id: createId(),
        organizationId: org.id,
        projectId: mainProject.id,
        key: 'DEMO-6',
        number: 6,
        type: 'task',
        title: 'Design login page UI',
        description: 'Create modern, accessible login page design',
        statusId: doneStatus.id,
        priority: 'medium',
        assigneeId: designer.id,
        reporterId: productOwner.id,
        labels: ['design', 'ui'],
        sprintId: activeSprint.id,
        estimate: 5,
        customFields: {},
        metadata: {},
        createdBy: productOwner.id,
        updatedBy: designer.id,
      },
      // Backlog issues (no sprint)
      {
        id: createId(),
        organizationId: org.id,
        projectId: mainProject.id,
        key: 'DEMO-7',
        number: 7,
        type: 'story',
        title: 'User profile management',
        description: 'Users can view and edit their profile information',
        statusId: backlogStatus.id,
        priority: 'medium',
        assigneeId: null,
        reporterId: productOwner.id,
        labels: ['user', 'profile'],
        sprintId: null,
        estimate: 8,
        customFields: {},
        metadata: {},
        createdBy: productOwner.id,
        updatedBy: productOwner.id,
      },
      {
        id: createId(),
        organizationId: org.id,
        projectId: mainProject.id,
        key: 'DEMO-8',
        number: 8,
        type: 'story',
        title: 'Email notifications',
        description: 'Send email notifications for important events',
        statusId: backlogStatus.id,
        priority: 'low',
        assigneeId: null,
        reporterId: productOwner.id,
        labels: ['notifications', 'email'],
        sprintId: null,
        estimate: 13,
        customFields: {},
        metadata: {},
        createdBy: productOwner.id,
        updatedBy: productOwner.id,
      },
    ];
    await db.insert(schema.issues).values(seedData.issues);

    // Create docs / wiki
    console.log('Creating docs spaces and pages...');
    const orgSpace = {
      id: createId(),
      organizationId: org.id,
      projectId: null,
      scope: 'organization' as const,
      name: 'Team Wiki',
      slug: 'team-wiki',
      description: 'Shared company knowledge, onboarding, and operating guides',
      isDefault: true,
      createdBy: adminUser.id,
      updatedBy: adminUser.id,
    };

    const projectSpace = {
      id: createId(),
      organizationId: mainProject.organizationId,
      projectId: mainProject.id,
      scope: 'project' as const,
      name: `${mainProject.name} Docs`,
      slug: `${mainProject.key.toLowerCase()}-docs`,
      description: 'Technical specs and delivery notes for the demo project',
      isDefault: true,
      createdBy: techLead.id,
      updatedBy: techLead.id,
    };

    seedData.documentSpaces.push(orgSpace, projectSpace);
    await db.insert(schema.documentSpaces).values(seedData.documentSpaces);

    const onboardingPageId = createId();
    const releasePageId = createId();
    const authSpecPageId = createId();
    const qaPageId = createId();

    const createDocContent = (title: string, paragraphs: string[]) => ({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: title }],
        },
        ...paragraphs.map((paragraph) => ({
          type: 'paragraph',
          content: [{ type: 'text', text: paragraph }],
        })),
      ],
    });

    const docPages = [
      {
        id: onboardingPageId,
        spaceId: orgSpace.id,
        organizationId: org.id,
        projectId: null,
        parentId: null,
        title: 'Team Onboarding',
        slug: 'team-onboarding',
        icon: 'book-open',
        contentJson: createDocContent('Team Onboarding', [
          'Welcome to TaskNebula. Start here for local setup, daily rituals, and communication norms.',
          'Review the project docs space for active engineering specs tied to current delivery work.',
        ]),
        contentText: 'Welcome to TaskNebula. Start here for local setup, daily rituals, and communication norms. Review the project docs space for active engineering specs tied to current delivery work.',
        excerpt: 'Welcome to TaskNebula. Start here for local setup, daily rituals, and communication norms.',
        currentRevision: 1,
        position: 0,
        isArchived: false,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
      },
      {
        id: releasePageId,
        spaceId: orgSpace.id,
        organizationId: org.id,
        projectId: null,
        parentId: onboardingPageId,
        title: 'Release Checklist',
        slug: 'release-checklist',
        icon: 'clipboard-check',
        contentJson: createDocContent('Release Checklist', [
          'Run migrations, verify smoke tests, and publish release notes before every production deployment.',
        ]),
        contentText: 'Run migrations, verify smoke tests, and publish release notes before every production deployment.',
        excerpt: 'Run migrations, verify smoke tests, and publish release notes before every production deployment.',
        currentRevision: 1,
        position: 0,
        isArchived: false,
        createdBy: scrumMaster.id,
        updatedBy: scrumMaster.id,
      },
      {
        id: authSpecPageId,
        spaceId: projectSpace.id,
        organizationId: org.id,
        projectId: mainProject.id,
        parentId: null,
        title: 'Authentication Rollout Spec',
        slug: 'authentication-rollout-spec',
        icon: 'shield',
        contentJson: createDocContent('Authentication Rollout Spec', [
          'This spec tracks implementation scope for the DEMO-1 auth epic and linked stories.',
          'Document OAuth callback handling, session invalidation fixes, and release sequencing.',
        ]),
        contentText: 'This spec tracks implementation scope for the DEMO-1 auth epic and linked stories. Document OAuth callback handling, session invalidation fixes, and release sequencing.',
        excerpt: 'This spec tracks implementation scope for the DEMO-1 auth epic and linked stories.',
        currentRevision: 1,
        position: 0,
        isArchived: false,
        createdBy: techLead.id,
        updatedBy: techLead.id,
      },
      {
        id: qaPageId,
        spaceId: projectSpace.id,
        organizationId: org.id,
        projectId: mainProject.id,
        parentId: authSpecPageId,
        title: 'QA Test Matrix',
        slug: 'qa-test-matrix',
        icon: 'check-square',
        contentJson: createDocContent('QA Test Matrix', [
          'Cover session expiry, OAuth account linking, and role-based route protection before release.',
        ]),
        contentText: 'Cover session expiry, OAuth account linking, and role-based route protection before release.',
        excerpt: 'Cover session expiry, OAuth account linking, and role-based route protection before release.',
        currentRevision: 1,
        position: 0,
        isArchived: false,
        createdBy: qa.id,
        updatedBy: qa.id,
      },
    ];

    seedData.documentPages.push(...docPages);
    await db.insert(schema.documentPages).values(docPages);

    const revisions = docPages.map((page) => ({
      id: createId(),
      pageId: page.id,
      revision: 1,
      title: page.title,
      contentJson: page.contentJson,
      contentText: page.contentText,
      excerpt: page.excerpt,
      changeSummary: 'Initial draft',
      createdBy: page.createdBy,
    }));
    seedData.documentPageRevisions.push(...revisions);
    await db.insert(schema.documentPageRevisions).values(revisions);

    await db.insert(schema.documentPageLinks).values([
      {
        id: createId(),
        sourcePageId: onboardingPageId,
        targetPageId: authSpecPageId,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
      },
      {
        id: createId(),
        sourcePageId: qaPageId,
        targetPageId: authSpecPageId,
        createdBy: qa.id,
        updatedBy: qa.id,
      },
    ]);

    const issueDocLinks = [
      {
        id: createId(),
        issueId: seedData.issues[0].id,
        pageId: authSpecPageId,
        createdBy: techLead.id,
        updatedBy: techLead.id,
      },
      {
        id: createId(),
        issueId: seedData.issues[4].id,
        pageId: qaPageId,
        createdBy: qa.id,
        updatedBy: qa.id,
      },
    ];
    seedData.issueDocumentLinks.push(...issueDocLinks);
    await db.insert(schema.issueDocumentLinks).values(issueDocLinks);

    // Print summary
    console.log('\n✅ Seed completed successfully!\n');
    console.log('📊 Created:');
    console.log(`   - ${seedData.organizations.length} organization`);
    console.log(`   - ${seedData.users.length} users`);
    console.log(`   - ${seedData.teams.length} teams`);
    console.log(`   - ${seedData.projects.length} projects`);
    console.log(`   - ${seedData.projectMembers.length} project memberships`);
    console.log(`   - ${seedData.workflows.length} workflows`);
    console.log(`   - ${seedData.workflowStatuses.length} workflow statuses`);
    console.log(`   - ${seedData.sprints.length} sprints`);
    console.log(`   - ${seedData.issues.length} issues`);
    console.log(`   - ${seedData.documentSpaces.length} document spaces`);
    console.log(`   - ${seedData.documentPages.length} document pages`);

    console.log('\n👥 Demo Users (password: demo123):');
    console.log('┌─────────────────────────────┬──────────────────┬─────────────────┐');
    console.log('│ Email                       │ Org Role         │ Project Role    │');
    console.log('├─────────────────────────────┼──────────────────┼─────────────────┤');
    seedData.users.forEach(u => {
      const email = u.email.padEnd(27);
      const orgRole = u.orgRole.padEnd(16);
      const projectRole = u.projectRole.padEnd(15);
      console.log(`│ ${email} │ ${orgRole} │ ${projectRole} │`);
    });
    console.log('└─────────────────────────────┴──────────────────┴─────────────────┘');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

seed();

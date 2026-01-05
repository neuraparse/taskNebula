/**
 * Permission System - Role-Based Access Control (RBAC)
 *
 * Jira-like comprehensive permission system with granular controls.
 * Based on Atlassian Jira permission model.
 */

// ===== GRANULAR PERMISSION KEYS =====
// These match the database columns in projectMembers table
export const PERMISSION_KEYS = {
  // Project
  canBrowseProject: 'canBrowseProject',
  canAdministerProject: 'canAdministerProject',
  // Sprint
  canManageSprints: 'canManageSprints',
  canStartSprint: 'canStartSprint',
  canCompleteSprint: 'canCompleteSprint',
  canDeleteSprint: 'canDeleteSprint',
  // Issue
  canCreateIssues: 'canCreateIssues',
  canEditIssues: 'canEditIssues',
  canEditOwnIssues: 'canEditOwnIssues',
  canDeleteIssues: 'canDeleteIssues',
  canDeleteOwnIssues: 'canDeleteOwnIssues',
  canAssignIssues: 'canAssignIssues',
  canAssigneeIssues: 'canAssigneeIssues',
  canTransitionIssues: 'canTransitionIssues',
  canScheduleIssues: 'canScheduleIssues',
  canMoveIssues: 'canMoveIssues',
  canLinkIssues: 'canLinkIssues',
  canCloseIssues: 'canCloseIssues',
  canReopenIssues: 'canReopenIssues',
  // Comment
  canAddComments: 'canAddComments',
  canEditOwnComments: 'canEditOwnComments',
  canEditAllComments: 'canEditAllComments',
  canDeleteOwnComments: 'canDeleteOwnComments',
  canDeleteAllComments: 'canDeleteAllComments',
  // Attachment
  canCreateAttachments: 'canCreateAttachments',
  canDeleteOwnAttachments: 'canDeleteOwnAttachments',
  canDeleteAllAttachments: 'canDeleteAllAttachments',
  // Watcher
  canManageWatchers: 'canManageWatchers',
  canViewWatchers: 'canViewWatchers',
  // Member
  canManageMembers: 'canManageMembers',
  canInviteMembers: 'canInviteMembers',
  canRemoveMembers: 'canRemoveMembers',
  canChangeRoles: 'canChangeRoles',
  // Workflow
  canManageWorkflow: 'canManageWorkflow',
  // Time Tracking
  canLogWork: 'canLogWork',
  canEditOwnWorklogs: 'canEditOwnWorklogs',
  canEditAllWorklogs: 'canEditAllWorklogs',
  canDeleteOwnWorklogs: 'canDeleteOwnWorklogs',
  canDeleteAllWorklogs: 'canDeleteAllWorklogs',
} as const;

export type PermissionKey = keyof typeof PERMISSION_KEYS;

// Permission categories for UI grouping
export const PERMISSION_CATEGORIES = {
  project: {
    label: 'Project',
    permissions: ['canBrowseProject', 'canAdministerProject'],
  },
  sprint: {
    label: 'Sprint Management',
    permissions: ['canManageSprints', 'canStartSprint', 'canCompleteSprint', 'canDeleteSprint'],
  },
  issue: {
    label: 'Issues',
    permissions: [
      'canCreateIssues', 'canEditIssues', 'canEditOwnIssues',
      'canDeleteIssues', 'canDeleteOwnIssues', 'canAssignIssues',
      'canAssigneeIssues', 'canTransitionIssues', 'canScheduleIssues',
      'canMoveIssues', 'canLinkIssues', 'canCloseIssues', 'canReopenIssues'
    ],
  },
  comment: {
    label: 'Comments',
    permissions: ['canAddComments', 'canEditOwnComments', 'canEditAllComments', 'canDeleteOwnComments', 'canDeleteAllComments'],
  },
  attachment: {
    label: 'Attachments',
    permissions: ['canCreateAttachments', 'canDeleteOwnAttachments', 'canDeleteAllAttachments'],
  },
  watcher: {
    label: 'Watchers',
    permissions: ['canManageWatchers', 'canViewWatchers'],
  },
  member: {
    label: 'Team Members',
    permissions: ['canManageMembers', 'canInviteMembers', 'canRemoveMembers', 'canChangeRoles'],
  },
  workflow: {
    label: 'Workflow',
    permissions: ['canManageWorkflow'],
  },
  timeTracking: {
    label: 'Time Tracking',
    permissions: ['canLogWork', 'canEditOwnWorklogs', 'canEditAllWorklogs', 'canDeleteOwnWorklogs', 'canDeleteAllWorklogs'],
  },
} as const;

// Permission descriptions for UI
export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, { label: string; description: string }> = {
  canBrowseProject: { label: 'Browse Project', description: 'View project, issues, and sprints' },
  canAdministerProject: { label: 'Administer Project', description: 'Full project administration access' },
  canManageSprints: { label: 'Manage Sprints', description: 'Create and edit sprints' },
  canStartSprint: { label: 'Start Sprint', description: 'Start a sprint' },
  canCompleteSprint: { label: 'Complete Sprint', description: 'Complete/close a sprint' },
  canDeleteSprint: { label: 'Delete Sprint', description: 'Delete sprints' },
  canCreateIssues: { label: 'Create Issues', description: 'Create new issues' },
  canEditIssues: { label: 'Edit All Issues', description: 'Edit any issue in the project' },
  canEditOwnIssues: { label: 'Edit Own Issues', description: 'Edit issues you created or are assigned to' },
  canDeleteIssues: { label: 'Delete All Issues', description: 'Delete any issue' },
  canDeleteOwnIssues: { label: 'Delete Own Issues', description: 'Delete issues you created' },
  canAssignIssues: { label: 'Assign Issues', description: 'Assign issues to team members' },
  canAssigneeIssues: { label: 'Be Assigned', description: 'Can be assigned to issues' },
  canTransitionIssues: { label: 'Transition Issues', description: 'Change issue status' },
  canScheduleIssues: { label: 'Schedule Issues', description: 'Add/remove issues from sprints' },
  canMoveIssues: { label: 'Move Issues', description: 'Move issues between projects' },
  canLinkIssues: { label: 'Link Issues', description: 'Create and delete issue links' },
  canCloseIssues: { label: 'Close Issues', description: 'Close/resolve issues' },
  canReopenIssues: { label: 'Reopen Issues', description: 'Reopen closed issues' },
  canAddComments: { label: 'Add Comments', description: 'Add comments to issues' },
  canEditOwnComments: { label: 'Edit Own Comments', description: 'Edit your own comments' },
  canEditAllComments: { label: 'Edit All Comments', description: 'Edit any comment' },
  canDeleteOwnComments: { label: 'Delete Own Comments', description: 'Delete your own comments' },
  canDeleteAllComments: { label: 'Delete All Comments', description: 'Delete any comment' },
  canCreateAttachments: { label: 'Create Attachments', description: 'Upload attachments' },
  canDeleteOwnAttachments: { label: 'Delete Own Attachments', description: 'Delete your own attachments' },
  canDeleteAllAttachments: { label: 'Delete All Attachments', description: 'Delete any attachment' },
  canManageWatchers: { label: 'Manage Watchers', description: 'Add/remove watchers on issues' },
  canViewWatchers: { label: 'View Watchers', description: 'See who is watching issues' },
  canManageMembers: { label: 'Manage Members', description: 'Full member management access' },
  canInviteMembers: { label: 'Invite Members', description: 'Invite new members to project' },
  canRemoveMembers: { label: 'Remove Members', description: 'Remove members from project' },
  canChangeRoles: { label: 'Change Roles', description: 'Change member roles and permissions' },
  canManageWorkflow: { label: 'Manage Workflow', description: 'Edit project workflow' },
  canLogWork: { label: 'Log Work', description: 'Log time on issues' },
  canEditOwnWorklogs: { label: 'Edit Own Worklogs', description: 'Edit your own time logs' },
  canEditAllWorklogs: { label: 'Edit All Worklogs', description: 'Edit any time log' },
  canDeleteOwnWorklogs: { label: 'Delete Own Worklogs', description: 'Delete your own time logs' },
  canDeleteAllWorklogs: { label: 'Delete All Worklogs', description: 'Delete any time log' },
};

// Legacy Permission types (for backward compatibility)
export type Permission =
  // Organization permissions
  | 'org:view'
  | 'org:manage'
  | 'org:delete'
  | 'org:settings'
  | 'org:billing'
  // Team permissions
  | 'team:view'
  | 'team:create'
  | 'team:manage'
  | 'team:delete'
  // Project permissions
  | 'project:view'
  | 'project:create'
  | 'project:manage'
  | 'project:delete'
  | 'project:settings'
  // Issue permissions
  | 'issue:view'
  | 'issue:create'
  | 'issue:edit'
  | 'issue:delete'
  | 'issue:assign'
  | 'issue:comment'
  | 'issue:transition'
  // Member permissions
  | 'member:view'
  | 'member:invite'
  | 'member:manage'
  | 'member:remove'
  // Workflow permissions
  | 'workflow:view'
  | 'workflow:create'
  | 'workflow:manage'
  | 'workflow:delete'
  // Sprint permissions
  | 'sprint:view'
  | 'sprint:create'
  | 'sprint:manage'
  | 'sprint:delete'
  // Custom field permissions
  | 'custom_field:view'
  | 'custom_field:create'
  | 'custom_field:manage'
  | 'custom_field:delete'
  // Webhook permissions
  | 'webhook:view'
  | 'webhook:create'
  | 'webhook:manage'
  | 'webhook:delete'
  // API key permissions
  | 'api_key:view'
  | 'api_key:create'
  | 'api_key:manage'
  | 'api_key:delete'
  // Super admin permissions
  | 'system:view'
  | 'system:manage'
  | 'system:users'
  | 'system:organizations'
  | 'system:settings'
  | 'system:audit';

// Organization role permissions
export const ORGANIZATION_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: [
    // All organization permissions
    'org:view', 'org:manage', 'org:delete', 'org:settings', 'org:billing',
    // All team permissions
    'team:view', 'team:create', 'team:manage', 'team:delete',
    // All project permissions
    'project:view', 'project:create', 'project:manage', 'project:delete', 'project:settings',
    // All issue permissions
    'issue:view', 'issue:create', 'issue:edit', 'issue:delete', 'issue:assign', 'issue:comment', 'issue:transition',
    // All member permissions
    'member:view', 'member:invite', 'member:manage', 'member:remove',
    // All workflow permissions
    'workflow:view', 'workflow:create', 'workflow:manage', 'workflow:delete',
    // All sprint permissions
    'sprint:view', 'sprint:create', 'sprint:manage', 'sprint:delete',
    // All custom field permissions
    'custom_field:view', 'custom_field:create', 'custom_field:manage', 'custom_field:delete',
    // All webhook permissions
    'webhook:view', 'webhook:create', 'webhook:manage', 'webhook:delete',
    // All API key permissions
    'api_key:view', 'api_key:create', 'api_key:manage', 'api_key:delete',
  ],
  admin: [
    'org:view', 'org:manage', 'org:settings',
    'team:view', 'team:create', 'team:manage',
    'project:view', 'project:create', 'project:manage', 'project:settings',
    'issue:view', 'issue:create', 'issue:edit', 'issue:delete', 'issue:assign', 'issue:comment', 'issue:transition',
    'member:view', 'member:invite', 'member:manage',
    'workflow:view', 'workflow:create', 'workflow:manage',
    'sprint:view', 'sprint:create', 'sprint:manage',
    'custom_field:view', 'custom_field:create', 'custom_field:manage',
    'webhook:view', 'webhook:create', 'webhook:manage',
    'api_key:view', 'api_key:create',
  ],
  member: [
    'org:view',
    'team:view',
    'project:view', 'project:create',
    'issue:view', 'issue:create', 'issue:edit', 'issue:comment', 'issue:transition',
    'member:view',
    'workflow:view',
    'sprint:view',
    'custom_field:view',
  ],
  viewer: [
    'org:view',
    'team:view',
    'project:view',
    'issue:view',
    'member:view',
    'workflow:view',
    'sprint:view',
    'custom_field:view',
  ],
  guest: [
    'project:view',
    'issue:view',
    'issue:comment',
  ],
};

// Super admin permissions (all permissions)
export const SUPER_ADMIN_PERMISSIONS: Permission[] = [
  ...ORGANIZATION_ROLE_PERMISSIONS.owner,
  'system:view',
  'system:manage',
  'system:users',
  'system:organizations',
  'system:settings',
  'system:audit',
];

// Project role types
export type ProjectRole =
  | 'product_owner'
  | 'scrum_master'
  | 'tech_lead'
  | 'developer'
  | 'qa_engineer'
  | 'designer'
  | 'viewer';

// Project role permissions - specific to project context
export const PROJECT_ROLE_PERMISSIONS: Record<ProjectRole, Permission[]> = {
  product_owner: [
    'project:view', 'project:manage', 'project:settings',
    'issue:view', 'issue:create', 'issue:edit', 'issue:delete', 'issue:assign', 'issue:comment', 'issue:transition',
    'sprint:view', 'sprint:create', 'sprint:manage',
    'member:view', 'member:invite', 'member:manage',
    'workflow:view', 'workflow:manage',
    'custom_field:view', 'custom_field:create', 'custom_field:manage',
  ],
  scrum_master: [
    'project:view', 'project:manage',
    'issue:view', 'issue:create', 'issue:edit', 'issue:assign', 'issue:comment', 'issue:transition',
    'sprint:view', 'sprint:create', 'sprint:manage', 'sprint:delete',
    'member:view', 'member:invite', 'member:manage',
    'workflow:view',
    'custom_field:view',
  ],
  tech_lead: [
    'project:view', 'project:settings',
    'issue:view', 'issue:create', 'issue:edit', 'issue:delete', 'issue:assign', 'issue:comment', 'issue:transition',
    'sprint:view', 'sprint:create', 'sprint:manage',
    'member:view', 'member:invite',
    'workflow:view', 'workflow:manage',
    'custom_field:view', 'custom_field:create',
  ],
  developer: [
    'project:view',
    'issue:view', 'issue:create', 'issue:edit', 'issue:comment', 'issue:transition',
    'sprint:view',
    'member:view',
    'workflow:view',
    'custom_field:view',
  ],
  qa_engineer: [
    'project:view',
    'issue:view', 'issue:create', 'issue:edit', 'issue:comment', 'issue:transition',
    'sprint:view',
    'member:view',
    'workflow:view',
    'custom_field:view',
  ],
  designer: [
    'project:view',
    'issue:view', 'issue:create', 'issue:edit', 'issue:comment',
    'sprint:view',
    'member:view',
    'workflow:view',
    'custom_field:view',
  ],
  viewer: [
    'project:view',
    'issue:view', 'issue:comment',
    'sprint:view',
    'member:view',
    'workflow:view',
    'custom_field:view',
  ],
};

// Project role display info
export const PROJECT_ROLE_INFO: Record<ProjectRole, { label: string; description: string; color: string }> = {
  product_owner: {
    label: 'Product Owner',
    description: 'Manages product backlog, priorities, and accepts/rejects work',
    color: 'purple',
  },
  scrum_master: {
    label: 'Scrum Master',
    description: 'Facilitates sprints, removes impediments, manages team',
    color: 'blue',
  },
  tech_lead: {
    label: 'Tech Lead',
    description: 'Technical decisions, code reviews, architecture',
    color: 'indigo',
  },
  developer: {
    label: 'Developer',
    description: 'Develops features, fixes bugs, updates task status',
    color: 'green',
  },
  qa_engineer: {
    label: 'QA Engineer',
    description: 'Tests features, creates bugs, verifies fixes',
    color: 'orange',
  },
  designer: {
    label: 'Designer',
    description: 'Creates designs, UI/UX work, design tasks',
    color: 'pink',
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only access to project',
    color: 'gray',
  },
};

// ===== GRANULAR ROLE DEFAULT PERMISSIONS =====
// These are the default permissions for each role when added to a project
export type GranularPermissions = Record<PermissionKey, boolean>;

export const ROLE_DEFAULT_PERMISSIONS: Record<ProjectRole, GranularPermissions> = {
  product_owner: {
    // Project - Full access
    canBrowseProject: true,
    canAdministerProject: true,
    // Sprint - Full access
    canManageSprints: true,
    canStartSprint: true,
    canCompleteSprint: true,
    canDeleteSprint: true,
    // Issue - Full access
    canCreateIssues: true,
    canEditIssues: true,
    canEditOwnIssues: true,
    canDeleteIssues: true,
    canDeleteOwnIssues: true,
    canAssignIssues: true,
    canAssigneeIssues: true,
    canTransitionIssues: true,
    canScheduleIssues: true,
    canMoveIssues: true,
    canLinkIssues: true,
    canCloseIssues: true,
    canReopenIssues: true,
    // Comment - Full access
    canAddComments: true,
    canEditOwnComments: true,
    canEditAllComments: true,
    canDeleteOwnComments: true,
    canDeleteAllComments: true,
    // Attachment - Full access
    canCreateAttachments: true,
    canDeleteOwnAttachments: true,
    canDeleteAllAttachments: true,
    // Watcher - Full access
    canManageWatchers: true,
    canViewWatchers: true,
    // Member - Full access
    canManageMembers: true,
    canInviteMembers: true,
    canRemoveMembers: true,
    canChangeRoles: true,
    // Workflow
    canManageWorkflow: true,
    // Time Tracking
    canLogWork: true,
    canEditOwnWorklogs: true,
    canEditAllWorklogs: true,
    canDeleteOwnWorklogs: true,
    canDeleteAllWorklogs: true,
  },
  scrum_master: {
    // Project
    canBrowseProject: true,
    canAdministerProject: false,
    // Sprint - Full access (main responsibility)
    canManageSprints: true,
    canStartSprint: true,
    canCompleteSprint: true,
    canDeleteSprint: true,
    // Issue
    canCreateIssues: true,
    canEditIssues: true,
    canEditOwnIssues: true,
    canDeleteIssues: false,
    canDeleteOwnIssues: true,
    canAssignIssues: true,
    canAssigneeIssues: true,
    canTransitionIssues: true,
    canScheduleIssues: true,
    canMoveIssues: true,
    canLinkIssues: true,
    canCloseIssues: true,
    canReopenIssues: true,
    // Comment
    canAddComments: true,
    canEditOwnComments: true,
    canEditAllComments: false,
    canDeleteOwnComments: true,
    canDeleteAllComments: false,
    // Attachment
    canCreateAttachments: true,
    canDeleteOwnAttachments: true,
    canDeleteAllAttachments: false,
    // Watcher
    canManageWatchers: true,
    canViewWatchers: true,
    // Member - Can manage team
    canManageMembers: true,
    canInviteMembers: true,
    canRemoveMembers: false,
    canChangeRoles: false,
    // Workflow
    canManageWorkflow: false,
    // Time Tracking
    canLogWork: true,
    canEditOwnWorklogs: true,
    canEditAllWorklogs: false,
    canDeleteOwnWorklogs: true,
    canDeleteAllWorklogs: false,
  },
  tech_lead: {
    // Project
    canBrowseProject: true,
    canAdministerProject: false,
    // Sprint
    canManageSprints: true,
    canStartSprint: true,
    canCompleteSprint: true,
    canDeleteSprint: false,
    // Issue - Strong access
    canCreateIssues: true,
    canEditIssues: true,
    canEditOwnIssues: true,
    canDeleteIssues: true,
    canDeleteOwnIssues: true,
    canAssignIssues: true,
    canAssigneeIssues: true,
    canTransitionIssues: true,
    canScheduleIssues: true,
    canMoveIssues: false,
    canLinkIssues: true,
    canCloseIssues: true,
    canReopenIssues: true,
    // Comment
    canAddComments: true,
    canEditOwnComments: true,
    canEditAllComments: false,
    canDeleteOwnComments: true,
    canDeleteAllComments: false,
    // Attachment
    canCreateAttachments: true,
    canDeleteOwnAttachments: true,
    canDeleteAllAttachments: false,
    // Watcher
    canManageWatchers: true,
    canViewWatchers: true,
    // Member
    canManageMembers: false,
    canInviteMembers: true,
    canRemoveMembers: false,
    canChangeRoles: false,
    // Workflow
    canManageWorkflow: true,
    // Time Tracking
    canLogWork: true,
    canEditOwnWorklogs: true,
    canEditAllWorklogs: false,
    canDeleteOwnWorklogs: true,
    canDeleteAllWorklogs: false,
  },
  developer: {
    // Project
    canBrowseProject: true,
    canAdministerProject: false,
    // Sprint - View only
    canManageSprints: false,
    canStartSprint: false,
    canCompleteSprint: false,
    canDeleteSprint: false,
    // Issue - Work on assigned
    canCreateIssues: true,
    canEditIssues: false,
    canEditOwnIssues: true,
    canDeleteIssues: false,
    canDeleteOwnIssues: false,
    canAssignIssues: false,
    canAssigneeIssues: true,
    canTransitionIssues: true,
    canScheduleIssues: false,
    canMoveIssues: false,
    canLinkIssues: true,
    canCloseIssues: true,
    canReopenIssues: true,
    // Comment
    canAddComments: true,
    canEditOwnComments: true,
    canEditAllComments: false,
    canDeleteOwnComments: true,
    canDeleteAllComments: false,
    // Attachment
    canCreateAttachments: true,
    canDeleteOwnAttachments: true,
    canDeleteAllAttachments: false,
    // Watcher
    canManageWatchers: false,
    canViewWatchers: true,
    // Member
    canManageMembers: false,
    canInviteMembers: false,
    canRemoveMembers: false,
    canChangeRoles: false,
    // Workflow
    canManageWorkflow: false,
    // Time Tracking
    canLogWork: true,
    canEditOwnWorklogs: true,
    canEditAllWorklogs: false,
    canDeleteOwnWorklogs: true,
    canDeleteAllWorklogs: false,
  },
  qa_engineer: {
    // Project
    canBrowseProject: true,
    canAdministerProject: false,
    // Sprint
    canManageSprints: false,
    canStartSprint: false,
    canCompleteSprint: false,
    canDeleteSprint: false,
    // Issue - Create bugs, verify
    canCreateIssues: true,
    canEditIssues: false,
    canEditOwnIssues: true,
    canDeleteIssues: false,
    canDeleteOwnIssues: false,
    canAssignIssues: false,
    canAssigneeIssues: true,
    canTransitionIssues: true,
    canScheduleIssues: false,
    canMoveIssues: false,
    canLinkIssues: true,
    canCloseIssues: true,
    canReopenIssues: true,
    // Comment
    canAddComments: true,
    canEditOwnComments: true,
    canEditAllComments: false,
    canDeleteOwnComments: true,
    canDeleteAllComments: false,
    // Attachment
    canCreateAttachments: true,
    canDeleteOwnAttachments: true,
    canDeleteAllAttachments: false,
    // Watcher
    canManageWatchers: false,
    canViewWatchers: true,
    // Member
    canManageMembers: false,
    canInviteMembers: false,
    canRemoveMembers: false,
    canChangeRoles: false,
    // Workflow
    canManageWorkflow: false,
    // Time Tracking
    canLogWork: true,
    canEditOwnWorklogs: true,
    canEditAllWorklogs: false,
    canDeleteOwnWorklogs: true,
    canDeleteAllWorklogs: false,
  },
  designer: {
    // Project
    canBrowseProject: true,
    canAdministerProject: false,
    // Sprint
    canManageSprints: false,
    canStartSprint: false,
    canCompleteSprint: false,
    canDeleteSprint: false,
    // Issue - Design tasks
    canCreateIssues: true,
    canEditIssues: false,
    canEditOwnIssues: true,
    canDeleteIssues: false,
    canDeleteOwnIssues: false,
    canAssignIssues: false,
    canAssigneeIssues: true,
    canTransitionIssues: true,
    canScheduleIssues: false,
    canMoveIssues: false,
    canLinkIssues: true,
    canCloseIssues: true,
    canReopenIssues: false,
    // Comment
    canAddComments: true,
    canEditOwnComments: true,
    canEditAllComments: false,
    canDeleteOwnComments: true,
    canDeleteAllComments: false,
    // Attachment - Important for designers
    canCreateAttachments: true,
    canDeleteOwnAttachments: true,
    canDeleteAllAttachments: false,
    // Watcher
    canManageWatchers: false,
    canViewWatchers: true,
    // Member
    canManageMembers: false,
    canInviteMembers: false,
    canRemoveMembers: false,
    canChangeRoles: false,
    // Workflow
    canManageWorkflow: false,
    // Time Tracking
    canLogWork: true,
    canEditOwnWorklogs: true,
    canEditAllWorklogs: false,
    canDeleteOwnWorklogs: true,
    canDeleteAllWorklogs: false,
  },
  viewer: {
    // Project - Read only
    canBrowseProject: true,
    canAdministerProject: false,
    // Sprint
    canManageSprints: false,
    canStartSprint: false,
    canCompleteSprint: false,
    canDeleteSprint: false,
    // Issue - View only
    canCreateIssues: false,
    canEditIssues: false,
    canEditOwnIssues: false,
    canDeleteIssues: false,
    canDeleteOwnIssues: false,
    canAssignIssues: false,
    canAssigneeIssues: false,
    canTransitionIssues: false,
    canScheduleIssues: false,
    canMoveIssues: false,
    canLinkIssues: false,
    canCloseIssues: false,
    canReopenIssues: false,
    // Comment - Can add comments
    canAddComments: true,
    canEditOwnComments: true,
    canEditAllComments: false,
    canDeleteOwnComments: true,
    canDeleteAllComments: false,
    // Attachment
    canCreateAttachments: false,
    canDeleteOwnAttachments: false,
    canDeleteAllAttachments: false,
    // Watcher
    canManageWatchers: false,
    canViewWatchers: true,
    // Member
    canManageMembers: false,
    canInviteMembers: false,
    canRemoveMembers: false,
    canChangeRoles: false,
    // Workflow
    canManageWorkflow: false,
    // Time Tracking
    canLogWork: false,
    canEditOwnWorklogs: false,
    canEditAllWorklogs: false,
    canDeleteOwnWorklogs: false,
    canDeleteAllWorklogs: false,
  },
};

/**
 * Get default permissions for a project role
 */
export function getDefaultPermissionsForRole(role: ProjectRole): GranularPermissions {
  return ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.viewer;
}

/**
 * Check if a project role has a specific permission
 */
export function hasProjectPermission(
  projectRole: ProjectRole,
  permission: Permission
): boolean {
  const rolePermissions = PROJECT_ROLE_PERMISSIONS[projectRole];
  if (!rolePermissions) {
    return false;
  }
  return rolePermissions.includes(permission);
}

/**
 * Get all permissions for a project role
 */
export function getProjectRolePermissions(projectRole: ProjectRole): Permission[] {
  return PROJECT_ROLE_PERMISSIONS[projectRole] || [];
}

/**
 * Check if a user has a specific permission based on their organization role
 */
export function hasPermission(
  role: string,
  permission: Permission,
  isSuperAdmin: boolean = false
): boolean {
  // Super admins have all permissions
  if (isSuperAdmin) {
    return true;
  }

  // Check organization role permissions
  const rolePermissions = ORGANIZATION_ROLE_PERMISSIONS[role];
  if (!rolePermissions) {
    return false;
  }

  return rolePermissions.includes(permission);
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(
  role: string,
  permissions: Permission[],
  isSuperAdmin: boolean = false
): boolean {
  if (isSuperAdmin) {
    return true;
  }

  return permissions.some(permission => hasPermission(role, permission, isSuperAdmin));
}

/**
 * Check if a user has all of the specified permissions
 */
export function hasAllPermissions(
  role: string,
  permissions: Permission[],
  isSuperAdmin: boolean = false
): boolean {
  if (isSuperAdmin) {
    return true;
  }

  return permissions.every(permission => hasPermission(role, permission, isSuperAdmin));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(
  role: string,
  isSuperAdmin: boolean = false
): Permission[] {
  if (isSuperAdmin) {
    return SUPER_ADMIN_PERMISSIONS;
  }

  return ORGANIZATION_ROLE_PERMISSIONS[role] || [];
}


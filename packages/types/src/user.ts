import type { BaseEntity, ID } from './common';

// User
export interface User extends BaseEntity {
  email: string;
  name: string;
  avatarUrl?: string;
  timezone?: string;
  locale?: string;
  settings: UserSettings;
  status: UserStatus;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  notificationPreferences: {
    email: boolean;
    push: boolean;
    mentions: boolean;
    assignedIssues: boolean;
    statusChanges: boolean;
  };
  keyboardShortcutsEnabled: boolean;
}

export type UserStatus = 'active' | 'inactive' | 'invited';

// Organization Membership
export interface OrganizationMember extends BaseEntity {
  organizationId: ID;
  userId: ID;
  role: OrganizationRole;
  status: 'active' | 'invited' | 'suspended';
}

export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer' | 'guest';

// Role permissions mapping
export const ROLE_PERMISSIONS: Record<OrganizationRole, string[]> = {
  owner: ['*'], // All permissions
  admin: [
    'org:manage',
    'team:manage',
    'project:manage',
    'issue:manage',
    'member:manage',
  ],
  member: ['project:create', 'issue:create', 'issue:edit', 'issue:comment'],
  viewer: ['project:view', 'issue:view'],
  guest: ['issue:view', 'issue:comment'], // Limited to specific projects
};


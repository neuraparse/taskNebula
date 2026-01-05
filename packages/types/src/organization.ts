import type { BaseEntity, ID } from './common';

// Organization (Multi-tenant root)
export interface Organization extends BaseEntity {
  name: string;
  slug: string; // URL-friendly identifier
  domain?: string; // Custom domain for enterprise
  logoUrl?: string;
  settings: OrganizationSettings;
  plan: OrganizationPlan;
  status: OrganizationStatus;
}

export interface OrganizationSettings {
  themeColor?: string;
  allowGuestAccess: boolean;
  defaultProjectVisibility: 'private' | 'internal' | 'public';
  ssoEnabled: boolean;
  ssoProvider?: 'google' | 'github' | 'microsoft' | 'saml';
}

export type OrganizationPlan = 'free' | 'starter' | 'growth' | 'enterprise';

export type OrganizationStatus = 'active' | 'suspended' | 'trial';

// Team (within Organization)
export interface Team extends BaseEntity {
  organizationId: ID;
  name: string;
  slug: string;
  description?: string;
  avatarUrl?: string;
  leadId?: ID; // User ID
  settings: TeamSettings;
}

export interface TeamSettings {
  defaultWorkflowId?: ID;
  notificationPreferences: {
    emailEnabled: boolean;
    slackEnabled: boolean;
  };
}

// Team Membership
export interface TeamMember extends BaseEntity {
  teamId: ID;
  userId: ID;
  role: TeamRole;
}

export type TeamRole = 'lead' | 'member';


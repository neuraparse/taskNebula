/**
 * Plan Limits Configuration
 * Defines resource limits for each organization plan
 */

export type OrganizationPlan = 'free' | 'starter' | 'growth' | 'enterprise';

export interface PlanLimits {
  // Member limits
  maxMembers: number;
  
  // Project limits
  maxProjects: number;
  
  // Storage limits (in bytes)
  maxStoragePerFile: number; // Max file size
  maxTotalStorage: number; // Total storage quota
  
  // API limits
  maxApiCallsPerHour: number;
  maxApiCallsPerDay: number;
  
  // Issue limits
  maxIssuesPerProject: number;
  
  // Sprint limits
  maxActiveSprintsPerProject: number;
  
  // Custom field limits
  maxCustomFields: number;
  
  // Webhook limits
  maxWebhooks: number;
  
  // Team limits
  maxTeams: number;
  
  // Feature access
  features: {
    customFields: boolean;
    advancedWorkflows: boolean;
    apiAccess: boolean;
    webhooks: boolean;
    sso: boolean;
    auditLogs: boolean;
    prioritySupport: boolean;
    customBranding: boolean;
    advancedAnalytics: boolean;
    aiFeatures: boolean;
  };
}

/**
 * Plan limits configuration
 */
export const PLAN_LIMITS: Record<OrganizationPlan, PlanLimits> = {
  free: {
    maxMembers: 5,
    maxProjects: 3,
    maxStoragePerFile: 5 * 1024 * 1024, // 5 MB
    maxTotalStorage: 100 * 1024 * 1024, // 100 MB
    maxApiCallsPerHour: 100,
    maxApiCallsPerDay: 1000,
    maxIssuesPerProject: 100,
    maxActiveSprintsPerProject: 1,
    maxCustomFields: 5,
    maxWebhooks: 0,
    maxTeams: 2,
    features: {
      customFields: true,
      advancedWorkflows: false,
      apiAccess: false,
      webhooks: false,
      sso: false,
      auditLogs: false,
      prioritySupport: false,
      customBranding: false,
      advancedAnalytics: false,
      aiFeatures: false,
    },
  },
  starter: {
    maxMembers: 15,
    maxProjects: 10,
    maxStoragePerFile: 25 * 1024 * 1024, // 25 MB
    maxTotalStorage: 1 * 1024 * 1024 * 1024, // 1 GB
    maxApiCallsPerHour: 500,
    maxApiCallsPerDay: 10000,
    maxIssuesPerProject: 500,
    maxActiveSprintsPerProject: 3,
    maxCustomFields: 20,
    maxWebhooks: 5,
    maxTeams: 5,
    features: {
      customFields: true,
      advancedWorkflows: true,
      apiAccess: true,
      webhooks: true,
      sso: false,
      auditLogs: true,
      prioritySupport: false,
      customBranding: false,
      advancedAnalytics: true,
      aiFeatures: true,
    },
  },
  growth: {
    maxMembers: 50,
    maxProjects: 50,
    maxStoragePerFile: 100 * 1024 * 1024, // 100 MB
    maxTotalStorage: 10 * 1024 * 1024 * 1024, // 10 GB
    maxApiCallsPerHour: 2000,
    maxApiCallsPerDay: 50000,
    maxIssuesPerProject: 2000,
    maxActiveSprintsPerProject: 10,
    maxCustomFields: 50,
    maxWebhooks: 20,
    maxTeams: 20,
    features: {
      customFields: true,
      advancedWorkflows: true,
      apiAccess: true,
      webhooks: true,
      sso: true,
      auditLogs: true,
      prioritySupport: true,
      customBranding: true,
      advancedAnalytics: true,
      aiFeatures: true,
    },
  },
  enterprise: {
    maxMembers: -1, // Unlimited
    maxProjects: -1, // Unlimited
    maxStoragePerFile: 500 * 1024 * 1024, // 500 MB
    maxTotalStorage: -1, // Unlimited
    maxApiCallsPerHour: -1, // Unlimited
    maxApiCallsPerDay: -1, // Unlimited
    maxIssuesPerProject: -1, // Unlimited
    maxActiveSprintsPerProject: -1, // Unlimited
    maxCustomFields: -1, // Unlimited
    maxWebhooks: -1, // Unlimited
    maxTeams: -1, // Unlimited
    features: {
      customFields: true,
      advancedWorkflows: true,
      apiAccess: true,
      webhooks: true,
      sso: true,
      auditLogs: true,
      prioritySupport: true,
      customBranding: true,
      advancedAnalytics: true,
      aiFeatures: true,
    },
  },
};


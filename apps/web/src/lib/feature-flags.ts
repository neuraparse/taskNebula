import { db, featureFlags, organizations } from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';

/**
 * Check if a feature is enabled for a specific organization
 * 
 * @param featureKey - The unique key of the feature flag
 * @param organizationId - The organization ID to check
 * @returns true if the feature is enabled, false otherwise
 */
export async function isFeatureEnabled(
  featureKey: string,
  organizationId: string
): Promise<boolean> {
  try {
    // Get the feature flag
    const [flag] = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.key, featureKey))
      .limit(1);

    // If flag doesn't exist or is disabled globally, return false
    if (!flag || !flag.isEnabled) {
      return false;
    }

    // Get organization details
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return false;
    }

    // Check if feature is enabled for specific organizations
    const enabledOrgs = flag.enabledForOrganizations as string[];
    if (enabledOrgs && enabledOrgs.length > 0) {
      if (!enabledOrgs.includes(organizationId)) {
        return false;
      }
    }

    // Check if feature is enabled for organization's plan
    const enabledPlans = flag.enabledForPlans as string[];
    if (enabledPlans && enabledPlans.length > 0) {
      if (!enabledPlans.includes(org.plan)) {
        return false;
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      // Use organization ID hash to determine if it's in the rollout
      const hash = hashString(organizationId);
      const percentage = hash % 100;
      if (percentage >= flag.rolloutPercentage) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking feature flag:', error);
    return false;
  }
}

/**
 * Get all enabled features for an organization
 * 
 * @param organizationId - The organization ID
 * @returns Array of enabled feature keys
 */
export async function getEnabledFeatures(
  organizationId: string
): Promise<string[]> {
  try {
    // Get all enabled feature flags
    const flags = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.isEnabled, true));

    // Get organization details
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return [];
    }

    const enabledFeatures: string[] = [];

    for (const flag of flags) {
      // Check if feature is enabled for specific organizations
      const enabledOrgs = flag.enabledForOrganizations as string[];
      if (enabledOrgs && enabledOrgs.length > 0) {
        if (!enabledOrgs.includes(organizationId)) {
          continue;
        }
      }

      // Check if feature is enabled for organization's plan
      const enabledPlans = flag.enabledForPlans as string[];
      if (enabledPlans && enabledPlans.length > 0) {
        if (!enabledPlans.includes(org.plan)) {
          continue;
        }
      }

      // Check rollout percentage
      if (flag.rolloutPercentage < 100) {
        const hash = hashString(organizationId);
        const percentage = hash % 100;
        if (percentage >= flag.rolloutPercentage) {
          continue;
        }
      }

      enabledFeatures.push(flag.key);
    }

    return enabledFeatures;
  } catch (error) {
    console.error('Error getting enabled features:', error);
    return [];
  }
}

/**
 * Simple hash function for consistent rollout percentage
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}


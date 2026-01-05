/**
 * Cache Utility
 * 
 * Provides a simple caching layer with TTL support.
 * Can be backed by Redis (Upstash) or in-memory cache for development.
 * 
 * Features:
 * - Get/Set/Delete operations
 * - TTL (Time To Live) support
 * - Automatic JSON serialization
 * - Namespace support for key prefixing
 * - Cache invalidation patterns
 */

// In-memory cache fallback for development
const memoryCache = new Map<string, { value: any; expiresAt: number }>();

// Cache configuration
const CACHE_CONFIG = {
  enabled: process.env.CACHE_ENABLED !== 'false',
  defaultTTL: 60 * 5, // 5 minutes
  keyPrefix: 'tasknebula:',
};

/**
 * Get value from cache
 */
export async function cacheGet<T = any>(key: string): Promise<T | null> {
  if (!CACHE_CONFIG.enabled) return null;

  const fullKey = CACHE_CONFIG.keyPrefix + key;

  try {
    // Check memory cache
    const cached = memoryCache.get(fullKey);
    if (cached) {
      if (cached.expiresAt > Date.now()) {
        return cached.value as T;
      } else {
        // Expired, remove it
        memoryCache.delete(fullKey);
      }
    }

    return null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Set value in cache with TTL
 */
export async function cacheSet(
  key: string,
  value: any,
  ttl: number = CACHE_CONFIG.defaultTTL
): Promise<void> {
  if (!CACHE_CONFIG.enabled) return;

  const fullKey = CACHE_CONFIG.keyPrefix + key;

  try {
    const expiresAt = Date.now() + ttl * 1000;
    memoryCache.set(fullKey, { value, expiresAt });

    // Clean up expired entries periodically
    if (memoryCache.size > 1000) {
      cleanupExpiredCache();
    }
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

/**
 * Delete value from cache
 */
export async function cacheDelete(key: string): Promise<void> {
  if (!CACHE_CONFIG.enabled) return;

  const fullKey = CACHE_CONFIG.keyPrefix + key;

  try {
    memoryCache.delete(fullKey);
  } catch (error) {
    console.error('Cache delete error:', error);
  }
}

/**
 * Delete multiple keys matching a pattern
 */
export async function cacheDeletePattern(pattern: string): Promise<void> {
  if (!CACHE_CONFIG.enabled) return;

  const fullPattern = CACHE_CONFIG.keyPrefix + pattern;

  try {
    // Convert pattern to regex (simple * wildcard support)
    const regex = new RegExp('^' + fullPattern.replace(/\*/g, '.*') + '$');

    // Delete matching keys
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        memoryCache.delete(key);
      }
    }
  } catch (error) {
    console.error('Cache delete pattern error:', error);
  }
}

/**
 * Clear all cache
 */
export async function cacheClear(): Promise<void> {
  if (!CACHE_CONFIG.enabled) return;

  try {
    memoryCache.clear();
  } catch (error) {
    console.error('Cache clear error:', error);
  }
}

/**
 * Clean up expired cache entries
 */
function cleanupExpiredCache(): void {
  const now = Date.now();
  for (const [key, value] of memoryCache.entries()) {
    if (value.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Cache key builders for common patterns
 */
export const CacheKeys = {
  // Issues
  issue: (issueId: string) => `issue:${issueId}`,
  issues: (projectId: string, filters?: string) => 
    `issues:${projectId}${filters ? `:${filters}` : ''}`,
  issueComments: (issueId: string) => `issue:${issueId}:comments`,
  
  // Projects
  project: (projectId: string) => `project:${projectId}`,
  projects: (organizationId: string) => `projects:${organizationId}`,
  
  // Sprints
  sprint: (sprintId: string) => `sprint:${sprintId}`,
  sprints: (projectId: string) => `sprints:${projectId}`,
  
  // Users
  user: (userId: string) => `user:${userId}`,
  organizationMembers: (organizationId: string) => `org:${organizationId}:members`,
  
  // Analytics
  analytics: (projectId: string, type: string) => `analytics:${projectId}:${type}`,
};


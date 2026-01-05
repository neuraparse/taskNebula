// Database client and schema exports
export * from './client';
export * from './schema';
export * from './queries';

// Re-export drizzle-orm operators
export { eq, and, or, desc, asc, sql, isNull, isNotNull, inArray, notInArray, like, ilike, between, gt, gte, lt, lte, ne } from 'drizzle-orm';

// Re-export schema as namespace
import * as schema from './schema';
export { schema };

// Utility exports
export * from './utils/audit-logger';
export * from './utils/email-service';
export * from './utils/jql-parser';
export * from './utils/push-service';
export * from './utils/cache';
export * from './utils/permissions';


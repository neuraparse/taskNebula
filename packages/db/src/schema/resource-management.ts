import { pgTable, text, timestamp, integer, jsonb, boolean, decimal } from 'drizzle-orm/pg-core';
import { users } from './users';
import { organizations } from './organizations';
import { projects } from './projects';
import { issues } from './issues';

/**
 * User Capacity - Track team member availability and workload
 */
export const userCapacity = pgTable('user_capacity', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  // Capacity settings
  weeklyHours: integer('weekly_hours').notNull().default(40), // Total hours per week
  dailyHours: integer('daily_hours').notNull().default(8), // Hours per day

  // Working schedule
  workingDays: jsonb('working_days').notNull().default('["monday","tuesday","wednesday","thursday","friday"]'),
  workingHours: jsonb('working_hours').default('{"start":"09:00","end":"17:00"}'),
  timezone: text('timezone').notNull().default('UTC'),

  // Time allocation
  dedicatedProjectIds: jsonb('dedicated_project_ids').default('[]'), // Projects this user focuses on
  allocationPercentage: jsonb('allocation_percentage').default('{}'),
  /**
   * Example:
   * {
   *   "project-uuid-1": 60,  // 60% of time
   *   "project-uuid-2": 40   // 40% of time
   * }
   */

  // Skills and expertise
  skills: jsonb('skills').default('[]'), // ['react', 'nodejs', 'design', 'qa']
  skillLevels: jsonb('skill_levels').default('{}'),
  /**
   * Example:
   * {
   *   "react": 5,      // 1-5 scale
   *   "nodejs": 4,
   *   "design": 3
   * }
   */

  // Availability exceptions
  isAvailable: boolean('is_available').notNull().default(true),
  unavailableUntil: timestamp('unavailable_until'), // PTO, sick leave, etc.
  unavailableReason: text('unavailable_reason'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Workload Snapshots - Daily snapshots of team member workload
 */
export const workloadSnapshots = pgTable('workload_snapshots', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  snapshotDate: timestamp('snapshot_date').notNull(), // Date of this snapshot

  // Workload metrics
  assignedIssues: integer('assigned_issues').notNull().default(0),
  totalEstimatedHours: decimal('total_estimated_hours', { precision: 10, scale: 2 }).default('0'),
  totalActualHours: decimal('total_actual_hours', { precision: 10, scale: 2 }).default('0'),

  // Capacity
  availableHours: decimal('available_hours', { precision: 10, scale: 2 }).notNull(),
  allocatedHours: decimal('allocated_hours', { precision: 10, scale: 2 }).notNull(),
  utilizationPercentage: integer('utilization_percentage').notNull(), // 0-100+

  // Issue breakdown
  issuesByPriority: jsonb('issues_by_priority').default('{}'),
  /**
   * Example:
   * {
   *   "critical": 2,
   *   "high": 5,
   *   "medium": 10,
   *   "low": 3
   * }
   */

  issuesByProject: jsonb('issues_by_project').default('{}'),
  /**
   * Example:
   * {
   *   "project-uuid-1": { "count": 10, "hours": 40 },
   *   "project-uuid-2": { "count": 5, "hours": 20 }
   * }
   */

  // Status
  isOverloaded: boolean('is_overloaded').notNull().default(false),
  overloadReason: text('overload_reason'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Issue Estimations - Enhanced time tracking with estimates
 */
export const issueEstimations = pgTable('issue_estimations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  issueId: text('issue_id')
    .notNull()
    .unique()
    .references(() => issues.id, { onDelete: 'cascade' }),

  // Time estimates (in minutes)
  originalEstimate: integer('original_estimate'), // Initial estimate
  remainingEstimate: integer('remaining_estimate'), // Time left
  timeSpent: integer('time_spent').notNull().default(0), // Actual time logged

  // Story points (for agile)
  storyPoints: integer('story_points'),

  // Complexity
  complexity: text('complexity'), // 'simple', 'medium', 'complex', 'very_complex'
  complexityScore: integer('complexity_score'), // 1-10 scale

  // Effort breakdown
  effortBreakdown: jsonb('effort_breakdown').default('{}'),
  /**
   * Example:
   * {
   *   "development": 480,  // 8 hours
   *   "testing": 120,      // 2 hours
   *   "review": 60         // 1 hour
   * }
   */

  // Estimation metadata
  estimatedBy: text('estimated_by').references(() => users.id),
  estimatedAt: timestamp('estimated_at'),
  estimationConfidence: integer('estimation_confidence'), // 0-100

  // Auto-calculation
  autoCalculated: boolean('auto_calculated').notNull().default(false), // Calculated by AI
  calculationModel: text('calculation_model'), // 'historical_average', 'ai_prediction'

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Team Allocation - Project team assignments
 */
export const teamAllocations = pgTable('team_allocations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Allocation details
  role: text('role').notNull(), // 'developer', 'designer', 'qa', 'product_owner', 'scrum_master'
  allocationPercentage: integer('allocation_percentage').notNull(), // 0-100
  hoursPerWeek: decimal('hours_per_week', { precision: 10, scale: 2 }),

  // Time period
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'), // null = ongoing

  // Status
  isActive: boolean('is_active').notNull().default(true),

  // Notes
  notes: text('notes'),

  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Capacity Planning - Future capacity forecasts
 */
export const capacityForecasts = pgTable('capacity_forecasts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  // Forecast period
  forecastDate: timestamp('forecast_date').notNull(), // Week start date
  weekNumber: integer('week_number').notNull(), // Week of year
  year: integer('year').notNull(),

  // Team capacity
  totalTeamMembers: integer('total_team_members').notNull(),
  availableHours: decimal('available_hours', { precision: 10, scale: 2 }).notNull(),
  allocatedHours: decimal('allocated_hours', { precision: 10, scale: 2 }).notNull(),
  remainingCapacity: decimal('remaining_capacity', { precision: 10, scale: 2 }).notNull(),

  // Project breakdown
  projectForecasts: jsonb('project_forecasts').default('[]'),
  /**
   * Example:
   * [{
   *   "projectId": "uuid",
   *   "projectName": "Project A",
   *   "requiredHours": 120,
   *   "assignedMembers": 3,
   *   "isOverAllocated": false
   * }]
   */

  // Risk indicators
  isOverCapacity: boolean('is_over_capacity').notNull().default(false),
  capacityRisk: text('capacity_risk'), // 'low', 'medium', 'high'
  riskReasons: jsonb('risk_reasons').default('[]'),

  // AI predictions
  predictedVelocity: decimal('predicted_velocity', { precision: 10, scale: 2 }),
  confidenceScore: integer('confidence_score'), // 0-100

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Smart Assignment Rules - AI-powered assignment configuration
 */
export const smartAssignmentRules = pgTable('smart_assignment_rules', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),

  // Rule configuration
  name: text('name').notNull(),
  description: text('description'),
  enabled: boolean('enabled').notNull().default(true),

  // Assignment criteria
  considerWorkload: boolean('consider_workload').notNull().default(true),
  considerSkills: boolean('consider_skills').notNull().default(true),
  considerTimezone: boolean('consider_timezone').notNull().default(false),
  considerAvailability: boolean('consider_availability').notNull().default(true),
  considerPastPerformance: boolean('consider_past_performance').notNull().default(false),

  // Constraints
  maxAssignmentsPerDay: integer('max_assignments_per_day').default(5),
  maxWorkloadPercentage: integer('max_workload_percentage').default(100),
  preferredSkillLevel: integer('preferred_skill_level').default(3), // 1-5

  // Weights (for scoring algorithm)
  weights: jsonb('weights').default('{}'),
  /**
   * Example:
   * {
   *   "workload": 0.4,      // 40% weight
   *   "skills": 0.3,        // 30% weight
   *   "availability": 0.2,  // 20% weight
   *   "timezone": 0.1       // 10% weight
   * }
   */

  // Fallback behavior
  fallbackAssignee: text('fallback_assignee').references(() => users.id), // If no match found
  notifyOnAutoAssign: boolean('notify_on_auto_assign').notNull().default(true),

  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

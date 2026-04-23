import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * User Appearance Settings - per-user cross-device theme preferences
 *
 * One row per user. Mirrors the fields in the client-side Zustand theme store
 * (`apps/web/src/lib/stores/theme-store.ts`) plus the next-themes color mode
 * (`theme`, e.g. 'light' | 'dark' | 'system'). All preference fields are
 * nullable so the client can leave them unset and fall back to its own
 * defaults; `animationsEnabled` and `gradientsEnabled` default to true because
 * they reflect explicit user toggles with boolean semantics.
 */
export const userAppearanceSettings = pgTable('user_appearance_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),

  // next-themes color mode: 'light' | 'dark' | 'system'
  theme: text('theme'),

  // Zustand store: ColorTheme ('default' | 'ocean' | 'forest' | 'sunset' | 'purple' | 'rose')
  colorTheme: text('color_theme'),

  // Zustand store: VisualStyle ('modern' | 'minimal' | 'glass')
  visualStyle: text('visual_style'),

  // Zustand store: enableAnimations
  animationsEnabled: boolean('animations_enabled').notNull().default(true),

  // Zustand store: enableGradients
  gradientsEnabled: boolean('gradients_enabled').notNull().default(true),

  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type UserAppearanceSettings = typeof userAppearanceSettings.$inferSelect;
export type NewUserAppearanceSettings = typeof userAppearanceSettings.$inferInsert;

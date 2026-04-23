-- Cross-device appearance settings. One row per user, mirroring the client-side
-- Zustand theme store plus the next-themes color mode. The client keeps
-- localStorage as a fast cache but the server row wins on hydration.

CREATE TABLE IF NOT EXISTS "user_appearance_settings" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "theme" text,
  "color_theme" text,
  "visual_style" text,
  "animations_enabled" boolean DEFAULT true NOT NULL,
  "gradients_enabled" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  CREATE TYPE "conversation_room_kind" AS ENUM (
    'channel',
    'issue_thread',
    'document_thread'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "call_session_status" AS ENUM (
    'active',
    'ended'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'chat.channel_created';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'chat.channel_updated';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'chat.channel_deleted';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'chat.message_created';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'chat.message_updated';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'chat.message_deleted';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'chat.call_started';
ALTER TYPE "audit_log_action" ADD VALUE IF NOT EXISTS 'chat.call_ended';

ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "can_browse_chat" varchar(5) DEFAULT 'true' NOT NULL;
ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "can_create_channels" varchar(5) DEFAULT 'false' NOT NULL;
ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "can_post_messages" varchar(5) DEFAULT 'true' NOT NULL;
ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "can_moderate_messages" varchar(5) DEFAULT 'false' NOT NULL;
ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "can_start_calls" varchar(5) DEFAULT 'false' NOT NULL;
ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "can_manage_calls" varchar(5) DEFAULT 'false' NOT NULL;

CREATE TABLE IF NOT EXISTS "project_channels" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "project_id" text NOT NULL,
  "name" varchar(120) NOT NULL,
  "slug" varchar(80) NOT NULL,
  "description" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "is_archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_by" text NOT NULL,
  "updated_by" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "conversation_rooms" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "project_id" text NOT NULL,
  "kind" "conversation_room_kind" NOT NULL,
  "channel_id" text,
  "issue_id" text,
  "document_page_id" text,
  "title" varchar(255),
  "last_message_at" timestamp,
  "last_activity_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_by" text NOT NULL,
  "updated_by" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "project_id" text NOT NULL,
  "room_id" text NOT NULL,
  "parent_message_id" text,
  "body" text DEFAULT '' NOT NULL,
  "body_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "mentions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "edited_at" timestamp,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_by" text NOT NULL,
  "updated_by" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "chat_message_reactions" (
  "id" text PRIMARY KEY NOT NULL,
  "message_id" text NOT NULL,
  "emoji" varchar(32) NOT NULL,
  "user_id" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "room_read_states" (
  "id" text PRIMARY KEY NOT NULL,
  "room_id" text NOT NULL,
  "user_id" text NOT NULL,
  "last_read_message_id" text,
  "last_read_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "call_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "project_id" text NOT NULL,
  "room_id" text NOT NULL,
  "livekit_room_name" varchar(255) NOT NULL,
  "status" "call_session_status" DEFAULT 'active' NOT NULL,
  "started_by" text NOT NULL,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "ended_at" timestamp,
  "ended_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "call_participants" (
  "id" text PRIMARY KEY NOT NULL,
  "call_session_id" text NOT NULL,
  "user_id" text NOT NULL,
  "joined_at" timestamp DEFAULT now() NOT NULL,
  "left_at" timestamp,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "project_channels"
    ADD CONSTRAINT "project_channels_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "project_channels"
    ADD CONSTRAINT "project_channels_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "project_channels"
    ADD CONSTRAINT "project_channels_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "project_channels"
    ADD CONSTRAINT "project_channels_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "conversation_rooms"
    ADD CONSTRAINT "conversation_rooms_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "conversation_rooms"
    ADD CONSTRAINT "conversation_rooms_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "conversation_rooms"
    ADD CONSTRAINT "conversation_rooms_channel_id_project_channels_id_fk"
    FOREIGN KEY ("channel_id") REFERENCES "project_channels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "conversation_rooms"
    ADD CONSTRAINT "conversation_rooms_issue_id_issues_id_fk"
    FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "conversation_rooms"
    ADD CONSTRAINT "conversation_rooms_document_page_id_document_pages_id_fk"
    FOREIGN KEY ("document_page_id") REFERENCES "document_pages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "conversation_rooms"
    ADD CONSTRAINT "conversation_rooms_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "conversation_rooms"
    ADD CONSTRAINT "conversation_rooms_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_room_id_conversation_rooms_id_fk"
    FOREIGN KEY ("room_id") REFERENCES "conversation_rooms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_parent_message_id_chat_messages_id_fk"
    FOREIGN KEY ("parent_message_id") REFERENCES "chat_messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "chat_message_reactions"
    ADD CONSTRAINT "chat_message_reactions_message_id_chat_messages_id_fk"
    FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "chat_message_reactions"
    ADD CONSTRAINT "chat_message_reactions_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "room_read_states"
    ADD CONSTRAINT "room_read_states_room_id_conversation_rooms_id_fk"
    FOREIGN KEY ("room_id") REFERENCES "conversation_rooms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "room_read_states"
    ADD CONSTRAINT "room_read_states_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "room_read_states"
    ADD CONSTRAINT "room_read_states_last_read_message_id_chat_messages_id_fk"
    FOREIGN KEY ("last_read_message_id") REFERENCES "chat_messages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "call_sessions"
    ADD CONSTRAINT "call_sessions_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "call_sessions"
    ADD CONSTRAINT "call_sessions_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "call_sessions"
    ADD CONSTRAINT "call_sessions_room_id_conversation_rooms_id_fk"
    FOREIGN KEY ("room_id") REFERENCES "conversation_rooms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "call_sessions"
    ADD CONSTRAINT "call_sessions_started_by_users_id_fk"
    FOREIGN KEY ("started_by") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "call_sessions"
    ADD CONSTRAINT "call_sessions_ended_by_users_id_fk"
    FOREIGN KEY ("ended_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "call_participants"
    ADD CONSTRAINT "call_participants_call_session_id_call_sessions_id_fk"
    FOREIGN KEY ("call_session_id") REFERENCES "call_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "call_participants"
    ADD CONSTRAINT "call_participants_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "project_channel_project_slug_idx" ON "project_channels" USING btree ("project_id", "slug");
CREATE INDEX IF NOT EXISTS "project_channel_project_position_idx" ON "project_channels" USING btree ("project_id", "position");
CREATE INDEX IF NOT EXISTS "project_channel_project_archived_idx" ON "project_channels" USING btree ("project_id", "is_archived");
CREATE INDEX IF NOT EXISTS "project_channel_organization_idx" ON "project_channels" USING btree ("organization_id");

CREATE UNIQUE INDEX IF NOT EXISTS "conversation_room_channel_idx" ON "conversation_rooms" USING btree ("channel_id");
CREATE UNIQUE INDEX IF NOT EXISTS "conversation_room_issue_idx" ON "conversation_rooms" USING btree ("issue_id");
CREATE UNIQUE INDEX IF NOT EXISTS "conversation_room_document_idx" ON "conversation_rooms" USING btree ("document_page_id");
CREATE INDEX IF NOT EXISTS "conversation_room_project_kind_idx" ON "conversation_rooms" USING btree ("project_id", "kind");
CREATE INDEX IF NOT EXISTS "conversation_room_organization_idx" ON "conversation_rooms" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "conversation_room_last_activity_idx" ON "conversation_rooms" USING btree ("project_id", "last_activity_at");

CREATE INDEX IF NOT EXISTS "chat_message_room_created_idx" ON "chat_messages" USING btree ("room_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_message_room_parent_idx" ON "chat_messages" USING btree ("room_id", "parent_message_id");
CREATE INDEX IF NOT EXISTS "chat_message_project_idx" ON "chat_messages" USING btree ("project_id");
CREATE INDEX IF NOT EXISTS "chat_message_organization_idx" ON "chat_messages" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "chat_message_deleted_idx" ON "chat_messages" USING btree ("deleted_at");

CREATE UNIQUE INDEX IF NOT EXISTS "chat_message_reaction_message_emoji_user_idx" ON "chat_message_reactions" USING btree ("message_id", "emoji", "user_id");
CREATE INDEX IF NOT EXISTS "chat_message_reaction_message_idx" ON "chat_message_reactions" USING btree ("message_id");
CREATE INDEX IF NOT EXISTS "chat_message_reaction_user_idx" ON "chat_message_reactions" USING btree ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "room_read_state_room_user_idx" ON "room_read_states" USING btree ("room_id", "user_id");
CREATE INDEX IF NOT EXISTS "room_read_state_user_idx" ON "room_read_states" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "call_session_room_status_idx" ON "call_sessions" USING btree ("room_id", "status");
CREATE INDEX IF NOT EXISTS "call_session_project_status_idx" ON "call_sessions" USING btree ("project_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "call_session_livekit_room_idx" ON "call_sessions" USING btree ("livekit_room_name");

CREATE INDEX IF NOT EXISTS "call_participant_call_idx" ON "call_participants" USING btree ("call_session_id");
CREATE INDEX IF NOT EXISTS "call_participant_user_idx" ON "call_participants" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "call_participant_active_idx" ON "call_participants" USING btree ("call_session_id", "left_at");

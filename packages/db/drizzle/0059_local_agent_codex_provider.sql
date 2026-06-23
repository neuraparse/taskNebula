-- Local server agent runner beta.
--
-- Adds OpenAI Codex as a first-class agent-session provider so issues can be
-- assigned to @codex and dispatched through the same agent_sessions lifecycle
-- used by Claude/Cursor/Devin/Copilot.

ALTER TYPE "agent_session_provider" ADD VALUE IF NOT EXISTS 'codex';

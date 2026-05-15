-- Issue description rich content (P1-09 follow-up).
--
-- Tiptap + Yjs collaborative descriptions previously snapshotted the
-- ProseMirror state to `issues.description` via `editor.getText()` —
-- discarding every bit of formatting (lists, bold, links, code blocks).
-- A new column carries the structured ProseMirror JSON so the static
-- (non-collab) read path can rebuild the rich rendering, while
-- `issues.description` stays as the plain-text fallback that existing
-- callers (search indexing, AI prompts, exports) already understand.
--
-- Column is nullable: rows without a rich snapshot keep using the plain
-- text path.  The JSONB shape is `{ type: 'doc', content: [...] }` —
-- exactly what `editor.getJSON()` emits and what `editor.commands.setContent()`
-- consumes.

ALTER TABLE "issues"
  ADD COLUMN IF NOT EXISTS "description_rich" jsonb;

-- NO-OP: llm_call_audit is created by 0033_ai_cost_guard with a richer
-- schema (organization_id, provider, cached_tokens, feature, errorMessage,
-- INSERT-only triggers, etc.). This migration is kept in the journal as a
-- placeholder so the idx sequence stays contiguous after the 2026-05
-- worktree merge.
SELECT 1;

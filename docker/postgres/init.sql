-- Enable required PostgreSQL extensions
-- This script runs automatically on first container startup

-- Enable pgvector extension for AI semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_stat_statements for query-level observability (OBS-35).
-- Requires `shared_preload_libraries=pg_stat_statements` (see docker-compose
-- command override). Without that load the CREATE EXTENSION succeeds but the
-- view will be empty, so the docs warn operators to verify with:
--   SELECT count(*) FROM pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Verify extensions are installed
SELECT extname, extversion
  FROM pg_extension
 WHERE extname IN ('vector', 'pg_stat_statements');

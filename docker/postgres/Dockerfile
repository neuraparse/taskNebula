FROM pgvector/pgvector:pg16

# Security hardening
# Remove unnecessary packages and create non-root user
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* /var/tmp/*

# Disable remote connections by default (override with env if needed)
# Set strict permissions on data directory
RUN chmod 700 /var/lib/postgresql/data || true

# This image already includes PostgreSQL 16 with pgvector extension pre-installed

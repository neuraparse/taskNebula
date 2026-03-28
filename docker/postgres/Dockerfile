FROM pgvector/pgvector:pg16

# Security hardening
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* /var/tmp/*

RUN chmod 700 /var/lib/postgresql/data || true

# This image already includes PostgreSQL 16 with pgvector extension pre-installed

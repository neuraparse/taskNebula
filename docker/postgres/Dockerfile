FROM pgvector/pgvector:pg16

# Security hardening
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* /var/tmp/*

RUN chmod 700 /var/lib/postgresql/data || true

# Custom entrypoint: fixes scram-sha-256 → md5 on every start
COPY docker-entrypoint-override.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint-override.sh
ENTRYPOINT ["docker-entrypoint-override.sh"]
CMD ["postgres"]

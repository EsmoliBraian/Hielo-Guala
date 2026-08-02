#!/bin/bash
# Dumps the production database and prunes backups older than 14 days.
# Runs daily via cron on the server (see docs/DEPLOY.md) — not used in local dev.
set -e
cd "$(dirname "$0")/.."
USER=$(grep '^POSTGRES_USER=' .env | cut -d= -f2)
DB=$(grep '^POSTGRES_DB=' .env | cut -d= -f2)
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p backups
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U "$USER" "$DB" > "backups/hielo_guala-$STAMP.sql"
find backups -name 'hielo_guala-*.sql' -mtime +14 -delete

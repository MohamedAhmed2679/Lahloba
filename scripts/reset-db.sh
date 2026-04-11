#!/usr/bin/env bash
echo "Resetting Lahloba database..."
docker compose exec -T postgres psql -U lahloba -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" -d lahloba
docker compose exec -T postgres psql -U lahloba -d lahloba -f /docker-entrypoint-initdb.d/001_init.sql
docker compose cp packages/db/migrations/002_improvements.sql postgres:/tmp/002.sql
docker compose exec -T postgres psql -U lahloba -d lahloba -f /tmp/002.sql
docker compose cp packages/db/seeds/seed.sql postgres:/tmp/seed.sql
docker compose exec -T postgres psql -U lahloba -d lahloba -f /tmp/seed.sql
echo "✅ Database reset complete"

#!/usr/bin/env bash
# CI helper: migrate + seed a throwaway database and start the API with the DEV identity stub.
# Never use outside CI/local development.
set -euo pipefail
export LAHLOBA_ENV=development
export DATABASE_URL="${DATABASE_URL:?DATABASE_URL required}"
export API_HOST=0.0.0.0 API_PORT=4000 CORS_ORIGINS="*"
export IDENTITY_PROVIDER=dev-stub LAHLOBA_DEV_IDENTITY_STUB=true
export DEV_STUB_SIGNING_SECRET="ci-only-dev-stub-secret-$(date +%s)-padding-padding"
export EVIDENCE_STORAGE=dev-metadata-only
pnpm db:migrate
pnpm db:seed:dev
nohup pnpm --filter @lahloba/api run start > "${RUNNER_TEMP:-/tmp}/api.log" 2>&1 &
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:4000/v1/health >/dev/null; then echo "API up"; exit 0; fi
  sleep 2
done
echo "API failed to start"; cat "${RUNNER_TEMP:-/tmp}/api.log"; exit 1

#!/usr/bin/env bash
# CI helper: migrate + seed a throwaway database and start the API with the DEV identity stub.
# Never use outside CI/local development.
set -euo pipefail
export LAHLOBA_ENV=development
export DATABASE_URL="${DATABASE_URL:?DATABASE_URL required}"
export API_HOST=0.0.0.0 API_PORT=4000 CORS_ORIGINS="*"
export IDENTITY_PROVIDER=dev-stub LAHLOBA_DEV_IDENTITY_STUB=true
export DEV_STUB_SIGNING_SECRET="ci-only-dev-stub-secret-$(date +%s)-padding-padding"
# Real private uploads on the runner's disk (local-disk is refused outside development/test).
export EVIDENCE_STORAGE=local-disk STORAGE_LOCAL_DIR="${RUNNER_TEMP:-/tmp}/lahloba-evidence"
export STORAGE_SIGNING_SECRET="ci-only-storage-secret-$(date +%s)-padding-padding"
# Sandbox payment simulator: no real money; refused in production.
export PAYMENTS_PROVIDER=simulator PAYMENTS_SIMULATOR_SECRET="ci-only-payments-secret-$(date +%s)-padding"
export HANDOFF_CODE_SECRET="ci-only-handoff-secret-$(date +%s)-padding-padding"
pnpm db:migrate
pnpm db:seed:dev
nohup pnpm --filter @lahloba/api run start > "${RUNNER_TEMP:-/tmp}/api.log" 2>&1 &
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:4000/v1/health >/dev/null; then echo "API up"; exit 0; fi
  sleep 2
done
echo "API failed to start"; cat "${RUNNER_TEMP:-/tmp}/api.log"; exit 1

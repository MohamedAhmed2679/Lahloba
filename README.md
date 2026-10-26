# Lahloba — home-cooked food, ordered fairly

> **Status: staging-ready sandbox, NOT production.** Payments use a sandbox simulator (no real
> money). Sample partners and prices are fictional and labelled "(sample)". Exact list of what is
> and isn't production-ready: [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md).

Implements the blueprint's Slices 1–4 end to end: catalog and discovery, Clerk sign-in, partner
onboarding with private document upload, kitchen capacity, server-priced quotes with shop-basket
comparison, orders, sandbox split payments with refunds, chef/shop/courier fulfilment with handoff
codes, and two-leg delivery tracking on OpenStreetMap. Story mapping:
[`docs/TRACEABILITY.md`](docs/TRACEABILITY.md). Verification: [`docs/VERIFICATION.md`](docs/VERIFICATION.md).

## Layout

```text
apps/api/          Fastify /v1 API, SQL migrations, identity adapters, dev seed, integration tests
apps/worker/       Transactional-outbox worker (SKIP LOCKED leases, backoff, dead-letter)
apps/customer/     Expo (iOS/Android/web) customer app: discovery, checkout, sandbox payment, order tracking
apps/partner/      Expo partner app: applications + documents, chef orders/kitchen times/menu, shop orders, courier jobs
apps/operations/   Operations console (Vite + React, Clerk): verification queue with private document viewing
packages/app-shell/ Shared app plumbing: Clerk/dev sign-in, device storage, brand fonts, OpenStreetMap view
packages/domain/   Money (integer piastres), portions, quotes, state guards, facets, authorization policy
packages/contracts/ Zod API contracts + typed API client
packages/i18n/     Arabic/English resources, RTL, money/quantity formatting
packages/ui/       Brand tokens (light/dark), drawn logos and icons, accessible React Native primitives
packages/config/   Typed server configuration with dev/staging/production separation
```

## Prerequisites

- Node.js 22.13+ (tested with 22.22.0) and pnpm 10.28 (`corepack enable` then `corepack prepare pnpm@10.28.0 --activate`)
- PostgreSQL 16 for local development and tests (tested with 16.15). A throwaway server is fine.

## First run (development)

```bash
pnpm install
cp .env.example .env            # Windows PowerShell: Copy-Item .env.example .env
# Edit .env: DATABASE_URL, DEV_STUB_SIGNING_SECRET (32+ chars). Keep LAHLOBA_ENV=development.
```

Load `.env` into your shell (the apps read `process.env`; nothing loads `.env` automatically):

```bash
set -a; . ./.env; set +a                     # bash/zsh
# PowerShell:
# Get-Content .env | ? { $_ -match '^\s*[^#].*=' } | % { $k,$v = $_ -split '=',2; Set-Item "env:$k" $v }
```

Then:

```bash
pnpm db:migrate          # apply migrations (checksummed; refuses edited migrations)
pnpm db:seed:dev         # ILLUSTRATIVE sample data — refuses outside development/test
pnpm dev:api             # http://127.0.0.1:4000  (binds to localhost by default)
pnpm dev:worker          # outbox worker (notifications adapter is disabled and says so)
pnpm dev:customer        # Expo web for the customer app (press i/a for simulators)
pnpm dev:partner         # Expo web for the partner app
pnpm dev:operations      # http://127.0.0.1:5173 operations console
```

Development sign-in (partner app and operations console) uses the **dev identity stub**, which the
server refuses to start outside `development`/`test`. Seeded subjects: `sample-chef-a`,
`sample-chef-b`, `sample-supplier`, `sample-ops-reviewer`. Any other subject creates a new customer
account. To make another dev user an operations reviewer:
`pnpm --filter @lahloba/api ops:grant:dev <subject>` (development only).

## Tests

```bash
pnpm typecheck
TEST_DATABASE_ADMIN_URL=postgres://postgres@127.0.0.1:5432/postgres pnpm test
```

`TEST_DATABASE_ADMIN_URL` must point at a **throwaway** server and a role allowed to
`CREATE/DROP DATABASE`: every API/worker test file creates and drops its own uniquely named
database. Without it, database tests are reported as *skipped*, never as passed.

Web builds: `pnpm build:web` (Expo web export for both apps + Vite build for operations).
Native builds and on-device tests run in GitHub Actions (`.github/workflows/native.yml`): release
Android APKs on an emulator and iOS Simulator builds, each exercised with Maestro (`.maestro/`).

## Deployment (Vercel)

Four Vercel projects from this repository, each with its own root directory:

| Project | Root | Notes |
|---|---|---|
| API | `apps/api` | Bundled Fastify function; build runs migrations (and the illustrative seed when `LAHLOBA_SEED_ILLUSTRATIVE=true`, never in production). Cron calls `/v1/internal/sweep` every 5 minutes with `CRON_SECRET`. |
| Customer web | `apps/customer` | Expo web export. `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. |
| Partner web | `apps/partner` | Same variables as customer. |
| Operations | `apps/operations` | `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`. |

API environment (staging): `LAHLOBA_ENV=staging`, `DATABASE_URL` (Neon), `IDENTITY_PROVIDER=clerk`,
`CLERK_PUBLISHABLE_KEY`, `CLERK_AUTHORIZED_PARTIES` (the three web origins), `CORS_ORIGINS`,
`EVIDENCE_STORAGE=vercel-blob` (private store), `STORAGE_SIGNING_SECRET`, `PUBLIC_API_URL`,
`PAYMENTS_PROVIDER=simulator`, `PAYMENTS_SIMULATOR_SECRET`, `HANDOFF_CODE_SECRET`, `CRON_SECRET`.
Make a signed-in Clerk user an operations reviewer on staging:
`pnpm --filter @lahloba/api ops:grant clerk:<user id>`.

## Security notes

- The API derives identity only from a verified bearer token; roles come from the database.
  Every chef/supplier/ops route enforces scoped membership server-side (cross-role tests included).
- Exact kitchen/branch addresses and evidence object keys never appear in public or ops responses;
  public responses are serialized through contract schemas that strip unknown fields.
- `EXPO_PUBLIC_*` and `VITE_*` values ship inside client bundles — never put secrets there.
- Do not expose the API publicly with the dev identity stub. Rate limiting is per client IP; set
  Fastify `trustProxy` appropriately before running behind a proxy.

# Lahloba — Slice 1 foundation

> **Status: development foundation, NOT production-ready.** No live payments, no real identity
> provider wired into the clients, no private evidence storage, no deployment. Sample data is
> fictional and labelled. See [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md).

This repository implements **Slice 1 (repository, identity and catalog foundation)** from the
Lahloba blueprint (`prompts/01_FOUNDATION.md`): stories C01–C05, C23, H01–H03, S01–S02, D01 and
O01 foundations. Story-to-code mapping: [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md).
Architecture decisions: [`docs/adr/0001-slice-1-foundation.md`](docs/adr/0001-slice-1-foundation.md).
Verified results: [`docs/VERIFICATION.md`](docs/VERIFICATION.md).

## Layout

```text
apps/api/          Fastify /v1 API, SQL migrations, identity adapters, dev seed, integration tests
apps/worker/       Transactional-outbox worker (SKIP LOCKED leases, backoff, dead-letter)
apps/customer/     Expo (iOS/Android/web) customer app: area, entry cards, results, chef, dish, groceries, learn
apps/partner/      Expo partner app: role switcher, chef/supplier/courier applications, chef menu, supplier products
apps/operations/   Protected operations web console (Vite + React): partner verification queue
packages/domain/   Money (integer piastres), portions, quotes, state guards, facets, authorization policy
packages/contracts/ Zod API contracts + typed API client
packages/i18n/     Arabic/English resources, RTL, money/quantity formatting
packages/ui/       Replaceable neutral design tokens + accessible React Native primitives
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
Native iOS/Android builds were not run (see `docs/VERIFICATION.md`).

## Security notes

- The API derives identity only from a verified bearer token; roles come from the database.
  Every chef/supplier/ops route enforces scoped membership server-side (cross-role tests included).
- Exact kitchen/branch addresses and evidence object keys never appear in public or ops responses;
  public responses are serialized through contract schemas that strip unknown fields.
- `EXPO_PUBLIC_*` and `VITE_*` values ship inside client bundles — never put secrets there.
- Do not expose the API publicly with the dev identity stub. Rate limiting is per client IP; set
  Fastify `trustProxy` appropriately before running behind a proxy.

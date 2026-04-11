# Lahloba Architecture

## System Diagram
```
  Flutter App (iOS/Android)
        │
        ▼
  NestJS API (Fastify) ──── PostgreSQL 16
        │                        │
        ├── Redis (cache/presence/dedupe)
        │
        ├── Kafka (events)
        │      │
        │      ├── Realtime Gateway (Socket.io)
        │      └── Push Service (FCM/APNs)
        │
        └── MinIO (S3-compat media)
```

## Key Patterns

**Outbox Pattern**: Domain events written to `outbox_events` table in same
transaction. Dispatcher polls PENDING → publishes to Kafka → marks DISPATCHED.

**Dual Delivery Runs**: `INGREDIENT_RUN` (stores→chef) + `MEAL_RUN` (chef→customer).
Each run has OTP-verified stops.

**Push Decision Engine**: Redis-backed throttle (90s), burst summary (≥3/90s),
dedupe (24h), foreground suppression (WS presence check).

**Money**: All amounts in minor units (piasters). `64000 = 640.00 EGP`.

**Ingredient Combos**: Pre-computed CHEAPEST (min cost) vs FASTEST (min stops/ETA).

## Security
- JWT (15min access + 30d refresh) with RBAC
- OTP auth (phone/email), dev bypass: `000000`
- Idempotency keys on sensitive POSTs
- Rate limiting 60/min, Helmet headers, input validation

## Database
25+ tables, JSONB pricing, GIN indexes, outbox for reliable events.
See `packages/db/migrations/001_init.sql`.

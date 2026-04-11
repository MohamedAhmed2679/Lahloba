# Lahloba — Home-Made Meal Marketplace

Bold & Energetic · Transparent Ingredient Sourcing · Live Tracking · Chat

## Quick Start

```bash
cp .env.example .env
docker compose up -d
psql $DATABASE_URL < packages/db/migrations/001_init.sql
psql $DATABASE_URL < packages/db/seeds/seed.sql
cd apps/api && npm install && npm run dev         # :3000
cd apps/realtime-gateway && npm install && npm run dev  # :3001
cd apps/mobile && flutter pub get && flutter run  # iOS/Android
cd apps/admin-web && npm install && npm run dev    # :3002
```

## Structure

```
apps/mobile          Flutter (iOS + Android)
apps/admin-web       Next.js 14 Admin Dashboard
apps/api             NestJS + Fastify REST API
apps/realtime-gateway Socket.io WebSocket server
apps/push-service    FCM/APNs push with decision engine
packages/design-system Tokens (colors, type, spacing, motion)
packages/shared      Events, types, push templates (EN/AR)
packages/db          Prisma schema, SQL migrations, seed data
docs/                API, architecture, testing, deployment
```

## Brand Tokens

Primary #0F766E (Teal) · Secondary #F59E0B (Amber)
Error #F43F5E (Coral) · Success #65A30D (Lime)
Radius 18px · Motion 220ms · Font: Cairo

## Roles

Customer · Chef · Delivery Partner · Store · Admin

## Key Features

- Dual delivery runs (ingredients + meal)
- OTP handoffs at every stop
- Push decision engine (throttle/burst/dedupe/foreground)
- Outbox pattern for reliable events
- Ingredient combos (Cheapest vs Fastest)
- i18n: English + Arabic (RTL)
- Light/Dark theme

## Docs

See docs/architecture, docs/api, docs/testing, docs/guides

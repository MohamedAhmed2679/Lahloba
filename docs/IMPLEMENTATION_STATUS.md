# Implementation status — after Slice 1

## Implemented and tested

- Monorepo with typed config (dev/test/staging/production separation, fail-closed rules).
- PostgreSQL schema (2 migrations, reversible): users, scoped role memberships, partner
  applications with private evidence references, chefs/suppliers/couriers, service areas, private
  addresses, normalized facets + aliases + collections, ingredients with allergen data status,
  dishes, immutable published recipe versions/BOM, offer variants with price history, supplier
  products and stock balances, append-only audit, transactional outbox, idempotency records.
- `/v1` API: public catalog (areas, facets, offers with facet counts + cursor pagination, chef
  profile, offer detail, groceries, learning), identity (`/me`), partner applications, evidence
  references, operations review, chef menu (dish, recipe version, variant, pricing, publish,
  availability), supplier branches/products, dev-only token issuance.
- Outbox worker with leases, backoff and dead-lettering.
- Customer app (Expo, web export verified): area selection with optional location, five entry
  cards, results with independent filters, chef profile, dish/variant detail with servings and
  ingredient transparency, groceries by category, recipes. Arabic/English with RTL.
- Partner app (Expo, web export verified): dev sign-in, explicit role switcher, chef/supplier/courier
  applications, evidence reference, chef menu drafts, supplier product publishing.
- Operations console (Vite): verification queue, evidence metadata, approve/reject with reason.

## Unimplemented production integrations (exact list)

| Integration | Current state |
|---|---|
| Identity provider (OIDC) | Server-side JWT/JWKS verification adapter exists and is unit-tested with a local JWKS. **Not connected to any provider; no client login flow (PKCE) in apps.** |
| Customer sign-in | None. Customer browsing is anonymous in Slice 1. |
| Private evidence/media storage | Port only; modes `disabled` / `dev-metadata-only`. No upload, signed URLs, malware scan or metadata stripping. |
| Notifications (SMS/push/email) | Disabled adapter; worker records `NOTIFICATION_ADAPTER_DISABLED`. |
| Payments, refunds, ledger, settlement | Not started (Slice 3). No payment code exists. |
| Maps / geocoding / routing / geospatial | Not started; location only shows a hint. PostGIS not used. |
| Dispatch / courier jobs | Not started (Slice 4). |
| Session persistence on device | Tokens and selected area are in memory; a reload loses them. |
| Deployment, secrets manager, TLS, backups, monitoring | Not started; hosting provider undecided. CI workflow file is provided but has not been executed. |
| Production ops-role provisioning | Only a development CLI (`ops:grant:dev`). Needs a reviewed, dual-approval procedure. |

## Known limitations

- "Full" chefs are not excluded from results because capacity (H04) is a later story.
- Partner UI covers drafts only: variant, recipe-version and publish actions exist in the API but
  not yet as screens.
- Supplier staff invitations (branch-scoped `SUPPLIER_STAFF`) are modelled and enforced but there is
  no invite flow.
- Evidence expiry is stored and indexed but no job blocks work on expiry yet.
- Idempotency records expire after 24 h but no cleanup job is scheduled.
- Large-text support relies on `allowFontScaling` and flexible layouts; it has not been checked on
  devices. Screen-reader behaviour has not been checked with VoiceOver/TalkBack.
- Arabic copy is a proposed draft and needs native copy review; labels like "Vegetarian (declared by
  chef)" deliberately avoid verification claims.
- Rate limiting is per IP and in-memory (single process).

## Decision log

See `docs/adr/0001-slice-1-foundation.md`. Blueprint decisions still open (doc 07) are unchanged:
funds flow, tariff distance bands, ingredient-trip eligibility, home-kitchen legality, partner
verification criteria, hosting/residency.

## Next recommended slice: Slice 2 — quotes and checkout (prompt 02)

Checklist before starting:
- [ ] Founder decisions: tariff bands for 20–75 EGP, ingredient-trip eligibility limits, quote TTL.
- [ ] Choose geospatial approach (PostGIS) and a routing/eligibility source.
- [ ] Pick the identity provider; implement customer sign-in (PKCE) before checkout.
- [ ] Capacity model (H04) and inventory reservations (S03) with concurrency tests.
- [ ] Partner UI for variants/recipes/publish (API already exists).
- [ ] Persist selected area and drafts on device (C24).

# Implementation status — Slices 1–4 (sandbox)

Everything below runs end to end against PostgreSQL in automated tests. Money never moves:
the only payment provider is a **sandbox simulator**, refused when `LAHLOBA_ENV=production`.

## Implemented and tested

**Platform**
- Monorepo, typed config with fail-closed rules per environment (dev/test/staging/production).
- PostgreSQL, 5 reversible migrations: identity and scoped roles; partners and private evidence;
  catalog (facets, recipes/BOM, offers, price history, supplier products, stock); kitchen capacity
  (work units per slot, overlap exclusion); area coordinates and delivery tariffs; quotes
  (immutable snapshot), orders with independent fulfilment / funding / chef-acceptance states,
  inventory holds, supplier sub-orders, per-recipient payment allocations and attempts, provider
  events (de-duplicated), refunds, double-entry ledger (balance checked at commit), delivery legs,
  stops and hashed handoff codes, chef ingredient acceptance.
- Idempotency for every mutation, append-only audit, transactional outbox, worker with leases.
- Scheduled sweep: expires quotes and unpaid holds, cancels on partner deadlines (with refunds),
  reconciles unanswered payments. Runs in the worker and as a Vercel Cron route.

**Sign-in** — Clerk (one-time codes by phone or email) in the customer and partner apps and the
operations console; the API verifies Clerk session tokens (RS256, issuer, authorized parties).
The development identity stub still exists for local work and CI and is refused elsewhere.

**Documents** — partners upload PDF/JPEG/PNG (≤ 4 MB) per required document from files, photos
or the camera. The API checks the real file signature, strips photo metadata (EXIF/GPS, PNG text),
stores the file privately (local disk in dev/CI, private Vercel Blob when deployed) and records a
SHA-256. Reviewers open files only through 5-minute signed links; issuing and serving are audited.

**Kitchen capacity** — chefs open kitchen times with a work-unit capacity; offers show the next
times and the people each can still take; fully booked kitchens drop out of discovery and say so.

**Ordering (customer)** — choose who buys the ingredients and a kitchen time; the server prices
the cooking fee, packaging, ingredients (chef-supplied, or the cheapest complete basket across
shops with per-ingredient switching, pack maths and leftovers), the ingredient trip (20 EGP) and
the delivery fee (tariff table). Each line shows who it is paid to. Placing an order holds
capacity and stock for 30 minutes.

**Payments (sandbox)** — pay first. One attempt per recipient; a sandbox payment page offers
succeed / decline / timeout. Webhooks are HMAC-signed, verified and de-duplicated; timeouts are
reconciled, never retried blindly; partial failures can be retried for the failed recipient only;
refunds are automatic on any cancellation, including a late success on a cancelled order.

**Fulfilment** — chef accepts or declines (refund); shops confirm or reject (refund); an
ingredient run collects from every shop with each shop's code and hands over with the chef's code;
the chef checks the ingredients item by item (delivery is not acceptance); cooking requires
funding, confirmed capacity and accepted ingredients (also enforced by database checks); the meal
run is collected with the chef's code and delivered with the customer's code. Wrong codes lock
after five tries. Couriers see exact addresses only after claiming a job.

**Maps** — OpenStreetMap (Leaflet) in the customer order page and courier job cards. Only public,
approximate area centroids are drawn.

**Apps and branding** — the "Honest Ladle" brand kit is applied: colour tokens with dark mode,
Readex Pro / IBM Plex Sans (Arabic), drawn logo lockups, service icons, app icons and splash
screens, role colour strips. Area and language are remembered across restarts.

**Native** — GitHub Actions builds release Android APKs and iOS Simulator apps for both apps and
runs Maestro flows on an emulator/simulator against a real API and database (browse, servings,
Arabic, remembered area, sign-in, checkout, sandbox payment, chef workspace, courier jobs).
EAS cloud builds run when the `EXPO_TOKEN` secret is set.

## Not production-ready (exact list)

| Area | State |
|---|---|
| Real payments | Simulator only. A real provider (e.g. Paymob) adapter, merchant onboarding, payouts and settlement are not built. Funds-flow model is still an open founder decision. |
| Notifications | Disabled adapter (no SMS/push/email); partners must keep the app open to see orders. |
| Malware scanning of documents | Files are marked `NOT_SCANNED`; the console warns reviewers. |
| Live courier location | Tracking shows leg status on area-level points, not GPS. |
| Distance-based tariffs | Area-pair table with illustrative fees; distance bands are an open decision. |
| Ops roles in production | Staging CLI grant only; production needs a dual-approval procedure. |
| Screen readers on devices | Accessibility labels and roles are set; VoiceOver/TalkBack have not been run by a person. |
| Arabic copy | Draft; needs native review. |
| Store release | No signing certificates, store listings or production EAS profiles. |

## Open founder decisions (unchanged)

Funds flow and settlement timing; tariff distance bands; ingredient-trip eligibility limits;
cancellation policy after the cook accepts; home-kitchen legality; partner verification criteria;
hosting and data residency.

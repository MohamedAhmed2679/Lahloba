# Requirements traceability — Slice 1

Story IDs from the blueprint `docs/03_STORIES_AND_ACCEPTANCE.md`. "Foundation" means the slice
builds the groundwork the story needs; the full story completes in a later slice.

| Story | Scope in Slice 1 | API routes | Schema | Code | Tests |
|---|---|---|---|---|---|
| **C01** Choose area without GPS | Done | `GET /v1/areas`, `serviceability` on catalog routes | `service_areas`, `chef_service_areas`, `supplier_branch_service_areas` | `routes/public.ts`; `AreaSelectScreen`, `HomeScreen`; `expoLocation.ts` | catalog.test "C01…", screens.test "C01 area selection" (denied, granted-hint, network error), e2e |
| **C02** Choose eat/heat/cook/grocery/learn | Done (browse) | `/v1/catalog/offers?mode=`, `/v1/groceries/*`, `/v1/learn/recipes*` | `offer_variants.service_mode`, `recipe_versions.is_public_recipe` | `HomeScreen`, `ResultsScreen`, `GroceriesScreen`, `LearnScreens`; `domain/catalog.ts` | catalog.test "C02…", screens.test "C02 entry points" |
| **C03** Filter cuisine & dish independently | Done | `GET /v1/catalog/offers` (`cuisine[]`, `dishType[]`, `facetCounts`), `GET /v1/facets` | `facets`, `facet_aliases`, `collection_members`, `dish_facets` | `normalizeFacetLabel`, `resolveFacetLabels`; `ResultsScreen` | domain.test "facet normalization"; catalog.test "C03…"; screens.test "C03/C04 results" |
| **C04** Nearby chefs | Done except capacity ("full") | `GET /v1/catalog/offers`, `GET /v1/chefs/:id` | `chefs.status/accepting_orders`, `chef_service_areas` | `ELIGIBLE_CHEF`/`ELIGIBLE_OFFER_FROM` in `routes/public.ts` | catalog.test (closed kitchen, area, suspended, private address) |
| **C05** Choose a preparation variant | Done (view) | `GET /v1/offers/:id` (`siblingVariants`) | `offer_variants` | `OfferDetailScreen` | catalog.test "C05…", screens.test "switches to a sibling variant" |
| C06 Servings & quantity | Foundation (display) | `GET /v1/offers/:id` | `ingredient_requirements.weight_basis`, `offer_variants.portion_*` | `laborTotal`, `ServingStepper`, `IngredientLineView` | domain.test founder example; screens.test "4 servings… 40 EGP"; e2e |
| C07 Inspect ingredients | Foundation (display) | `GET /v1/offers/:id` | `ingredients.allergen_data_status` | `AllergenNotice` | catalog.test "C07…", ui.test, screens.test |
| **C23** Arabic & English | Done for Slice 1 screens | `PATCH /v1/me` (locale) | `app_users.locale` | `packages/i18n`, `LocaleProvider`, all screens | i18n.test (key parity, placeholders), ui.test RTL, screens.test RTL, ops.test RTL, e2e |
| **H01** Apply as chef | Done (evidence = metadata reference) | `POST /v1/partner-applications`, `POST …/:id/evidence`, `GET …/mine` | `partner_applications`, `partner_evidence`, `chefs`, `private_addresses` | `routes/partners.ts`, `ApplyScreen` | partners-ops.test, chef-supplier.test "H01…", partner.test, e2e |
| **H02** Set labor per person | Done | `POST /v1/chef/:chefId/dishes/:dishId/variants`, `PATCH /v1/chef/:chefId/variants/:id/pricing` | `offer_variants.price_version`, `offer_variant_price_history` (trigger) | `routes/chef.ts` | chef-supplier.test "H02…" |
| **H03** Publish variants & recipe BOM | Done (API); UI = drafts only | `…/recipe-versions`, `…/recipe-versions/:id/publish`, `…/dishes/:id/publish` | `recipe_versions` + immutability triggers, `ingredient_requirements`, `dishes_publication_guard` | `publishBlockers`, `routes/chef.ts`, `ChefMenuScreen` | domain.test "publish readiness"; chef-supplier.test "H03…", "O12…" |
| H12 Pause kitchen | Foundation | `POST /v1/chef/:chefId/availability` | `chefs.accepting_orders` | `routes/chef.ts` | chef-supplier.test "H12…" |
| **S01** Register store/branch | Done (staff invites later) | `POST /v1/partner-applications` (SUPPLIER), `GET /v1/supplier/branches`, `POST …/open` | `supplier_organizations`, `supplier_branches`, `role_memberships` (branch scope) | `routes/supplier.ts` | partners-ops.test "S01…"; domain.test branch-scoped staff |
| **S02** Publish stock & pack prices | Done | `POST/GET /v1/supplier/branches/:id/products` | `supplier_products`, `inventory_balances`, unit trigger | `routes/supplier.ts`, `SupplierScreen`, `parseEgpToPiastres` | chef-supplier.test "S02…", partner.test, domain.test EGP parsing |
| **D01** Apply & declare equipment | Done (no job filtering yet) | `POST /v1/partner-applications` (COURIER) | `courier_profiles.equipment` check | `ApplyScreen` | partners-ops.test "D01…" |
| **O01** Review partner evidence | Done (expiry tracked; files not viewable) | `GET /v1/ops/partner-applications`, `GET …/:id`, `POST …/:id/decision` | `partner_applications` CHECK `decided_by <> applicant`, `audit_events` (append-only) | `routes/ops.ts`, `OpsApp.tsx` | partners-ops.test (self-review API+DB, version, concurrency, audit), ops.test, e2e |
| O08 Duplicate events (foundation) | Outbox only | — | `outbox_events`, `idempotency_records` | `apps/worker`, `platform.ts` | outbox.test (retry, dead-letter, concurrency); partners-ops.test idempotency |
| O12 Audit price changes (foundation) | Recipe/price immutability | — | triggers in `0002_catalog` | — | chef-supplier.test "O12…", "H02…" |

Cross-cutting authorization tests: `apps/api/test/chef-supplier.test.ts` ("cross-role denial…",
"suspending a membership…") and `partners-ops.test.ts` (unauthenticated, forged tokens, role
escalation in body, suspended accounts).

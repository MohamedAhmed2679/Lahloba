# Lahloba v1.1 — All 10 Improvements

| # | Feature | New API Endpoints | Flutter Screens | DB Tables |
|---|---------|-------------------|-----------------|-----------|
| 1 | Meilisearch Search | /search/meals, /search/suggestions | SearchScreen | (external index) |
| 2 | Favorites & Reorder | /favorites, /favorites/reorder | FavoritesScreen (tabs) | favorites, reorder_shortcuts |
| 3 | Chef Calendar | /availability/chef/:id/* | ChefCalendarScreen | chef_availability_slots, _overrides |
| 4 | ETA Prediction | /eta/predict, /eta/accuracy | (integrated in tracking) | eta_predictions, delivery_history_features |
| 5 | Loyalty Program | /loyalty/account, /loyalty/redeem/*, /loyalty/referral | LoyaltyScreen | loyalty_accounts, _transactions, _tier_rules |
| 6 | Route Optimization | /routing/batch-candidates, /routing/batch | DeliveryBatchScreen | delivery_batches (+batch_id FK) |
| 7 | GraphQL | /graphql | (uses graphql_flutter) | — |
| 8 | E2E Tests | — | 5 test groups (all roles) | — |
| 9 | Accessibility | — | AccessibleWidgets + WCAG tests | a11y_audit_log |
| 10 | Analytics | /analytics/chef/:id, /store/:id, /platform | ChefAnalyticsScreen + Admin page | 3 materialized views |

## Setup

```bash
psql $DATABASE_URL < packages/db/migrations/002_improvements.sql
docker compose up -d meilisearch
flutter test test/accessibility/
flutter test test/e2e/
```

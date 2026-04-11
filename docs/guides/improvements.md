# Suggested Improvements for Lahloba

## v1.1 — Quick Wins
1. **Search with Algolia/Meilisearch**: Full-text meal and ingredient search
2. **Image upload**: Allow chefs to upload meal photos via MinIO
3. **Rating aggregation**: Background job to update meal/chef rating_avg
4. **Scheduled order reminders**: Push 30min before scheduled_at

## v1.2 — Experience Enhancements
5. **Favorites/wishlist**: Save meals for quick reorder
6. **Order history reorder**: "Order again" one-tap button
7. **Chef availability calendar**: Visual weekly schedule in app
8. **Delivery ETA ML model**: Predict based on distance, time, traffic

## v2.0 — Platform Growth
9. **Route optimization**: Multi-order batching for delivery efficiency
10. **Loyalty/rewards program**: Points per order, tier unlocks
11. **Chef subscription plans**: Weekly meal plans with discount
12. **Analytics dashboard**: Chef/store insights (popular items, peak hours)
13. **Multi-region**: Zone expansion beyond Giza
14. **Social features**: Share meals, follow chefs, meal reviews feed

## Technical Debt
15. **GraphQL option**: For mobile (reduce over-fetching)
16. **gRPC for inter-service**: API → Push/Realtime communication
17. **Event sourcing**: Full order lifecycle replay capability
18. **Canary deployments**: Gradual rollout via feature flags
19. **E2E test suite**: Detox/Patrol for full mobile flow automation
20. **Accessibility audit**: Professional WCAG 2.1 AA compliance review

# Infrastructure

Intentionally empty in Slice 1. Hosting provider, data residency, secrets manager, backups and
monitoring are open decisions (blueprint doc 05 §5.7, doc 07). Do not deploy the Slice 1 API
publicly: it is development-grade and the dev identity stub must never be enabled outside
development/test (the config loader refuses it).

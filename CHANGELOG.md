# Changelog

All notable user-facing and breaking changes are documented here. PRs should add a short entry under **Unreleased** for any change that affects API behavior, configuration, or dependencies in a user-visible way.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Tags are `v1.0.0`, etc.

## Unreleased

- **Added** — Ingress accepts NIP-88 poll and vote kinds **1068** and **1018** (draft NIP), so SmartFlowSocial and other clients can publish polls/votes through Blastr like other allowed kinds.
- **Fixed** — Documented ingress rate-limit default is 60 requests per window, matching `DEFAULT_REQUESTS_PER_WINDOW`.
- **Changed** — Fresh D1 setup applies migrations `0002` through `0007`. `0000` and `0001` are not part of this schema.
- **Changed** — The `0003` cold start is the first eight relays from this repository's own `0005` catalog. `0007` deletes `wss://nostr.zebedee.cloud` and `wss://brb.io` from a database that already applied the previous cold-start file. This change does not execute that SQL.
- **Removed** — Unused `hono` dependency. The worker does not import it.
- **Removed** — Deleted the copied architecture image, the copied favicon, and the unused `event` / `tag` migrations `0000` and `0001`. Existing D1 databases are not altered by this source change.
- **Added** — Original icon at `GET /favicon.ico` and `GET /favicon.svg`.
- **Docs** — Recorded source provenance and third-party notices. The Unlicense applies to SmartFlowSocial-authored code in the current tree. It does not relicense historical commits or dependencies.
- **Changed** — `wrangler.toml` KV and D1 bindings are declared by name. Wrangler 4 provisions them on deploy, and the ids are not stored in the repository.

## 1.0.0 — 2025-03-12

- Initial world-class baseline: observability (health/ready, metrics, correlation), testing (coverage gates, security tests, E2E, failure-path tests), OpenAPI and versioning docs, admin rate limit and audit logging, SECURITY.md and dependency audit in CI, poison handling and SLO/runbook docs, release hygiene (version and changelog).

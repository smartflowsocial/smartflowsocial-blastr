# Blastr

[![CI](https://github.com/smartflowsocial/smartflowsocial-blastr/actions/workflows/ci.yml/badge.svg)](https://github.com/smartflowsocial/smartflowsocial-blastr/actions/workflows/ci.yml)
[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue)](LICENSE)
[![Node 26.13.1+](https://img.shields.io/badge/node-26.13.1%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg)](https://pnpm.io/)

Blastr is the **SmartFlowSocial broadcast relay** — a write-focused managed Nostr relay that accepts signed Nostr events (WebSocket or HTTP), enforces **pubkey-scoped entitlement** (paid subscription), applies per-pubkey **relay policy** (blacklist/whitelist), and fans out to a bounded **system relay universe**—all keyed by the event author’s pubkey, so behavior is consistent from any client (SFS app, Damus, Coracle, etc.).

Part of [SmartFlowSocial](https://smartflow.social). Related pieces: [app](https://github.com/smartflowsocial/smartflowsocial), [publisher](https://github.com/smartflowsocial/smartflowsocial-publisher), [Blossom](https://github.com/smartflowsocial/smartflowsocial-blossom), [cache worker](https://github.com/smartflowsocial/smartflowsocial-cache-worker).

**Why Blastr?** If you run a Nostr app and want paid subscribers to broadcast to a curated set of relays from any client (your app, Damus, etc.) with one consistent policy and entitlement check, Blastr is the relay in the middle: it gates by pubkey, resolves the relay set, and fans out asynchronously. [Nostr](https://nostr.com) is a decentralized protocol; see the [NIPs](https://github.com/nostr-protocol/nips) for the relay and event spec.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Example](#example)
- [Project structure](#project-structure)
- [API reference](#api-reference)
- [Configuration](#configuration)
- [First-time setup (before first deploy)](#first-time-setup-before-first-deploy)
- [Setup (D1, KV, Queues)](#setup-d1-kv-queues)
- [Development](#development)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Documentation](#documentation)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Pubkey-scoped behavior** — Entitlement and relay policy are determined by the **event author’s pubkey**, not by client or session. Relay preferences set in SmartFlowSocial apply when the same user posts from any Nostr client.
- **Entitlement gating** — Only pubkeys in `blastr_entitlements` with status `active` or `grace` can publish; others receive a clear rejection (e.g. “paid SmartFlowSocial subscription required”).
- **User relay policy** — Per-pubkey blacklist/whitelist with allow/block lists; default is blacklist with an empty block list (full managed relay set).
- **Bounded relay universe** — Curated system relays in `blastr_system_relays`; effective relay set is resolved from policy and **snapshotted on the job** for reliable fanout.
- **Async fanout** — Ingress validates, checks entitlement, rate limit, dedupe, resolves relays, creates a job, enqueues, and returns OK. A queue consumer sends the event to the job’s relay list and records attempts.
- **NIP-11 & NIP-20** — Relay info and write-only limitation exposed; compatible with standard Nostr clients.
- **Admin API** — Manage entitlements, user policies, and policy relays (protected by `API_TOKEN`).
- **Diagnostics** — Publish jobs and per-relay attempts stored in D1 for observability.

---

## Architecture

External Nostr clients submit events over HTTP `POST /event` or a WebSocket on `/` or `/ws`. The worker validates the signature and event shape, checks the author's pubkey entitlement, applies the rate limit, and rejects duplicates held in KV. It resolves that pubkey's relay policy against the D1 relay catalog, stores a publish job, and enqueues it. A queue consumer fans the job out to the snapshotted relay list and records each delivery attempt. A scheduled task can refresh the catalog from NostrMash. That sync is not on the publish path.

The diagram is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Product rationale is in [docs/SFS_BROADCAST_RELAY_DESIGN.md](docs/SFS_BROADCAST_RELAY_DESIGN.md).

**Data stores:** D1 (entitlements, policies, system relays, jobs, attempts), KV (dedupe by event id, rate-limit counters).

This repository is the SmartFlowSocial service. It is not Mutiny Wallet's Blastr, and Mutiny Wallet does not maintain, endorse, or sponsor it. The shared name is historical. See [docs/SOURCE_PROVENANCE.md](docs/SOURCE_PROVENANCE.md).

---

## Tech stack

| Layer       | Technology                                                                    |
| ----------- | ----------------------------------------------------------------------------- |
| Runtime     | Cloudflare Workers (Node compat)                                              |
| Language    | TypeScript (strict, ES2022)                                                   |
| Database    | Cloudflare D1 (SQLite)                                                        |
| Cache / KV  | Cloudflare KV (dedupe: PUBLISHED_NOTES; rate limits: BLASTR_RATE_LIMIT)       |
| Queue       | Cloudflare Queues                                                             |
| Nostr       | [nostr-tools](https://github.com/nbd-wtf/nostr-tools) (parsing, verification) |
| Tests       | Vitest (unit, integration, coverage)                                          |
| Lint/format | ESLint (flat config), Prettier                                                |
| Git hooks   | Husky + lint-staged                                                           |

---

## Quick start

**Prerequisites:** Node.js 26.13.1 or newer (`.nvmrc`) and [pnpm](https://pnpm.io/) 12.21.0.

```bash
# Clone the repo (use your fork or the canonical URL)
git clone https://github.com/smartflowsocial/smartflowsocial-blastr.git
cd smartflowsocial-blastr
pnpm install

# Validate (format, lint, typecheck, provenance markers)
pnpm validate

# Run tests
pnpm test

# Local development (requires D1/KV/Queue bindings in wrangler.toml or .dev.vars)
pnpm start
```

Then open the worker URL (e.g. `http://localhost:8787`). Use `GET /` with `Accept: application/nostr+json` for NIP-11, `POST /event` to submit events (with entitlement and policy configured), and `GET /health` for health checks.

---

## Example

**NIP-11 relay info** (no auth):

```bash
curl -s -H "Accept: application/nostr+json" http://localhost:8787/
```

**Health check:**

```bash
curl -s http://localhost:8787/health
```

**Submit a Nostr event** (requires the event’s pubkey to be entitled in `blastr_entitlements`). Body is a signed Nostr event object or `["EVENT", event]`. Replace `id`, `pubkey`, and `sig` with a real signed event (e.g. from [nostr-tools](https://github.com/nbd-wtf/nostr-tools) or your Nostr client):

```bash
curl -s -X POST http://localhost:8787/event \
  -H "Content-Type: application/json" \
  -d '["EVENT", {"id":"…","pubkey":"…","created_at":1700000000,"kind":1,"tags":[],"content":"Hello from Blastr","sig":"…"}]'
```

Success response: `["OK", "<event_id>", true, ""]`. See [docs/API.md](docs/API.md) for error responses and WebSocket usage.

---

## Project structure

| Path                                     | Purpose                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                           | Worker entry: `fetch` (HTTP/WebSocket routing) and `queue` (publish-job consumer).                        |
| `src/config/`                            | Environment validation (`env.ts`).                                                                        |
| `src/core/`                              | Domain logic: event validation, relay catalog, policy resolution.                                         |
| `src/adapters/`                          | Nostr adapter (event parsing/verification via nostr-tools).                                               |
| `src/services/`                          | D1 (entitlements, policies, jobs, relays), jobs, dedupe (KV), rate-limit.                                 |
| `src/transport/`                         | HTTP handlers (publish, NIP-11), admin API, pipeline (ingress), queue producer/consumer, WebSocket relay. |
| `src/middleware/`                        | CORS (preflight and headers).                                                                             |
| `src/errors.ts`, `types.ts`, `logger.ts` | Shared error codes, types, logging.                                                                       |
| `tests/`                                 | Unit, integration, and optional security tests (mirrors `src/` layout).                                   |
| `migrations/`                            | D1 SQL migrations (blastr tables, seed system relays).                                                    |
| `docs/`                                  | Design and architecture documentation.                                                                    |

---

## API reference

### Public endpoints

| Method              | Path           | Description                                                                                                          |
| ------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| `GET`               | `/`            | NIP-11 relay info when `Accept: application/nostr+json`; otherwise plain text.                                       |
| `GET`               | `/favicon.ico` | Original SmartFlowSocial icon.                                                                                       |
| `GET`               | `/favicon.svg` | Same icon as SVG.                                                                                                    |
| `GET`               | `/health`      | Liveness probe. Returns `{ "status": "ok", "timestamp": "…" }`.                                                      |
| `GET`               | `/ready`       | Readiness probe. Checks D1, KV, queue bindings; returns 503 if any fail.                                             |
| `POST`              | `/event`       | Submit a Nostr event. Body: event object or `["EVENT", event]`. Returns Nostr `["OK", event_id, accepted, message]`. |
| `GET` / `WebSocket` | `/` or `/ws`   | Nostr WebSocket relay (event submission).                                                                            |

The relay (WebSocket and POST /event) is gated by **pubkey entitlement** only; no API token is required for publishing. Admin routes require `API_TOKEN` and return 401 when it is unset.

### Admin API (`API_TOKEN` required)

| Method   | Path                                         | Description                                                                                |
| -------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `PUT`    | `/admin/entitlements/<pubkey>`               | Create or update entitlement (body: `plan_tier`, `status`, optional `rate_limit_profile`). |
| `GET`    | `/admin/users/<pubkey>/policy`               | Get user relay policy.                                                                     |
| `PUT`    | `/admin/users/<pubkey>/policy`               | Set user policy (body: `mode`, `enabled`, etc.).                                           |
| `POST`   | `/admin/users/<pubkey>/relays`               | Add a relay to policy (body: `relay_url`, `action`).                                       |
| `DELETE` | `/admin/users/<pubkey>/relays?relay_url=...` | Remove a relay from policy.                                                                |

See [docs/API.md](docs/API.md) for request/response details.

---

## Configuration

- **Entitlements** — Populate `blastr_entitlements` (e.g. from your subscription service). Only pubkeys with `status` in `active` or `grace` can publish.
- **System relays** — `blastr_system_relays`. Seed migrations are the cold start. A scheduled sync from NostrMash `GET /api/v1/relays/catalog` then owns membership and score (`distinct_users`). `operator_hold = 1` freezes `enabled`. Write health comes from publish attempts, not the catalog.
- **User policy** — Per-pubkey mode and allow/block list in `blastr_user_policies` and `blastr_policy_relays`. Default: blacklist with no blocked relays.
- **Event constraints** — Allowed Nostr event kinds: `0` (metadata), `1` (short note), `4` (NIP-04 DM), `6` (repost, NIP-18), `1059` (gift wrap), `1068` / `1018` (NIP-88 polls/votes, draft), `30023` (long-form, NIP-23). Max serialized event size: see `MAX_EVENT_SIZE` in `src/config/env.ts`.
- **Environment variables** — See table below. Full validation in `src/config/env.ts` and bindings in `wrangler.toml`.

| Variable                     | Purpose                                        | Default / notes                                                           |
| ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| `API_TOKEN`                  | Protects admin routes. Required for admin use. | If unset, admin routes return 401. `POST /event` does not use this token. |
| `RATE_LIMIT_REQUESTS`        | Per-pubkey limit (ingress)                     | `60`                                                                      |
| `RATE_LIMIT_WINDOW_MS`       | Window for rate limit (ms)                     | `60000`                                                                   |
| `CORS_ENABLED`               | Enable CORS for `/event` and admin             | `"true"` to enable                                                        |
| `CORS_ORIGINS`               | Allowed origins (comma-separated)              | Required if `CORS_ENABLED` is true                                        |
| `ENVIRONMENT`                | Used in the missing-token warning              | Admin routes fail closed in every environment                             |
| `NOSTRMASH_API_BASE`         | NostrMash origin for the relay catalog cron    | Sync is skipped when unset                                                |
| `BLASTR_RELAY_CATALOG_LIMIT` | Catalog page size                              | `50`, clamped to `1..100`                                                 |
| `DB`                         | D1 binding                                     | Required                                                                  |
| `PUBLISHED_NOTES`            | KV binding, event-id dedupe                    | Required                                                                  |
| `BLASTR_RATE_LIMIT`          | KV binding, rate-limit counters                | Required                                                                  |
| `BLASTR_PUBLISH_QUEUE`       | Queue binding for publish jobs                 | Required                                                                  |

---

## First-time setup (before first deploy)

Checked-in `wrangler.toml` does not contain Cloudflare resource ids. Wrangler 4 provisions the `PUBLISHED_NOTES` and `BLASTR_RATE_LIMIT` KV namespaces on deploy. D1 is declared as `blastr-db` (staging: `blastr-db-staging`). Production consumes `blastr-publish-jobs`. Staging consumes `blastr-publish-jobs-staging`. Do not point both workers at one queue. Do not paste invented ids into the file.

**Production deploy checklist:** (1) Create the queue in the same Cloudflare account you deploy from; (2) Create the D1 databases and run migrations; (3) Set `API_TOKEN` with `wrangler secret put API_TOKEN` (and `--env staging` for staging). Do not commit the token. (4) Run `pnpm deploy`. See [docs/OPERATIONS.md](docs/OPERATIONS.md) for runbooks.

**Deploy will fail** if the queue does not exist. Do this once before deploying (or before connecting Git to Cloudflare):

1. **Create the queues** (required; deploy fails without the queue for that environment):
   ```bash
   wrangler queues create blastr-publish-jobs
   wrangler queues create blastr-publish-jobs-staging
   ```
   Production uses `blastr-publish-jobs`. Staging uses `blastr-publish-jobs-staging`. Do not deploy staging until the staging queue exists.
2. Leave the KV bindings in `wrangler.toml` without ids. Wrangler creates `PUBLISHED_NOTES` and `BLASTR_RATE_LIMIT` in the deploy account.
3. **Create the D1 database** named `blastr-db`, run migrations, and let Wrangler record the database id for that account. Staging uses `blastr-db-staging` under `[env.staging]`. Do not copy another account's id into the file.

Then run `pnpm deploy` or use the Git integration.

**If deploy says "KV namespace '...' not found":** Deploy from the Cloudflare account that should own the resources. Do not copy ids from another account into `wrangler.toml`.

**Wrangler 4 (multiple environments):** To deploy production from Git, set the deploy command to `npx wrangler deploy --env=""`. For staging: `npx wrangler deploy --env=staging`.

---

## Setup (D1, KV, Queues)

### D1

```bash
wrangler d1 create blastr-db
# Use the database_name already in wrangler.toml. Do not invent a database_id.

wrangler d1 execute blastr-db --remote --file=./migrations/0002_blastr_tables.sql
wrangler d1 execute blastr-db --remote --file=./migrations/0003_seed_system_relays.sql
wrangler d1 execute blastr-db --remote --file=./migrations/0004_blastr_publish_jobs_event_id_unique.sql
wrangler d1 execute blastr-db --remote --file=./migrations/0005_seed_top50_system_relays.sql
wrangler d1 execute blastr-db --remote --file=./migrations/0006_system_relay_operator_hold.sql
wrangler d1 execute blastr-db --remote --file=./migrations/0007_replace_copied_cold_start.sql
```

For local dev, use `--local` instead of `--remote`.

Apply `0002` through `0007` only. This tree has no earlier migration. Do not recreate a generic `event` / `tag` schema; the worker does not read those tables. If an older database already has them, leave them. Nothing in this repository drops production tables. `0007` deletes two relay rows, `wss://nostr.zebedee.cloud` and `wss://brb.io`, from a database that already applied an older `0003`. It does not run itself; an operator runs the command above.

### KV

Two KV namespaces are required:

- **PUBLISHED_NOTES** — Event dedupe (published event IDs).
- **BLASTR_RATE_LIMIT** — Rate-limit state (per-pubkey and admin).

The bindings are already in `wrangler.toml` without ids. Wrangler 4 creates `PUBLISHED_NOTES` and `BLASTR_RATE_LIMIT` on deploy. Do not add placeholder ids.

### Queue

```bash
wrangler queues create blastr-publish-jobs
wrangler queues create blastr-publish-jobs-staging
```

Production producer and consumer bindings use `blastr-publish-jobs`. The `[env.staging]` bindings use `blastr-publish-jobs-staging`. A staging worker must not consume the production queue.

---

## Development

| Command             | Description                                                            |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm start`        | Start local dev server (`wrangler dev`).                               |
| `pnpm validate`     | Format check, lint, typecheck, and the source-provenance marker check. |
| `pnpm typecheck`    | `tsc --noEmit`.                                                        |
| `pnpm lint`         | ESLint with cache.                                                     |
| `pnpm lint:fix`     | ESLint with auto-fix.                                                  |
| `pnpm format`       | Prettier write.                                                        |
| `pnpm format:check` | Prettier check.                                                        |
| `pnpm deploy`       | Deploy to Cloudflare (`wrangler deploy`).                              |

Staging: `wrangler deploy --env staging` (uses `env.staging` in `wrangler.toml`).

---

## Testing

| Command                 | Description                                 |
| ----------------------- | ------------------------------------------- |
| `pnpm test`             | Run all tests.                              |
| `pnpm test:unit`        | Unit tests (core, services, utils, logger). |
| `pnpm test:integration` | Integration tests (transport, integration). |
| `pnpm test:security`    | Security tests.                             |
| `pnpm test:e2e`         | End-to-end tests under `tests/e2e`.         |
| `pnpm test:watch`       | Vitest watch mode.                          |
| `pnpm test:coverage`    | Vitest with coverage report.                |

Coverage thresholds are enforced in `vitest.config.ts`.

---

## CI/CD

- **CI** (`.github/workflows/ci.yml`) — On push/PR: validate, unit tests, integration tests, coverage. Uses Node 26.13.1 and pnpm 12.21.0 with frozen lockfile.
- **Deploy** — Set `CF_API_TOKEN` (and optionally routes in `wrangler.toml`), then `pnpm deploy` or your own workflow. Staging: `pnpm deploy --env staging`.

---

## Documentation

| Document                                                                 | Description                                                                       |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                             | High-level architecture, components, data flow, and data model.                   |
| [docs/SOURCE_PROVENANCE.md](docs/SOURCE_PROVENANCE.md)                   | Relationship to Mutiny Wallet Blastr, copied files removed, and license boundary. |
| [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)                         | Dependency licenses and the MIT notice for historical copied files.               |
| [docs/API.md](docs/API.md)                                               | HTTP and WebSocket API reference (public and admin endpoints).                    |
| [docs/SFS_BROADCAST_RELAY_DESIGN.md](docs/SFS_BROADCAST_RELAY_DESIGN.md) | Product and design assessment, relay resolution, phasing.                         |
| [docs/VERSIONING.md](docs/VERSIONING.md)                                 | API versioning policy and future breaking changes.                                |
| [docs/OPERATIONS.md](docs/OPERATIONS.md)                                 | SLOs, runbooks, health/readiness, fanout and poison-message handling.             |
| [docs/RELEASE.md](docs/RELEASE.md)                                       | Release process, version bump, changelog, and tagging.                            |
| [docs/openapi.yaml](docs/openapi.yaml)                                   | OpenAPI 3 spec for the HTTP API (validated in CI).                                |
| [CONTRIBUTING.md](CONTRIBUTING.md)                                       | How to run checks, write tests, and submit changes.                               |
| [SECURITY.md](SECURITY.md)                                               | Reporting vulnerabilities and scope.                                              |
| [CHANGELOG.md](CHANGELOG.md)                                             | User-facing and breaking changes per release.                                     |

---

## Troubleshooting

| Issue                                             | What to check                                                                                                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Clone / install fails**                         | Node.js 26.13.1 or newer and pnpm 12.21.0. Run `pnpm install` in the project root.                                                                                                                 |
| **`pnpm start` fails or bindings missing**        | Ensure `wrangler.toml` has D1, KV, and Queue bindings; for local dev use `--local` in D1 execute and add preview IDs for KV. See [Setup (D1, KV, Queues)](#setup-d1-kv-queues).                    |
| **GET /ready returns 503**                        | D1, KV, or queue binding unreachable. Check names and IDs in `wrangler.toml`, run migrations for D1, confirm queue exists. See [docs/OPERATIONS.md](docs/OPERATIONS.md#health--readiness-failing). |
| **POST /event rejected: "subscription required"** | The event’s `pubkey` must exist in `blastr_entitlements` with `status` `active` or `grace`. Add an entitlement via the admin API or seed the table.                                                |
| **Events not reaching downstream relays**         | Check queue consumer logs and `blastr_publish_attempts` in D1. Fanout failures and poison messages are described in [docs/OPERATIONS.md](docs/OPERATIONS.md#fanout-failing-repeatedly).            |
| **Rate limit or duplicate errors**                | Adjust `RATE_LIMIT_*` env vars; duplicate events are rejected by design (see dedupe in ingress).                                                                                                   |

More runbooks: [docs/OPERATIONS.md](docs/OPERATIONS.md).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to run checks, write tests, and submit changes.

---

## License

SmartFlowSocial-authored source in the current tree is released under the [Unlicense](LICENSE). That dedication does not cover third-party dependencies, and it does not relicense older Git commits. Historical commits of this repository included files that were identical to Mutiny Wallet Blastr, which is MIT-licensed. Those files are not in the current tree. The MIT notice for them is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The comparison and the remaining questions are in [docs/SOURCE_PROVENANCE.md](docs/SOURCE_PROVENANCE.md).

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). Report security issues through [SECURITY.md](SECURITY.md).

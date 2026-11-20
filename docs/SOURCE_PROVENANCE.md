# Source provenance

This is an engineering record of what in SmartFlowSocial Blastr came from [Mutiny Wallet Blastr](https://github.com/MutinyWallet/blastr), what was compared, and what the current tree contains. It is not a legal opinion and it does not claim that an automated comparison cleared the copyright in this repository.

## Origin

SmartFlowSocial Blastr is a TypeScript service on Cloudflare Workers. It accepts signed Nostr events, requires a pubkey entitlement, applies a per-pubkey relay policy, and fans the event out to a curated relay set.

The idea of a write-focused relay that broadcasts one event to many relays comes from Mutiny Wallet's Blastr project. That project is Rust and WebAssembly. This repository is a separate SmartFlowSocial service. Mutiny Wallet does not maintain it, endorse it, or sponsor it.

The product name **Blastr** is the same. The name is kept because it is the name of the existing SmartFlowSocial service. Renaming it needs the owner's approval. The shared name can be confused with the Mutiny Wallet project. The README states the distinction for that reason.

## What was compared

On 20 November 2026 the current `main` tree (`3c15f0e072fe6e58025c1fb52f14463feb88adf5`) was compared with Mutiny Wallet Blastr commit `99b4e364596fdc0e8831e761e6e0ebde8eab97d9` (25 January 2024, default-branch head at the time of the comparison).

The comparison was:

- Git blob SHA-1 of every file in both trees, including files that do not share a path.
- A reading of the upstream Rust sources (`src/lib.rs`, `src/nostr.rs`, `src/db.rs`, `src/error.rs`, `src/utils.rs`), both wrangler files, both SQL migrations, both READMEs, both licenses, and the GitHub Actions workflows.
- A search for distinctive upstream strings: the NIP-11 name and contact, the upstream software URL and pubkey, the NWC KV binding names, the ten upstream queue names, and the migration header comments.

The person doing the comparison could read both codebases in the same session. That is not a sealed clean-room. No TypeScript module was given to a second implementer who was kept away from the Rust. No module was rewritten, because none was a translation of the Rust. Rewriting independent code only to make the text look different would change a working service without removing copied expression.

## Exact copies that were in this repository

These four files were byte-identical to Mutiny Wallet Blastr. All four were added in `8fcb1ec` ("Initial commit", 15 November 2026) and were unchanged after that. They are not in the current tree.

| Path                             | Git blob SHA-1                             | What it was                                                                             |
| -------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `docs/images/blastr-diagram.png` | `4b46f08b623e106055b9e9b3722b3c52a390f5ed` | Upstream architecture drawing (actor, one HTTP worker, one queue worker, relay clouds). |
| `static/favicon.ico`             | `d0c1b1e1f2bec8a2a73138c98a9f1dbabba5725b` | Upstream icon, a pink mark.                                                             |
| `migrations/0000_events.sql`     | `2e664745182202306600f9f9496ec99801905159` | Upstream `event` table, including the `DROP TABLE` and the 2023 migration comment.      |
| `migrations/0001_tag.sql`        | `cb5c3b05273ca0e74ca38bb88d96efb5b627ce65` | Upstream `tag` table, including the `DROP TABLE` and the 2023 migration comment.        |

No other file in the two trees shared a blob hash.

### Why the SQL files were safe to delete

`wrangler.toml` does not set `migrations_dir`. Nothing in `src/` or the tests reads an `event` or `tag` table. The README already told operators not to apply those two files. Documented setup runs `0002` through `0007` by hand. Deleting the files does not send SQL to Cloudflare and does not drop tables that may already exist in a database. If an older database has `event` or `tag`, leave those tables. Do not reintroduce these two files.

### What replaced the image and the icon

`docs/ARCHITECTURE.md` now has a Mermaid diagram of the current path: HTTP and WebSocket ingress, signature checks, pubkey entitlement, rate limiting, KV deduplication, catalog and policy resolution, the optional NostrMash sync, the D1 job, the queue, the consumer, fanout, and delivery attempts. It was written from that code path. It is not a redraw of the upstream PNG.

`static/favicon.svg` and `static/favicon.ico` are a new mark: a navy rounded tile, a teal source dot, and three arcs opening to the right. `GET /favicon.ico` and `GET /favicon.svg` serve those bytes from `src/brand/icon.ts`. `wrangler.toml` has no assets binding, and none was added, so the worker script name, routes, D1 databases, KV namespaces, and queues are unchanged.

## Adapted material

`.github/workflows/test.yml` was not byte-identical to the upstream workflow. It kept the upstream job ids (`website` / "Build WASM binary" and `rust_tests` / "Rust Checks") and, when `Cargo.toml` was absent, exited successfully. This repository has no Rust crate, so the workflow never tested the worker. It has been removed. The TypeScript checks live in `.github/workflows/ci.yml`.

The publish workflows are not copies. They are manual `workflow_dispatch` jobs with a credential preflight. They were left as they are so deploy behavior does not change. The `wrangler publish` invocation is the ordinary Wrangler command.

## TypeScript implementation

The worker is not a line-by-line translation of the Rust.

| Area            | Conclusion                                       | Evidence                                                                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ingress         | Independent                                      | The TypeScript pipeline checks entitlement, rate limit, dedupe, and relay policy, then writes a D1 job. The Rust handler verifies a signature, rejects one kind, checks KV, stores NWC events, and sends the raw event to ten queues.                                            |
| WebSocket       | Independent                                      | Both speak NIP-01. The TypeScript socket uses the same pipeline as HTTP. The Rust socket also polls D1 for NWC subscriptions. This worker has no NWC subscription loop.                                                                                                          |
| `POST /event`   | Protocol similarity                              | Both accept a client event and return a NIP-01 OK message. Request parsing, CORS, entitlement, and the rejection set are this service's.                                                                                                                                         |
| NIP-11          | Independent                                      | This worker's document is named Blastr, describes the SmartFlowSocial relay, lists its own NIPs, and sets `limitation.write`. The upstream document used a Mutiny name, email, pubkey, and `git+https://github.com/MutinyWallet/blastr.git`. Those strings are not in this tree. |
| Relay selection | Independent                                      | This worker resolves a per-pubkey policy against `blastr_system_relays`. The upstream worker fetched `api.nostr.watch/v1/online` and sliced it across ten queues.                                                                                                                |
| Queues          | Same Cloudflare product, different design        | One queue, `blastr-publish-jobs`, carries a job id and the snapshotted relay list. The upstream worker used `nostr-events-pub-1-b` through `nostr-events-pub-10-b`.                                                                                                              |
| Deduplication   | Shared binding name, different storage around it | Both use KV under the binding `PUBLISHED_NOTES`, keyed by event id. This worker also has a unique `event_id` on `blastr_publish_jobs`. The binding name is unchanged because renaming it would point the worker at a different KV namespace.                                     |
| NWC             | Not implemented                                  | The upstream `src/db.rs` path stored wallet-connect events and skipped fanout. This worker does not. Those kinds fall outside the allowlist.                                                                                                                                     |
| Retries         | Independent                                      | This worker records `attempt_number` and uses the queue's `max_retries`. The upstream consumer logged send failures and used connect timeouts.                                                                                                                                   |
| Event checks    | Independent policy                               | This worker allows kinds 0, 1, 4, 6, 1018, 1059, 1068, and 30023, and limits serialized size. The upstream worker denied only kind 1064.                                                                                                                                         |
| Configuration   | Independent                                      | Queue names, D1 table names, account bindings, and routes differ. Upstream zone ids and KV ids are not in `wrangler.toml`.                                                                                                                                                       |

One short rejection string is the same: `disallowed event kind`. It is the NIP-20 reason for a kind this service does not accept. The kind rule itself is the allowlist above, not the upstream denylist. The string was left so clients that already match it keep working.

## Cold start

`migrations/0003_seed_system_relays.sql` used to insert eight public URLs in the same order as the upstream `RELAYS` fallback array. That ordered list is no longer the cold start. The current `0003` inserts the first eight rows of this repository's own catalog seed, `migrations/0005_seed_top50_system_relays.sql`:

1. `wss://relay.mostr.pub`
2. `wss://relay.damus.io`
3. `wss://relay.shitforce.one`
4. `wss://relay.primal.net`
5. `wss://relay.momostr.pink`
6. `wss://nos.lol`
7. `wss://relay.nostr.band`
8. `wss://purplepag.es`

`0005` still inserts the broader catalog. Some of those addresses also appeared in the old eight-URL list. They stay because this catalog selected them on its own.

`migrations/0007_replace_copied_cold_start.sql` deletes only `wss://nostr.zebedee.cloud` and `wss://brb.io`. Those two were in the old cold start and are not in `0005`. Re-running the old `INSERT OR IGNORE` would not have removed them. This repository does not execute `0007` against a live database. An operator applies it with the command in the README.

`wss://nostr.mutinywallet.com` appears in `0005` as one public relay in that catalog. It is a relay address, not a copy of the upstream worker.

## License boundary

Mutiny Wallet Blastr is MIT, copyright 2023 Mutiny Wallet. The MIT text requires the copyright and permission notice to stay with copies or substantial portions of that software.

This repository's `LICENSE` is the Unlicense. That dedication applies to SmartFlowSocial-authored work in the current tree. It does not put the historical Mutiny Wallet files into the public domain, and it does not relicense dependencies.

The four identical files are gone from the current tree. They are still in Git history, and a normal clone downloads those blobs. History was not rewritten and was not force-pushed. `THIRD_PARTY_NOTICES.md` carries the MIT notice so the notice travels with the repository that still has those historical blobs.

Direct dependencies checked for this record:

| Package       | Version | Use                                       | License                                  |
| ------------- | ------- | ----------------------------------------- | ---------------------------------------- |
| `nostr-tools` | 2.26.1  | Signature verification and event handling | Unlicense, that project's own dedication |

`hono` was declared and not imported. It has been removed from `package.json` and `pnpm-lock.yaml`. Transitive licenses were not copied into this file. They stay with the installed packages.

## Marker check

`scripts/check-source-provenance.mjs` fails if any current file hashes to one of the four blobs above, or if a small set of distinctive upstream phrases reappears outside this document, `THIRD_PARTY_NOTICES.md`, and the script itself. `pnpm provenance` runs it, and `pnpm validate` includes that command.

A pass means those markers are absent. It does not mean every possible adaptation has been found, and it does not mean a lawyer has cleared the repository.

## Unresolved questions

- The owner asked to remove the historical blobs from public Git history. That needs a non-fast-forward update of `main`. The `Protect main` ruleset rejects those updates, and this work did not force-push `main`. The blobs remain reachable from the published history. The MIT notice stays for that reason.
- Whether the shared name Blastr should change. It was not changed.
- Whether production D1 already contains `event` and `tag` tables. This work did not query production. Deleting the unused files does not drop them. `0007` was not executed.

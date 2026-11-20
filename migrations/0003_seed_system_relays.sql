-- Seed initial system relay universe (curated list).
-- These eight public relay URLs are in the same order as the fallback list
-- shipped with Mutiny Wallet Blastr (MIT). The INSERT is unchanged so this
-- already-published migration still matches databases created from it.
-- See THIRD_PARTY_NOTICES.md and docs/SOURCE_PROVENANCE.md.
INSERT OR IGNORE INTO blastr_system_relays (relay_url, enabled, health_status, score, category) VALUES
  ('wss://nostr.zebedee.cloud', 1, 'unknown', 0, 'general'),
  ('wss://relay.snort.social', 1, 'unknown', 0, 'general'),
  ('wss://eden.nostr.land', 1, 'unknown', 0, 'general'),
  ('wss://nos.lol', 1, 'unknown', 0, 'general'),
  ('wss://brb.io', 1, 'unknown', 0, 'general'),
  ('wss://nostr.fmt.wiz.biz', 1, 'unknown', 0, 'general'),
  ('wss://relay.damus.io', 1, 'unknown', 0, 'general'),
  ('wss://nostr.wine', 1, 'unknown', 0, 'general');

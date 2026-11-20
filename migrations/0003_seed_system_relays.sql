-- Cold start for a new database.
-- These eight addresses are the first rows of this repository's own catalog
-- seed in 0005_seed_top50_system_relays.sql. 0005 still inserts the rest.
-- 0007 removes two addresses that an older copy of this file inserted and
-- that the catalog seed does not keep.
INSERT OR IGNORE INTO blastr_system_relays (relay_url, enabled, health_status, score, category) VALUES
  ('wss://relay.mostr.pub', 1, 'unknown', 0, 'general'),
  ('wss://relay.damus.io', 1, 'unknown', 0, 'general'),
  ('wss://relay.shitforce.one', 1, 'unknown', 0, 'general'),
  ('wss://relay.primal.net', 1, 'unknown', 0, 'general'),
  ('wss://relay.momostr.pink', 1, 'unknown', 0, 'general'),
  ('wss://nos.lol', 1, 'unknown', 0, 'general'),
  ('wss://relay.nostr.band', 1, 'unknown', 0, 'general'),
  ('wss://purplepag.es', 1, 'unknown', 0, 'general');

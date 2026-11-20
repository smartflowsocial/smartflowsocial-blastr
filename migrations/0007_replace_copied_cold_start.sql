-- Databases created from the previous 0003 also contain two relays that the
-- current catalog seed does not include. Remove only those rows.
-- Relays that 0005 also inserts are left in place.
DELETE FROM blastr_system_relays
WHERE relay_url IN (
  'wss://nostr.zebedee.cloud',
  'wss://brb.io'
);

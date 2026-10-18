-- Address lookup support.
-- address_map: each native account and its H160 form (from reviveApi.address).
CREATE TABLE IF NOT EXISTS address_map (
  account TEXT PRIMARY KEY,
  h160    TEXT NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS address_map_h160_idx ON address_map (h160);

-- account_events: every event that touched an account, across all indexed pallets.
CREATE TABLE IF NOT EXISTS account_events (
  account      TEXT    NOT NULL,
  block_number BIGINT  NOT NULL,
  event_index  INTEGER NOT NULL,
  pallet       TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  PRIMARY KEY (account, block_number, event_index)
);
CREATE INDEX IF NOT EXISTS account_events_recent_idx ON account_events (account, block_number DESC);

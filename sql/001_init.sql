-- Generic event store: every event from every pallet lands here.
CREATE TABLE IF NOT EXISTS events (
  block_number    BIGINT      NOT NULL,
  event_index     INTEGER     NOT NULL,
  block_hash      TEXT        NOT NULL,
  extrinsic_index INTEGER,
  pallet          TEXT        NOT NULL,
  name            TEXT        NOT NULL,
  data            JSONB       NOT NULL,
  block_time      TIMESTAMPTZ,
  PRIMARY KEY (block_number, event_index)
);

CREATE INDEX IF NOT EXISTS events_pallet_name_idx ON events (pallet, name);
CREATE INDEX IF NOT EXISTS events_block_time_idx  ON events (block_time);
CREATE INDEX IF NOT EXISTS events_data_gin_idx    ON events USING GIN (data);

-- Restart-safe cursor: last finalized block fully processed, per chain.
CREATE TABLE IF NOT EXISTS cursor (
  chain_key  TEXT PRIMARY KEY,
  last_block BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

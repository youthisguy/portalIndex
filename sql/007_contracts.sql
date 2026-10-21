-- Contract registry: users register an ABI + address, Pindex decodes revive.ContractEmitted
-- events for it from the events table. Idempotent; safe to run on every start.
-- (Rename to the next free number if 007 is taken.)

CREATE TABLE IF NOT EXISTS contracts (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  address     TEXT NOT NULL,                 -- 0x H160, lowercase
  name        TEXT,
  abi         JSONB NOT NULL,                -- non-anonymous events only
  abi_hash    TEXT NOT NULL,
  token_hash  TEXT NOT NULL,                 -- sha256 of the manage token
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  decoded_to  BIGINT NOT NULL DEFAULT 0,     -- decode progress (block number)
  UNIQUE (address, abi_hash)
);

CREATE TABLE IF NOT EXISTS decoded_events (
  contract_id  INT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  block_number BIGINT NOT NULL,
  event_index  INT NOT NULL,
  event_name   TEXT NOT NULL,
  args         JSONB NOT NULL,
  block_time   TIMESTAMPTZ,
  PRIMARY KEY (contract_id, block_number, event_index)
);

CREATE INDEX IF NOT EXISTS decoded_events_lookup
  ON decoded_events (contract_id, event_name, block_number DESC);

-- Fast lookup of one contract's raw logs.
CREATE INDEX IF NOT EXISTS events_contract_emitted
  ON events ((lower(data->>'contract')), block_number)
  WHERE pallet = 'revive' AND name = 'ContractEmitted';

-- The registry table holds token hashes: never expose it through PostgREST.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_anon') THEN
    REVOKE ALL ON contracts FROM web_anon;
    GRANT SELECT ON decoded_events TO web_anon;
  END IF;
END $$;

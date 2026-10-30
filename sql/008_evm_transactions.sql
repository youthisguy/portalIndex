-- EVM transactions (Ethereum-style hashes) found in revive.ethTransact extrinsics. Idempotent.
CREATE TABLE IF NOT EXISTS evm_transactions (
  tx_hash         TEXT PRIMARY KEY,            -- 0x + 64 hex, lowercase
  block_number    BIGINT NOT NULL,
  extrinsic_index INT NOT NULL,
  block_hash      TEXT NOT NULL,
  block_time      TIMESTAMPTZ,
  from_addr       TEXT,
  to_addr         TEXT,                        -- NULL for contract creation
  value           NUMERIC(78,0),
  nonce           BIGINT,
  tx_type         INT,
  selector        TEXT,
  input_bytes     INT,
  success         BOOLEAN
);
CREATE INDEX IF NOT EXISTS evm_tx_block ON evm_transactions (block_number, extrinsic_index);
CREATE INDEX IF NOT EXISTS evm_tx_from  ON evm_transactions (from_addr, block_number DESC);
CREATE INDEX IF NOT EXISTS evm_tx_to    ON evm_transactions (to_addr, block_number DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_anon') THEN
    GRANT SELECT ON evm_transactions TO web_anon;
  END IF;
END $$;

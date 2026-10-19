-- Native balances for accounts seen in indexed events (filled by the ingester).
CREATE TABLE IF NOT EXISTS account_balances (
  account    TEXT PRIMARY KEY,
  free       NUMERIC(78,0) NOT NULL,
  reserved   NUMERIC(78,0) NOT NULL,
  block      BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill: make events already stored in the typed tables searchable by address.
INSERT INTO account_events (account, block_number, event_index, pallet, name)
          SELECT "from",  block_number, event_index, 'balances', 'Transfer'    FROM balances_transfer WHERE "from" IS NOT NULL
UNION ALL SELECT "to",    block_number, event_index, 'balances', 'Transfer'    FROM balances_transfer WHERE "to" IS NOT NULL
UNION ALL SELECT account, block_number, event_index, 'balances', 'Endowed'     FROM balances_endowed  WHERE account IS NOT NULL
UNION ALL SELECT owner,   block_number, event_index, 'nfts',     'Issued'      FROM nfts_issued       WHERE owner IS NOT NULL
UNION ALL SELECT "from",  block_number, event_index, 'nfts',     'Transferred' FROM nfts_transferred  WHERE "from" IS NOT NULL
UNION ALL SELECT "to",    block_number, event_index, 'nfts',     'Transferred' FROM nfts_transferred  WHERE "to" IS NOT NULL
UNION ALL SELECT owner,   block_number, event_index, 'assets',   'Issued'      FROM assets_issued     WHERE owner IS NOT NULL
UNION ALL SELECT "from",  block_number, event_index, 'assets',   'Transferred' FROM assets_transferred WHERE "from" IS NOT NULL
UNION ALL SELECT "to",    block_number, event_index, 'assets',   'Transferred' FROM assets_transferred WHERE "to" IS NOT NULL
ON CONFLICT DO NOTHING;

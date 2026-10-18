-- Baseline snapshots: state that already existed before the indexer started
-- (or that was lost in a gap) is read from chain storage and layered under the events.
CREATE TABLE IF NOT EXISTS state_snapshots (
  kind TEXT PRIMARY KEY,
  block BIGINT NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS asset_baseline (
  asset_id BIGINT NOT NULL,
  holder   TEXT   NOT NULL,
  balance  NUMERIC(78,0) NOT NULL,
  PRIMARY KEY (asset_id, holder)
);

-- Balance = snapshot taken at block S + every event after S.
-- With no snapshot (S = -1) every indexed event counts, as before.
CREATE OR REPLACE VIEW asset_balances AS
WITH snap AS (
  SELECT COALESCE((SELECT block FROM state_snapshots WHERE kind = 'assets'), -1) AS block
),
deltas AS (
  SELECT asset_id, holder, balance AS delta, (SELECT block FROM snap) AS block_number, 0 AS event_index, true AS is_base FROM asset_baseline
  UNION ALL SELECT asset_id, owner,        amount::numeric,   block_number, event_index, false FROM assets_issued
  UNION ALL SELECT asset_id, "to",         amount::numeric,   block_number, event_index, false FROM assets_transferred
  UNION ALL SELECT asset_id, "from",       -amount::numeric,  block_number, event_index, false FROM assets_transferred
  UNION ALL SELECT asset_id, owner,        -balance::numeric, block_number, event_index, false FROM assets_burned
  UNION ALL SELECT asset_id, destination,  amount::numeric,   block_number, event_index, false FROM assets_transferred_approved
  UNION ALL SELECT asset_id, owner,        -amount::numeric,  block_number, event_index, false FROM assets_transferred_approved
  UNION ALL SELECT asset_id, who,          amount::numeric,   block_number, event_index, false FROM assets_deposited
  UNION ALL SELECT asset_id, who,          -amount::numeric,  block_number, event_index, false FROM assets_withdrawn
),
last_destroy AS (
  SELECT asset_id, max(block_number::numeric * 1000000 + event_index) AS seq
  FROM assets_destroyed GROUP BY asset_id
)
SELECT d.asset_id, d.holder, sum(d.delta)::numeric(78,0) AS balance
FROM deltas d
CROSS JOIN snap
LEFT JOIN last_destroy x ON x.asset_id = d.asset_id
WHERE (d.is_base OR d.block_number > snap.block)
  AND d.block_number::numeric * 1000000 + d.event_index > COALESCE(x.seq, -1)
GROUP BY d.asset_id, d.holder
HAVING sum(d.delta) > 0;

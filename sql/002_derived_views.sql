-- Derived state, computed from the typed event tables (always consistent, no extra writes).
-- Requires the typed tables for the assets, nfts and uniques pallets to exist
-- (they are created by the ingester when those pallets are in PALLETS).

-- Current fungible-asset balance per holder.
-- Balance changes are replayed from events; anything before the latest asset
-- Destroyed event is ignored so a reused asset id starts clean.
CREATE OR REPLACE VIEW asset_balances AS
WITH deltas AS (
  SELECT asset_id, owner  AS holder,  amount::numeric  AS delta, block_number, event_index FROM assets_issued
  UNION ALL SELECT asset_id, "to",        amount::numeric, block_number, event_index FROM assets_transferred
  UNION ALL SELECT asset_id, "from",      -amount::numeric, block_number, event_index FROM assets_transferred
  UNION ALL SELECT asset_id, owner,       -balance::numeric, block_number, event_index FROM assets_burned
  UNION ALL SELECT asset_id, destination, amount::numeric, block_number, event_index FROM assets_transferred_approved
  UNION ALL SELECT asset_id, owner,       -amount::numeric, block_number, event_index FROM assets_transferred_approved
  UNION ALL SELECT asset_id, who,         amount::numeric, block_number, event_index FROM assets_deposited
  UNION ALL SELECT asset_id, who,         -amount::numeric, block_number, event_index FROM assets_withdrawn
),
last_destroy AS (
  SELECT asset_id, max(block_number::numeric * 1000000 + event_index) AS seq
  FROM assets_destroyed GROUP BY asset_id
)
SELECT d.asset_id, d.holder, sum(d.delta)::numeric(78,0) AS balance
FROM deltas d
LEFT JOIN last_destroy x ON x.asset_id = d.asset_id
WHERE d.block_number::numeric * 1000000 + d.event_index > COALESCE(x.seq, -1)
GROUP BY d.asset_id, d.holder
HAVING sum(d.delta) > 0;

-- Per-asset summary for leaderboards.
CREATE OR REPLACE VIEW asset_summary AS
SELECT asset_id, count(*) AS holders, sum(balance)::numeric(78,0) AS total_held
FROM asset_balances GROUP BY asset_id;

-- Current owner of every NFT (Nfts and Uniques pallets). Burned items drop out.
CREATE OR REPLACE VIEW nft_owners AS
SELECT pallet, collection, item, owner FROM (
  SELECT DISTINCT ON (pallet, collection, item) pallet, collection, item, owner, kind
  FROM (
    SELECT 'nfts'::text AS pallet, collection, item, owner AS owner, 'mint' AS kind, block_number, event_index FROM nfts_issued
    UNION ALL SELECT 'nfts', collection, item, "to", 'transfer', block_number, event_index FROM nfts_transferred
    UNION ALL SELECT 'nfts', collection, item, NULL, 'burn', block_number, event_index FROM nfts_burned
    UNION ALL SELECT 'uniques', collection, item, owner, 'mint', block_number, event_index FROM uniques_issued
    UNION ALL SELECT 'uniques', collection, item, "to", 'transfer', block_number, event_index FROM uniques_transferred
    UNION ALL SELECT 'uniques', collection, item, NULL, 'burn', block_number, event_index FROM uniques_burned
  ) e
  ORDER BY pallet, collection, item, block_number DESC, event_index DESC
) last
WHERE kind <> 'burn';

-- Items per owner, for gallery and leaderboard pages.
CREATE OR REPLACE VIEW nft_holdings AS
SELECT pallet, owner, count(*) AS items FROM nft_owners GROUP BY pallet, owner;

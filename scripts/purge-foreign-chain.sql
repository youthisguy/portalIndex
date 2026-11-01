-- Removes everything another chain wrote into this database.
-- Real chain (Portaldot V3 testnet): 0xd4f9acbc…     Foreign chain: 0x6e7f1f24…
--
-- It finds the foreign chain by block number: its blocks are all above 500,000 while the real chain is far below,
-- so this is safe whether or not the real indexer has already resumed. (If the real chain ever passes block 500,000,
-- change the number in both places below.)
--
-- Run SECTION 1 and check the numbers. Only then run SECTION 2.

-- ===== SECTION 1: look first (read-only) =====
-- Expect foreign_first_block near 876,000-877,000 and a few thousand rows.
SELECT min(block_number) AS foreign_first_block, max(block_number) AS foreign_last_block, count(*) AS events_to_remove
FROM events WHERE block_number > 500000;
SELECT chain_key, last_block, updated_at FROM indexer_cursor;
SELECT slug, decoded_to FROM contracts;

-- ===== SECTION 2: remove it (run only if section 1 looks right) =====
BEGIN;
DO $$
DECLARE
  r record;
  n bigint;
  first_foreign bigint;
BEGIN
  SELECT min(block_number) INTO first_foreign FROM events WHERE block_number > 500000;
  IF first_foreign IS NULL THEN
    RAISE EXCEPTION 'No events above block 500000, so there is nothing to purge.';
  END IF;

  -- every real table with a block_number column: events, typed event tables, account_events, decoded_events, evm_transactions...
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'block_number'
  LOOP
    EXECUTE format('DELETE FROM %I WHERE block_number >= $1', r.table_name) USING first_foreign;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE NOTICE '% rows removed from %', n, r.table_name; END IF;
  END LOOP;

  -- Balances: the foreign chain's higher block numbers would stop the real chain from ever updating these rows.
  DELETE FROM account_balances WHERE block >= first_foreign;

  -- Contract decoders jumped to the foreign chain's block number, so they skipped every real block since the incident.
  -- Reset them to the real chain's last block from before it (265321); decoding is idempotent, so the range is simply re-decoded.
  UPDATE contracts SET decoded_to = LEAST(decoded_to, 265321);

  DELETE FROM indexer_cursor WHERE chain_key = '0x6e7f1f24628d2fa3a1ac81a8b45157c63b1037fee4123a7664aae2c55cdbbc36';
END $$;

-- Check the result, then run COMMIT (or ROLLBACK to undo everything above).
SELECT chain_key, last_block FROM indexer_cursor;
SELECT max(block_number) AS highest_event_block FROM events;
-- COMMIT;
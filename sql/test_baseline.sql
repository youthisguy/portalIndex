BEGIN;
-- snapshot at block 5: asset 7 had A=1000. Events at or before block 5 must be ignored.
INSERT INTO state_snapshots (kind, block) VALUES ('assets', 5);
INSERT INTO asset_baseline VALUES (7,'A',1000), (8,'M',50);
INSERT INTO assets_issued (block_number,event_index,block_hash,asset_id,owner,amount) VALUES (1,0,'h',7,'A',1000);
INSERT INTO assets_transferred (block_number,event_index,block_hash,asset_id,"from","to",amount) VALUES (6,0,'h',7,'A','B',100);
SELECT 'with snapshot (expect 7:A=900, 7:B=100, 8:M=50)' AS check;
SELECT * FROM asset_balances ORDER BY asset_id, holder;
-- a destroy after the snapshot wipes the baseline too
INSERT INTO assets_destroyed (block_number,event_index,block_hash,asset_id) VALUES (7,0,'h',8);
SELECT 'after destroy of asset 8 (expect no asset 8)' AS check;
SELECT * FROM asset_balances WHERE asset_id = 8;
ROLLBACK;
BEGIN;
-- no snapshot: behaves like before
INSERT INTO assets_issued (block_number,event_index,block_hash,asset_id,owner,amount) VALUES (1,0,'h',3,'X',10);
SELECT 'no snapshot (expect 3:X=10)' AS check;
SELECT * FROM asset_balances WHERE asset_id = 3;
ROLLBACK;

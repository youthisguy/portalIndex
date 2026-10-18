-- Fixture test: runs inside a transaction and rolls back, so no real data is touched.
BEGIN;
-- one asset: mint 1000 to A, A sends 300 to B, B burns 50, A sends 100 to C via approval, C deposits 10
INSERT INTO assets_issued (block_number,event_index,block_hash,asset_id,owner,amount) VALUES (1,0,'h',7,'A',1000);
INSERT INTO assets_transferred (block_number,event_index,block_hash,asset_id,"from","to",amount) VALUES (2,0,'h',7,'A','B',300);
INSERT INTO assets_burned (block_number,event_index,block_hash,asset_id,owner,balance) VALUES (3,0,'h',7,'B',50);
INSERT INTO assets_transferred_approved (block_number,event_index,block_hash,asset_id,owner,delegate,destination,amount) VALUES (4,0,'h',7,'A','D','C',100);
INSERT INTO assets_deposited (block_number,event_index,block_hash,asset_id,who,amount) VALUES (5,0,'h',7,'C',10);
-- expected: A=600, B=250, C=110
SELECT 'asset 7 balances (expect A=600 B=250 C=110)' AS check; SELECT * FROM asset_balances WHERE asset_id=7 ORDER BY holder;
SELECT 'summary (expect holders=3 total=960)' AS check; SELECT * FROM asset_summary WHERE asset_id=7;
-- destroy then reuse id: only post-destroy activity should count
INSERT INTO assets_destroyed (block_number,event_index,block_hash,asset_id) VALUES (6,0,'h',7);
INSERT INTO assets_issued (block_number,event_index,block_hash,asset_id,owner,amount) VALUES (7,0,'h',7,'Z',5);
SELECT 'after destroy+reissue (expect only Z=5)' AS check; SELECT * FROM asset_balances WHERE asset_id=7;
-- NFTs: mint item 1 to A, transfer to B, mint item 2 to A, burn item 2
INSERT INTO nfts_issued (block_number,event_index,block_hash,collection,item,owner) VALUES (10,0,'h',1,1,'A');
INSERT INTO nfts_transferred (block_number,event_index,block_hash,collection,item,"from","to") VALUES (11,0,'h',1,1,'A','B');
INSERT INTO nfts_issued (block_number,event_index,block_hash,collection,item,owner) VALUES (12,0,'h',1,2,'A');
INSERT INTO nfts_burned (block_number,event_index,block_hash,collection,item,owner) VALUES (13,0,'h',1,2,'A');
INSERT INTO uniques_issued (block_number,event_index,block_hash,collection,item,owner) VALUES (14,0,'h',9,1,'Q');
SELECT 'nft owners (expect nfts 1/1=B, uniques 9/1=Q, no item 2)' AS check; SELECT * FROM nft_owners ORDER BY pallet, collection, item;
SELECT 'holdings' AS check; SELECT * FROM nft_holdings ORDER BY pallet, owner;
ROLLBACK;

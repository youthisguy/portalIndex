-- Real activity per 500-block bucket (about 50 minutes), for the stat-card charts.
-- blocks: distinct blocks indexed, so a drop shows a gap in coverage.
CREATE OR REPLACE VIEW activity_buckets AS
SELECT (block_number / 500) AS b,
       min(block_number)                                   AS first_block,
       count(*)                                            AS events,
       count(DISTINCT block_number)                        AS blocks,
       count(*) FILTER (WHERE pallet = 'assets')           AS asset_events,
       count(*) FILTER (WHERE pallet IN ('nfts','uniques')) AS nft_events
FROM events
GROUP BY 1;

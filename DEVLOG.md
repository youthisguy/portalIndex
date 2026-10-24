# Dev log

## 2026-10-15
- Portaldot V3 testnet RPC is down (team upgrading). Using Westend Asset Hub as a stand-in chain.
- Metadata spike worked: Assets, Uniques, Nfts, Revive, Balances all present.
- Revive logs surface as Substrate events: Revive.ContractEmitted(contract: H160, data, topics).
  Also Revive.Instantiated(deployer, contract). reviveApi has accountId and address for H160/SS58 mapping.
- Staking pallet has EraPaid, Rewarded, Slashed, Kicked, Chilled, ValidatorPrefsSet (on stand-in only).
- ForeignAssets and PoolAssets reuse the Assets event shape, so generic handling covers them.
- Fix: some pallets lack typeName in event fields. Use registry.lookup.getTypeDef(f.type) instead.
- Ingester running against stand-in chain, cursor resume verified.

## 2026-10-16
- Docker reinstalled; Postgres up via compose, schema loaded.
- Ingester verified on Westend Asset Hub: backfill, live follow, and restart resume (no gaps).
- PostGraphile failed: table `cursor` clashed with its built-in Cursor type. Renamed to `indexer_cursor`.
- Zero-handler typed table generator working: tables are created from chain metadata, one per event, for the pallets set in PALLETS.
- PostGraphile added as a project dependency (npm run api). ingest and api scripts added to package.json.

## 2026-10-17
- New Portaldot RPC live. Metadata dumped: Assets, Uniques, Nfts, Revive, Balances, Staking all present. Contracts (WASM) and Revive (EVM) both emit ContractEmitted.
- Ingesting Portaldot into a separate database (167 typed tables generated, same code as the Westend run).
- Node is pruned (no archive): state for old blocks is discarded. Added indexer_gaps table and gap-skip logic; tested by forcing the cursor back.
- EVM endpoint verified: chain ID 420420777.
- Era data readable from storage (historyDepth 84, eras 0-18 verified); 1-2 validators on testnet.

## 2026-10-18
- Derived views built from the typed tables: asset_balances, asset_summary, nft_owners, nft_holdings. Fixture-tested in Postgres.
- state-check found 2 assets and 1 balance already on Portaldot, created before indexing started. Added baseline snapshot (asset_baseline, state_snapshots, scripts/snapshot-assets.ts) so derived balances are correct on a pruned node.
- Verified end to end on the live testnet: asset 2, one holder, 15000000000000000000 raw units, via REST.
- PostgREST added for the REST API (read-only web_anon role). Demo page added in demo/index.html.
- Docker restart policies set so containers survive Docker restarts.
- Started hosting on a Render account. One free web service now runs the ingester and PostgREST together (Dockerfile + start.sh); the ingester applies sql/ migrations on startup.
- Hosted API: https://portalindex-98f0.onrender.com. Asset baseline snapshot taken at block 92525 (asset 2, one holder).
- Demo page deployed as a Render static site: https://pindex.onrender.com/ (reads the hosted API; ?api= overrides the API address).
- Hosted API verified: asset 2 with its holder via REST, indexer_gaps empty, cursor advancing with the chain.

## 2026-10-19
- Ingester stalled 12 h on a staking.Rewarded event (RewardDestination enum has a None variant); fixed Option detection and added poison-block skipping.
- Token distribution landed. First real NFTs, asset balances and contract events (Revive) now indexed; 8 contracts deployed by 6 deployers seen in revive_instantiated.
- Added transfers panel, native balances (account_balances) and an event backfill (006_balances.sql).
- RPC dropped the websocket (1006) after a deploy; ingester recovered. Added a 5 minute watchdog and made disconnects transient (never counted as bad blocks).

## 2026-10-20
- App UI rebuilt around the explorer layout: nav, hero search, stat cards, three feeds (blocks, transfers, events), mobile layout (nav hidden on phones, stat grid collapses, rows wrap).
- tPOT (native token) added to the token-holders dropdown. Ingester now syncs every native balance from chain storage at startup and hourly (syncNativeBalances), without overwriting 

## 2026-10-21
- Retention probe (scripts/retention-check.ts): the public node now serves events from block 1 and keeps old block bodies. On 2026-10-17 state for blocks 1, 1000 and 50000 was discarded, so retention has changed. README claims about a pruned node corrected.
- Skipped-block gap filling deployed: the two 'processing error' gaps (blocks 107052 and 107245, WebSocket drops on Oct 19) were re-read and marked filled; unfilled gaps now 0. Filled rows are kept with filled_at.
- Home page copy reworked to describe what Pindex does for builders (address search, token and NFT holders, contract events over REST) instead of comparing with other tools.
- Next: backfill history from block 1 now that the node serves it.
- Contract registry shipped. Anyone can POST a contract address and Solidity event ABI to /contracts and get a slug, a URL and a manage token. Decoded events are served at /c/<slug>/events with name, block range, limit and order filters.
- Decoding reads revive.ContractEmitted rows from the existing events table (decode worker, sql/008_contracts.sql: contracts + decoded_events). Backfill and live decoding share one code path, and ingest.ts is unchanged.
- registry.ts is now the public front door on $PORT: it handles /contracts and /c/*, and proxies everything else to PostgREST on internal port 3000. The old API URL keeps working. start.sh runs PostgREST, the ingester and the registry, and the container restarts if any of them exits.
- Manage token is stored as a sha256 hash and never exposed through PostgREST (web_anon revoked on contracts). Resync and delete need the token. Registrations are rate-limited per address and the registry is capped at 200 contracts.
- Landing page rebuilt around the registry: registration form (paste, upload .json or Hardhat/Foundry artifact), live decode-progress panel, looping console walkthrough, gradients, shared footer.
- Added scripts/guess-abi.mjs: recovers an event ABI from a contract's on-chain logs by looking up topic0 in a signature database and matching the indexed/non-indexed split against real logs.
- Verified on the live testnet with 0x74fc…cc71: 5 distinct event types seen, 1 recovered (PoolWhitelisted(address,bool)). Pindex decoded 3 of 3 matching logs with correct pool and whitelisted values, and skipped the other 4 types without errors. Decode reached the chain head (block 133,289).
- Known limits: history starts at the first indexed block (indexed_from_block). Gap fills are not decoded automatically, so use resync after a fill. Custom events need the real ABI. Solidity ABIs only, not ink! metadata.
- Next: README (move contract decoding from Planned to Working, document /contracts and /c/<slug>/events), raw-logs endpoint for contracts without an ABI, backfill history from block 1 now that the node serves it.

## 2026-10-24
- README updated: status live on V3 testnet.
- Added Links section and full contract-registry docs (endpoints + limits).
- Documented checkpoint contract (address `0x6a5cce928e49c5062acD7aA876335a8041c7adc9`, block 135953, deployer, deployment tx).
- Working / Planned lists refreshed to match current code.
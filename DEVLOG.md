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

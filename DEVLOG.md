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

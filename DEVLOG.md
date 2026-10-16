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

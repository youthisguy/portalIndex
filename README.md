# PortalIndex

A metadata-driven indexer for Portaldot V3. It reads runtime metadata and
generates Postgres tables, a REST API and a GraphQL API for any pallet's
events, with no per-pallet handler code.

> Status: early development (Portaldot V3 Hacker House, Oct 14 - Nov 6, 2026).
> Tested against the Portaldot V3 testnet and Westend Asset Hub.

## Why
Portaldot builders currently have to write their own block scrapers to answer
basic questions like token holders, NFT ownership or contract events. The
public testnet node is also pruned (state for old blocks is discarded), so
history that is not captured as it happens is lost. PortalIndex captures it,
records any gaps it could not capture, and serves it back as an API.

## How it works
1. The ingester connects to a Substrate RPC and walks finalized blocks only
   (no reorg handling needed).
2. At startup it reads the chain metadata and creates one typed table per event
   (for example `balances_transfer`, `nfts_issued`) for the pallets you choose.
3. Every event is also stored in a generic `events` table as JSONB.
4. Events and a restart-safe cursor are written in one transaction per block.
5. If the node has pruned blocks the indexer needs, the missing range is
   recorded in `indexer_gaps` and ingestion resumes at a recent block.
6. SQL views derive current state (asset balances, NFT owners) from the events,
   layered on a storage snapshot for anything that existed before indexing began.
7. PostgREST serves tables and views as a REST API; PostGraphile serves GraphQL.

Choose pallets with an env var, no code changes:

    PALLETS="assets,uniques,nfts,balances,staking" npm run ingest

On the Portaldot testnet this generated 167 typed tables from metadata alone.

## Status
Working:
- Finalized-block ingestion with restart-safe cursor and gap recording
- Typed tables generated from metadata
- REST API (PostgREST) and GraphQL API (PostGraphile)
- Derived views: `asset_balances`, `asset_summary`, `nft_owners`, `nft_holdings`
- Asset baseline snapshot from chain storage
- Demo page (token holders, NFT owners, latest events)
- H160 <-> native account mapping check via `reviveApi`
- Checkpoint contract (`contracts/PortalIndexCheckpoint.sol`), compiled; not yet deployed

Planned:
- Revive (EVM) and Contracts (ink!/WASM) `ContractEmitted` decoding with user-supplied ABI / metadata
- Address mapping table (H160 <-> SS58)
- Per-era staking snapshots from chain storage
- Rolling state hash anchored on-chain by the checkpoint contract
- `pindex init` one-command setup and a hosted endpoint

## Quick start
Requires Node 20+ and Docker.

    npm install
    docker compose up -d

Start the ingester (Portaldot V3 testnet shown):

    WS_URL=wss://test-node-v3.portaldot.dev \
    PALLETS="assets,uniques,nfts,balances,staking,session,imOnline,offences,revive,contracts" \
    npm run ingest

Take the asset baseline once (and again after any gap):

    WS_URL=wss://test-node-v3.portaldot.dev npx tsx scripts/snapshot-assets.ts

Serve the APIs in other terminals:

    npm run api          # GraphQL on http://localhost:5000/graphiql

    docker run -d --name portalindex-rest --network portalindex_default -p 3000:3000 \
      -e PGRST_DB_URI="postgres://portalindex:portalindex@portalindex-db:5432/portalindex" \
      -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=web_anon postgrest/postgrest

(Create the read-only `web_anon` role first; see `sql/` and the DEVLOG.)

Try it:

    curl "http://localhost:3000/events?order=block_number.desc&limit=3"
    curl "http://localhost:3000/asset_balances?order=balance.desc"
    curl "http://localhost:3000/nft_owners?limit=20"

Open `demo/index.html` in a browser for the holders and NFT demo. It reads the
REST API and shows labeled sample data if the API is empty or unreachable.

Environment variables: `WS_URL` (required), `PALLETS`, `BACKFILL` (blocks to
backfill on first run, default 200), `START_BLOCK`, `DATABASE_URL`,
`SAFE_WINDOW` (blocks to resume behind the head after a gap, default 150).

## Findings about the Portaldot V3 testnet
- The public node is pruned: state for old blocks is discarded, so history
  cannot be backfilled from it. Staking era data is the exception (84 eras are
  kept in storage).
- Two contract runtimes are present: `Contracts` (WASM/ink!) and `Revive` (EVM).
  Both emit `ContractEmitted`.
- `reviveApi.accountId` / `reviveApi.address` map between H160 and native
  accounts (`scripts/map-address.ts`).

## Limits
- Derived state replays events, so it is only as complete as the events
  captured plus the baseline snapshot. Native token balances are not derived.
- Gaps while the ingester is offline longer than the node's state window are
  unrecoverable; they are recorded in `indexer_gaps`.
- Schema changes after runtime upgrades are not migrated yet.

## Scripts
- `scripts/dump-metadata.ts`: pallets, events and runtime APIs of any chain
- `scripts/archive-check.ts`: tests whether a node still serves old state
- `scripts/state-check.ts`: counts assets and NFTs already in chain storage
- `scripts/snapshot-assets.ts`: stores the asset baseline
- `scripts/era-scan.ts`: staking era data readable from storage
- `scripts/map-address.ts`: H160 <-> native account mapping

## Third-party software
- polkadot-js (`@polkadot/api`), Apache-2.0
- node-postgres (`pg`), MIT
- PostGraphile, MIT
- PostgREST, MIT
- PostgreSQL, PostgreSQL License
- Docker (local setup)

## License
[MIT](LICENSE)
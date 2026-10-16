# PortalIndex

A metadata-driven indexer for Portaldot V3. It reads runtime metadata and
generates Postgres tables and a GraphQL API for any pallet's events, with no
per-pallet handler code.

> Status: early development (Portaldot V3 Hacker House, Oct 14 - Nov 6, 2026).
> Developed against Westend Asset Hub while the Portaldot testnet RPC was down.

## Why
Portaldot builders currently have to write their own block scrapers to answer
basic questions like token holders, NFT ownership, or contract events.
PortalIndex provides that data layer out of the box.

## How it works
1. The ingester connects to a Substrate RPC and walks finalized blocks only
   (no reorg handling needed).
2. At startup it reads the chain metadata and creates one typed table per event
   (for example `balances_transfer`, `nfts_issued`) for the pallets you choose.
3. Every event is also stored in a generic `events` table as JSONB.
4. Events and a restart-safe cursor are written in one transaction per block.
5. PostGraphile serves the tables as a GraphQL API.

Choose pallets with an env var, no code changes:

    PALLETS="assets,uniques,nfts,balances,staking" npm run ingest

## Status
Working:
- Finalized-block ingestion with restart-safe cursor
- Generic `events` table
- Typed tables generated from metadata
- GraphQL API via PostGraphile

Planned:
- Revive `ContractEmitted` decoding with a user-supplied ABI
- H160 <-> SS58 address mapping
- Derived state tables (token balances, NFT ownership)
- Schema migration on runtime upgrades
- `pindex init` one-command setup, hosted endpoint, TypeScript client

## Quick start
Requires Node 20+ and Docker.

    npm install
    docker compose up -d
    WS_URL=<substrate-ws-endpoint> npm run ingest

In a second terminal:

    npm run api

Open http://localhost:5000/graphiql and try:

    { allEvents(first: 5) { nodes { blockNumber pallet name data } } }

Environment variables: `WS_URL` (required), `PALLETS`, `BACKFILL` (blocks to
backfill on first run, default 200), `START_BLOCK`, `DATABASE_URL`.

## Metadata spike
Dump a chain's pallets, events and runtime APIs to `docs/pallets.md`:

    WS_URL=<substrate-ws-endpoint> npx tsx scripts/dump-metadata.ts

## Third-party software
- polkadot-js (`@polkadot/api`), Apache-2.0
- node-postgres (`pg`), MIT
- PostGraphile, MIT
- PostgreSQL, PostgreSQL License
- Docker (local setup)

## License
MIT

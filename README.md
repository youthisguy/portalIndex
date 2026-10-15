# PortalIndex

A metadata-driven indexer for Portaldot V3. It reads runtime metadata and
generates Postgres tables and a GraphQL API for Assets, Uniques, Nfts, Staking
and Revive (EVM) contract events, with no per-pallet handler code.

> Status: early development (Portaldot V3 Hacker House, Oct 14 - Nov 6, 2026).

## Why
Portaldot builders currently have to write their own block scrapers to answer
basic questions like token holders, NFT ownership, or contract events.
PortalIndex aims to provide that data layer out of the box.

## Planned features
- Metadata-driven schema generation (new pallets need no handler code)
- Finalized-block ingestion with restart-safe cursor
- Revive `ContractEmitted` events decoded with a user-supplied ABI
- H160 <-> SS58 address mapping
- GraphQL API (PostGraphile/Hasura) and a one-command Docker setup

## Quick start
Work in progress. Metadata spike:

    npm install
    WS_URL=<substrate-ws-endpoint> npx tsx scripts/dump-metadata.ts

Output is written to `docs/pallets.md`.

## Third-party software
- polkadot-js (`@polkadot/api`), Apache-2.0
- Postgres, PostGraphile or Hasura (to be added)

## License
MIT

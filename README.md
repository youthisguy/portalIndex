# Pindex — The public data layer for Portaldot V3

![Status](https://img.shields.io/badge/status-live%20on%20testnet-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)
![Tests](https://github.com/youthisguy/portalIndex/actions/workflows/test.yml/badge.svg)

Pindex indexes the Portaldot V3 testnet and serves it as a REST API and a searchable app, so any dApp can query token holders, NFT owners or a contract's decoded events without writing a scraper.

It reads runtime metadata and auto-generates Postgres tables, a REST API, and a GraphQL API for any pallet's events with **zero per-pallet handler code**.

**Search any address. See token holders & NFT owners. Or paste a contract address + ABI to get a public endpoint for its decoded events.**

## Links
- **App**: https://pindex.onrender.com/app/
- **Home & API docs**: https://pindex.onrender.com/
- **Public REST API**: https://portalindex-98f0.onrender.com
- **Pitch deck (PDF)**: [docs/pindex_pitchdeck.pdf](docs/pindex_pitchdeck.pdf)
- Architecture diagram: [docs/architecture.mermaid](docs/architecture.mermaid)
- Development log: [DEVLOG.md](DEVLOG.md)

---

### The Problem
Portaldot V3 has no EVM transaction explorer yet. The node console only opens block numbers, and the organizers confirmed a dedicated explorer is still to come. So every builder who needs to verify a transaction, or who needs token holders, NFT owners or decoded contract events, ends up writing the same block scraper.

Pindex does that work **once** for the entire ecosystem and exposes it as a free, public, production-ready API.

This already happened in practice: [PotKit](https://github.com/itsjusttu/potkit-portaldot) (Track 4, RWA) hit exactly this gap, found no explorer that resolves EVM transaction hashes, and now uses Pindex to verify its on-chain lifecycle.

---

### Key Features

| Feature | Description |
|---------|-------------|
| **Zero-code indexing** | Runtime metadata → typed tables automatically. Adding a new pallet is just a config change. |
| **Dual-VM native** | Indexes both `Contracts` (WASM) and `Revive` (EVM). Full H160 ↔ SS58 mapping via `reviveApi`. |
| **Public contract registry** | Paste any Solidity address + ABI → instant public endpoint for decoded events. |
| **Honest coverage** | Public `indexer_gaps` table. Every unreadable range is recorded, retried, and marked. |
| **Ready-to-use APIs** | REST (PostgREST) + GraphQL (PostGraphile). Open CORS, no API key required. |
| **Shareable search** | Search any native (`5…`) or EVM (`0x…`) address, EVM transaction hash, block, or contract. Every result has a shareable link. |

---

### Screenshots

**Address lookup**

![Address Lookup](docs/screenshot_5.png)

**Token holders**

![Token Holders](docs/screenshot_2.png)

**NFT owners**

![NFT Owners](docs/screenshot_3.png)

**Contract registry**

![Contract Registry](docs/screenshot_4.png)



---

### Architecture

```mermaid
flowchart TB
    subgraph Chain["Portaldot V3 Testnet"]
        RPC["Substrate RPC (wss)"]
        META["Runtime Metadata"]
        REV["Revive pallet events"]
        NATIVE["Native pallets<br/>Assets • Uniques • Nfts • Balances"]
        RPC --- META
        RPC --- REV
        RPC --- NATIVE
    end

    subgraph Ingest["Pindex Ingester"]
        FIN["Finalized block walker + backfill"]
        DEC["Event / extrinsic decoder"]
        SCHEMA["Schema generator<br/>(metadata → SQL)"]
        ABI["ABI decoder<br/>(user-supplied)"]
        MAP["Address mapper<br/>(H160 ↔ SS58 via reviveApi)"]
        FIN --> DEC
        DEC --> ABI
        DEC --> MAP
    end

    subgraph Store["PostgreSQL"]
        GEN["Generic tables<br/>events • extrinsics"]
        TYPED["Typed tables<br/>(auto-generated)"]
        EVM["Decoded contract logs"]
        ADDR["Address map"]
        CKPT["Cursor + checkpoints"]
    end

    subgraph API["API Layer"]
        REST["REST API (PostgREST)"]
        GQL["GraphQL (PostGraphile)"]
        REST --- GQL
    end

    subgraph Clients["Consumers"]
        DApps["Any dApp"]
        Tools["Dashboards & tools"]
        Explorers["Custom explorers"]
    end

    ANCHOR["On-chain Checkpoint Contract"]
    CLI["One-command setup"]

    META --> SCHEMA
    SCHEMA --> GEN
    SCHEMA --> TYPED
    RPC --> FIN
    DEC --> GEN
    DEC --> TYPED
    ABI --> EVM
    MAP --> ADDR
    FIN --> CKPT
    Store --> REST
    Store --> GQL
    REST --> DApps
    GQL --> Tools
    GQL --> Explorers
    CKPT --> ANCHOR
    CLI -.-> Ingest
    CLI -.-> Store
    CLI -.-> API
```

---

## Built for Portaldot V3

Pindex is designed specifically around V3 capabilities:

- Runtime metadata → automatic schema generation (no handlers)
- Both contract runtimes (`Contracts` + `Revive`)
- `reviveApi` for H160 ↔ native (SS58) address mapping
- Assets, Uniques, Nfts, Balances and Staking pallets
- Finalized blocks only + honest gap tracking

## How it works
1. The ingester connects to a Substrate RPC and walks finalized blocks only
   (no reorg handling needed).
2. At startup it reads the chain metadata and creates one typed table per event
   (for example `balances_transfer`, `nfts_issued`) for the pallets you choose.
3. Every event is also stored in a generic `events` table as JSONB.
4. Events and a restart-safe cursor are written in one transaction per block.
5. If a range cannot be read, it is recorded in `indexer_gaps`, retried, and
   marked filled (or unrecoverable). Coverage is public.
6. SQL views derive current state (asset balances, NFT owners) from the events,
   layered on a storage snapshot for anything that existed before indexing began.
7. A decode worker turns raw `revive.ContractEmitted` rows into readable events for every registered contract, using the ABI the owner supplied.
8. For blocks with non-inherent extrinsics, the ingester reads the block body and stores each EVM transaction (`revive.ethTransact`) in `evm_transactions`, keyed by its Ethereum hash (keccak-256 of the signed payload).
9. PostgREST serves tables and views as a REST API; PostGraphile serves GraphQL.

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
- Search by address (native or EVM), EVM transaction hash, block number or block hash, with shareable links
- EVM transactions indexed from `revive.ethTransact` extrinsics (hash, sender, recipient, value, method selector, nonce, status), served at `/evm_transactions`
- Contract registry: register an address and a Solidity ABI from the home page or the API, read decoded events from a public URL
- Hosted REST API on Render (read-only data, plus contract registration), with the ingester in the same container
- H160 <-> native account mapping check via `reviveApi`
- Checkpoint contract deployed on the V3 testnet (`contracts/PortalIndexCheckpoint.sol`)
- Automated tests (`npm test`)

Planned:
- Per-era staking snapshots from chain storage
- Automatic rolling state hash anchored on-chain by the checkpoint contract
- ink! (Contracts pallet) metadata decoding
- `pindex init` one-command setup
- Hosted paid tier (see Commercial path)

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
    npx tsx src/registry.ts   # contract registry on http://localhost:10000, proxies everything else to PostgREST

    docker run -d --name portalindex-rest --network portalindex_default -p 3000:3000 \
      -e PGRST_DB_URI="postgres://portalindex:portalindex@portalindex-db:5432/portalindex" \
      -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=web_anon postgrest/postgrest

(Create the read-only `web_anon` role first; see `sql/` and the DEVLOG.)

Try it:

    curl "http://localhost:3000/events?order=block_number.desc&limit=3"
    curl "http://localhost:3000/asset_balances?order=balance.desc"
    curl "http://localhost:3000/nft_owners?limit=20"

Open `demo/app/index.html` in a browser for the holders and NFT demo. It reads the
REST API and shows labeled sample data if the API is empty or unreachable.
To point the home page at your local registry, open `demo/index.html?api=http://localhost:10000`.

Environment variables: `WS_URL` (required), `PALLETS`, `BACKFILL` (blocks to
backfill on first run, default 200), `START_BLOCK`, `DATABASE_URL`,
`SAFE_WINDOW` (blocks to resume behind the head after a gap, default 150).
Registry: `PORT` (default 10000), `POSTGREST_URL`, `PUBLIC_URL`, `MAX_CONTRACTS` (default 200), `REG_PER_IP_PER_DAY` (default 20).

## Tests
One command, no database and no network needed:

    npm test

This runs 42 unit tests with [Vitest](https://vitest.dev) covering:
- **Metadata parsing and table generation** (`test/unit/typed.test.ts`): type mapping, column naming, idempotent inserts, exact u128 handling
- **Event decoding** (`test/unit/decode.test.ts`): Solidity event logs decoded with a user ABI
- **Gap recording and error handling** (`test/unit/errors-gaps.test.ts`): which failures are retried and which become gaps
- **Address mapping** (`test/unit/address.test.ts`): H160 ↔ SS58, using a vector taken from the live chain
- **EVM transaction hashes** (`test/unit/evm-tx.test.ts`): hash, sender and field extraction for EIP-1559, legacy and contract-creation transactions

A second command checks the running API's response shapes, including that the checkpoint contract's deployment was indexed:

    npm run test:live                                  # hosted API
    API=http://localhost:10000 npm run test:live       # your local registry

The live checkpoint test passes only on a database that has indexed block 135953.

## Hosted testnet endpoint
A read-only REST API for the Portaldot V3 testnet is hosted at
https://portalindex-98f0.onrender.com
The ingester, the registry and the API run together in one container (`Dockerfile`, `start.sh`).

Live demo page: https://pindex.onrender.com/ (reads the hosted API).

    curl "https://portalindex-98f0.onrender.com/indexer_cursor"
    curl "https://portalindex-98f0.onrender.com/asset_balances"
    curl "https://portalindex-98f0.onrender.com/events?order=block_number.desc&limit=5"
    curl "https://portalindex-98f0.onrender.com/indexer_gaps"
    curl "https://portalindex-98f0.onrender.com/evm_transactions?to_addr=eq.0x6a5cce928e49c5062acd7aa876335a8041c7adc9&order=block_number.desc&limit=5"

Large integers (token balances) are returned as JSON numbers; parse them as big integers.

## Contract registry
Register a Solidity contract and read its decoded events from one URL. Use the form on the [home page](https://pindex.onrender.com/#contracts) or the API:

```
POST   /contracts            { address, abi, name? }  ->  { slug, url, manage_token }
GET    /c/<slug>             indexed range, decode progress, event counts
GET    /c/<slug>/events      ?name=Transfer&limit=50&order=asc
POST   /c/<slug>/resync      (Bearer manage_token)
DELETE /c/<slug>             (Bearer manage_token)
```

History starts at the first block Pindex indexed (`indexed_from_block` on the contract page). Only events are decoded, and only Solidity ABIs.

## Checkpoint contract (deployed)
`contracts/PortalIndexCheckpoint.sol` stores `(blockNumber, stateHash)` pairs published by its owner, and lets anyone verify a hash against the anchored one.

|                   |                                               |
| ----------------- | --------------------------------------------- |
| Network           | Portaldot V3 testnet (EVM chain ID 420420777) |
| Address           | `0x6a5cce928e49c5062acD7aA876335a8041c7adc9`  |
| Deployed at block | 135953                                        |
| Deployer          | `0x378598779d64d4c0ee191dbb98a487535e2b7048`  |
| Deployment tx     | `0x6459ab692c450bb9088b38673bf7eb1b76346f6400706372abf111acfe93eb33` |

Publishing a checkpoint is a manual call for now. Automatic state-hash publishing is planned.

## Evidence: verify it yourself
Each step below uses the public API and needs only `curl`.

**1. The indexer is live.** `last_block` keeps rising and `updated_at` is recent:

    curl "https://portalindex-98f0.onrender.com/indexer_cursor"

**2. Pindex indexed the checkpoint contract's own deployment** (block 135953, deployer and contract as in the table above):

    curl "https://portalindex-98f0.onrender.com/revive_instantiated?contract=eq.0x6a5cce928e49c5062acd7aa876335a8041c7adc9"

Returned on 2026-10-27:

    [{"block_number":135953,"event_index":9,"block_hash":"0xd62ea2faca0be6fb4eaa46b9310f1c32df9e52d90ec2309030ff25fb7431ab46","extrinsic_index":1,"block_time":"2026-10-21T19:43:54+00:00","deployer":"0x378598779d64d4c0ee191dbb98a487535e2b7048","contract":"0x6a5cce928e49c5062acd7aa876335a8041c7adc9"}]

**3. Decode the checkpoint contract's events with the registry.** The constructor emits `OwnershipTransferred(address(0), deployer)`, so a fresh registration should show exactly one such event at block 135953:

    curl -X POST https://portalindex-98f0.onrender.com/contracts \
      -H "content-type: application/json" \
      -d '{"name":"checkpoint","address":"0x6a5cce928e49c5062acd7aa876335a8041c7adc9","abi":[
        {"type":"event","name":"Checkpoint","anonymous":false,"inputs":[
          {"name":"blockNumber","type":"uint256","indexed":true},
          {"name":"stateHash","type":"bytes32","indexed":false},
          {"name":"publisher","type":"address","indexed":true},
          {"name":"timestamp","type":"uint256","indexed":false}]},
        {"type":"event","name":"OwnershipTransferred","anonymous":false,"inputs":[
          {"name":"previousOwner","type":"address","indexed":true},
          {"name":"newOwner","type":"address","indexed":true}]}]}'

    curl "https://portalindex-98f0.onrender.com/c/<slug>/events?order=asc"

Expected `args` for that event (addresses use checksum case):

    {"previousOwner":"0x0000000000000000000000000000000000000000","newOwner":"0x378598779D64d4C0EE191dbb98A487535E2B7048"}

**4. Coverage is public.** Every range the indexer could not read is listed, with its reason and whether it was filled:

    curl "https://portalindex-98f0.onrender.com/indexer_gaps"

**5. Search an EVM transaction by its hash.** The deployment transaction of the checkpoint contract, and a later `publish` call to it (block 254845, one `Checkpoint` event):

    curl "https://portalindex-98f0.onrender.com/evm_transactions?tx_hash=eq.0xe898bbfd69f401b28ec0769fdc8b7dbadf5e3f8a2cfb9bf7cb71215a3392be32"
    curl "https://portalindex-98f0.onrender.com/evm_transactions?tx_hash=eq.0x4ac0c4532e20c70b563a112f03c616e9cbef93e78f22478f6f12c25098a02609"

The hash is the same one the chain's EVM RPC reports (`eth_getTransactionByHash`) and that wallets show. Open it in the app: https://pindex.onrender.com/app/?q=0x4ac0c4532e20c70b563a112f03c616e9cbef93e78f22478f6f12c25098a02609

## Limits
- Derived state replays events, so it is only as complete as the events
  captured plus the baseline snapshot. Native token balances are not derived.
- A range the node cannot serve is recorded in `indexer_gaps` and retried; ranges that stay unreadable are marked unrecoverable. History before indexing began (about block 92,500 on the hosted instance) is not backfilled yet.
- Contract decoding covers Solidity (Revive) events only. ink! metadata is not supported yet, and indexed strings, bytes and arrays appear as hashes, as on any EVM chain.
- Schema changes after runtime upgrades are not migrated yet.
- Registration needs no account, so the hosted instance has basic anti-abuse caps: 20 registrations per IP per day and 200 contracts in total. Self-hosting has no such limit unless you set one.
- Gap fills are not decoded automatically for registered contracts; use `POST /c/<slug>/resync`.
- Only EVM transactions are searchable. Native extrinsic hashes (for example a plain transfer) are not stored.

## Scripts
- `scripts/dump-metadata.ts`: pallets, events and runtime APIs of any chain
- `scripts/archive-check.ts`: tests whether a node still serves old state
- `scripts/state-check.ts`: counts assets and NFTs already in chain storage
- `scripts/snapshot-assets.ts`: stores the asset baseline
- `scripts/era-scan.ts`: staking era data readable from storage
- `scripts/map-address.ts`: H160 <-> native account mapping
- `scripts/tx-check.ts`: derives the Ethereum hash of every EVM transaction in a block and compares it with the chain's EVM RPC
- `scripts/backfill-txs.ts`: fills `evm_transactions` for blocks that were already indexed

## Third-party software
- polkadot-js (`@polkadot/api`), Apache-2.0
- node-postgres (`pg`), MIT
- PostGraphile, MIT
- PostgREST, MIT
- PostgreSQL, PostgreSQL License
- Docker (local setup)
- ethers (ABI decoding in the contract registry), MIT
- Vitest (tests), MIT
- Umami Cloud (page analytics script on the hosted site)

## License
[MIT](LICENSE)
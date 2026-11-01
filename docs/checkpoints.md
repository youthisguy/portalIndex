# Checkpoints: a rolling state hash anchored on-chain

Pindex periodically publishes one 32-byte hash to the `PortalIndexCheckpoint` contract
(`0x4DF57190DEbe09D922D1AfE9458AfF439bcd2Cb1`, Portaldot V3 testnet). The hash commits to every event the indexer
has stored up to a finalized block, and to every range it could not read. Anyone can recompute it from the public API
and compare it with the contract, so the index cannot be quietly changed after the fact.

## What is hashed

For each block `B` that has at least one stored event, in block order:

```
eventsDigest(B) = keccak256( line(e1) + "\n" + line(e2) + ... )          events of B sorted by event_index
line(e)         = event_index | lowercase(block_hash) | pallet.name | canonicalJson(data)
H               = keccak256( abi.encodePacked( H, uint256 B, bytes32 eventsDigest(B) ) )
```

- `H` starts at `0x00…00` (32 zero bytes).
- `canonicalJson` is JSON with object keys sorted (UTF-16 order) at every depth and no whitespace. Numbers are read as
  IEEE-754 doubles, as any JavaScript client reads them (large integers are stored as strings and are unaffected).
- A range the indexer could never read (`indexer_gaps` rows that are unfilled and are not `processing error…`, for example
  `state pruned by node`) is part of the record. At its `from_block`, after that block's events, apply
  `H = keccak256( abi.encodePacked( H, uint256 from_block, keccak256("gap|<from>|<to>") ) )`.
- A skipped block still waiting to be re-read (`processing error…`, unfilled) holds the checkpoint back, because its
  data will change. The worker waits until it is filled.

The checkpoint published for block `N` is `H` after every step with block `<= N`. Checkpoints are published at multiples of
`CHECKPOINT_EVERY` blocks (default 1000, about every 100 minutes), so each one extends the previous: to check a new
checkpoint you only need the blocks since the last one you trust.

## Verify one yourself

Needs only the public API and the public EVM RPC, no database and no key:

```bash
npx tsx scripts/verify-checkpoint.ts            # latest checkpoint
npx tsx scripts/verify-checkpoint.ts 134000     # a specific one
```

It reads every event from `/events` (paged), the gaps from `/indexer_gaps`, recomputes the hash from block 0, and
compares it with `checkpoints(N)` and `verify(N, hash)` on the contract. `MATCH` means the API's data reproduces
what was anchored.

You can also look at what has been published: `latest()` returns the newest `(blockNumber, stateHash)`, and every
publication emits `Checkpoint(blockNumber, stateHash, publisher, timestamp)`.

## Run the publisher

The worker is `src/checkpoint.ts`. It runs next to the indexer and only starts when `CHECKPOINT_PRIVATE_KEY` is set.

| Variable | Default | Meaning |
|---|---|---|
| `CHECKPOINT_PRIVATE_KEY` | none (worker off) | Key of the contract owner. Keep it a secret; never commit it. |
| `CHECKPOINT_EVERY` | `1000` | Publish at multiples of this many blocks |
| `CHECKPOINT_INTERVAL_MIN` | `15` | How often it checks whether a new checkpoint is due |
| `CHECKPOINT_CONTRACT` | the address above | Contract to publish to |
| `EVM_RPC` | `https://test-evm-rpc-v3.portaldot.dev` | EVM JSON-RPC endpoint |
| `CHECKPOINT_DRY_RUN` | off | `1` computes and prints the hash without sending anything (no key needed) |

Before it publishes anything it checks that the wallet is the contract owner, and that the checkpoint already on-chain
is one the data reproduces. If someone published a different hash by hand, it stops with an error instead of building
on it.

Use a dedicated publisher wallet rather than your deployer key:

```bash
npx tsx scripts/checkpoint-admin.ts new-wallet                          # make a wallet; fund it with a little tPOT
OWNER_KEY=0x<deployer key> npx tsx scripts/checkpoint-admin.ts transfer 0x<publisher address>
npx tsx scripts/checkpoint-admin.ts status
```

## What this does and does not prove

It proves the indexed data has not been altered since it was anchored, and that the indexer's coverage (including what it
could not read) is exactly what the checkpoint says. It does not prove the data is correct against the chain: that
check is recomputing events from the node, which is what the index is built from. The publisher is a single key; a
compromised key could publish a wrong hash, which `verify-checkpoint` would show as a mismatch.

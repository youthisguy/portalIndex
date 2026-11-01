import { computeRange, ZERO_HASH, type Source } from "./checkpoint-hash.js";

type Query = (text: string, params?: unknown[]) => Promise<any[]>;

// What the worker needs from the chain. Kept as an interface so the whole flow can be tested without a node.
export interface Anchor {
  latest(): Promise<{ block: number; hash: string }>;
  owner(): Promise<string>;
  signer(): string | null;                      // address that will send the transaction, null when only reading
  publish(block: number, hash: string): Promise<string>; // returns the transaction hash once confirmed
}

export interface Deps {
  src: Source;
  cursor(): Promise<number>;                    // highest block the indexer has stored
  anchor: Anchor;
  every: number;                                // checkpoint at multiples of this many blocks
  dryRun: boolean;
  log(msg: string): void;
  memo: { block: number; hash: string } | null; // last checkpoint this process has already verified
}

export type Outcome =
  | { status: "idle"; reason: string }
  | { status: "blocked"; reason: string }
  | { status: "dry-run"; block: number; hash: string }
  | { status: "published"; block: number; hash: string; tx: string };

export async function checkpointOnce(d: Deps): Promise<Outcome> {
  const cursor = await d.cursor();
  const target = Math.floor(cursor / d.every) * d.every;
  const onchain = await d.anchor.latest();
  if (target <= onchain.block) return { status: "idle", reason: `nothing new: indexer at ${cursor}, last checkpoint ${onchain.block}` };

  // Never build on a hash we have not checked. The first time (or after anyone else published), re-derive the
  // on-chain checkpoint from the data; a mismatch means the database and the chain disagree and a human must look.
  let base = { block: onchain.block, hash: onchain.hash };
  if (onchain.block === 0) base = { block: 0, hash: ZERO_HASH };
  else if (!(d.memo && d.memo.block === onchain.block && d.memo.hash === onchain.hash)) {
    d.log(`verifying the existing checkpoint at ${onchain.block} from the data first…`);
    const check = await computeRange(d.src, ZERO_HASH, 0, onchain.block);
    if (check.blocked) return { status: "blocked", reason: `a skipped block (${check.blocked.from_block}-${check.blocked.to_block}) is waiting to be re-read` };
    if (check.hash.toLowerCase() !== onchain.hash.toLowerCase()) {
      throw new Error(`the checkpoint on-chain for block ${onchain.block} (${onchain.hash}) does not match the indexed data (${check.hash}); refusing to build on it`);
    }
    d.memo = { block: onchain.block, hash: onchain.hash };
  }

  const r = await computeRange(d.src, base.hash, base.block, target);
  if (r.blocked) return { status: "blocked", reason: `skipped block ${r.blocked.from_block}-${r.blocked.to_block} is still waiting to be re-read; will retry` };
  d.log(`block ${target}: hash ${r.hash} (${r.steps} steps since ${base.block})`);
  if (d.dryRun) return { status: "dry-run", block: target, hash: r.hash };

  const me = d.anchor.signer();
  const owner = await d.anchor.owner();
  if (!me || me.toLowerCase() !== owner.toLowerCase()) {
    throw new Error(`this wallet (${me ?? "none"}) is not the contract owner (${owner}); only the owner can publish`);
  }
  const tx = await d.anchor.publish(target, r.hash);
  d.memo = { block: target, hash: r.hash };
  return { status: "published", block: target, hash: r.hash, tx };
}

// The indexer's own tables as a hash source. `query` returns rows (pg: r.rows).
export function dbSource(query: Query): Source {
  return {
    events: (after, upto) => query(
      `SELECT block_number, event_index, block_hash, pallet, name, data FROM events
       WHERE block_number > $1 AND block_number <= $2 ORDER BY block_number, event_index`, [after, upto]),
    gaps: (after, upto) => query(
      `SELECT from_block, to_block, reason, filled_at FROM indexer_gaps
       WHERE from_block > $1 AND from_block <= $2 ORDER BY from_block`, [after, upto]),
  };
}

export async function dbCursor(query: Query): Promise<number> {
  const rows = await query("SELECT max(last_block)::bigint AS b FROM indexer_cursor");
  return Number(rows[0]?.b ?? 0);
}

// The PortalIndexCheckpoint contract (an ethers Contract) as an Anchor.
export function ethersAnchor(contract: any, signer: string | null, log: (m: string) => void): Anchor {
  return {
    async latest() { const [b, h] = await contract.latest(); return { block: Number(b), hash: String(h) }; },
    async owner() { return String(await contract.owner()); },
    signer: () => signer,
    async publish(block, hash) {
      const tx = await contract.publish(block, hash);
      log(`sent ${tx.hash}, waiting for it to confirm…`);
      await tx.wait(1, 180_000);
      return tx.hash;
    },
  };
}

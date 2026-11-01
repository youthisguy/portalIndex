import { keccak256, solidityPacked, toUtf8Bytes } from "ethers";

// The rolling state hash anchored on-chain by PortalIndexCheckpoint. Full specification: docs/checkpoints.md
//
//   H(0) = 0x00…00
//   for every block B with at least one stored event, in order:
//       H = keccak256( H ‖ uint256(B) ‖ eventsDigest(B) )
//   for every unreadable range that can never be recovered (indexer_gaps, unfilled, not "processing error"):
//       H = keccak256( H ‖ uint256(from_block) ‖ gapDigest(from, to) )        (applied at its from_block, after that block's events)
//   The checkpoint published for block N is H after every step with block <= N.
//
// Because each checkpoint builds on the previous one, anyone can verify a new checkpoint by re-reading only the
// blocks since the last one they trust, or verify the whole history from block 0.

export const ZERO_HASH = "0x" + "00".repeat(32);

export interface EventRow { block_number: number | string; event_index: number; block_hash: string; pallet: string; name: string; data: unknown }
export interface GapRow { from_block: number | string; to_block: number | string; reason: string; filled_at: string | Date | null }
export interface Source {
  events(after: number, upto: number): Promise<EventRow[]>; // block_number in (after, upto], ordered by block, event_index
  gaps(after: number, upto: number): Promise<GapRow[]>;     // from_block in (after, upto]
}

// JSON with sorted keys, so the hash never depends on key order. Numbers are read as IEEE-754 doubles, like any JavaScript client.
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + canonical(o[k])).join(",") + "}";
  }
  return JSON.stringify(v) ?? "null";
}

export function eventsDigest(rows: EventRow[]): string {
  const lines = [...rows]
    .sort((a, b) => a.event_index - b.event_index)
    .map((r) => `${r.event_index}|${r.block_hash.toLowerCase()}|${r.pallet}.${r.name}|${canonical(r.data)}`);
  return keccak256(toUtf8Bytes(lines.join("\n")));
}

export const gapDigest = (from: number, to: number) => keccak256(toUtf8Bytes(`gap|${from}|${to}`));

export const step = (prev: string, block: number, digest: string) =>
  keccak256(solidityPacked(["bytes32", "uint256", "bytes32"], [prev, BigInt(block), digest]));

// A skipped block that the indexer will re-read later. A checkpoint must wait for it, or the data would change afterwards.
export const isBlockingGap = (g: GapRow) => g.filled_at == null && /^processing error/i.test(g.reason);
// A range that is gone for good (pruned by the node, or marked unrecoverable). It is part of the record, so it is hashed.
export const isPermanentGap = (g: GapRow) => g.filled_at == null && !isBlockingGap(g);

export interface RangeResult { hash: string; steps: number; blocked?: GapRow }

// Extends `prevHash` (the hash at block `after`) through block `upto`.
export async function computeRange(src: Source, prevHash: string, after: number, upto: number, windowBlocks = 2000): Promise<RangeResult> {
  const gaps = await src.gaps(after, upto);
  const blocked = gaps.find(isBlockingGap);
  if (blocked) return { hash: prevHash, steps: 0, blocked };
  const gapSteps = gaps.filter(isPermanentGap).map((g) => ({ block: Number(g.from_block), order: 1, digest: gapDigest(Number(g.from_block), Number(g.to_block)) }));

  let hash = prevHash;
  let steps = 0;
  for (let ws = after; ws < upto; ) {
    const we = Math.min(ws + windowBlocks, upto);
    const rows = await src.events(ws, we);
    const byBlock = new Map<number, EventRow[]>();
    for (const r of rows) {
      const b = Number(r.block_number);
      if (!byBlock.has(b)) byBlock.set(b, []);
      byBlock.get(b)!.push(r);
    }
    const items = [...byBlock.entries()].map(([block, rs]) => ({ block, order: 0, digest: eventsDigest(rs) }));
    for (const g of gapSteps) if (g.block > ws && g.block <= we) items.push(g);
    items.sort((a, b) => a.block - b.block || a.order - b.order);
    for (const it of items) { hash = step(hash, it.block, it.digest); steps++; }
    ws = we;
  }
  return { hash, steps };
}

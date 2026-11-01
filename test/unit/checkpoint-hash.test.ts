import { describe, it, expect } from "vitest";
import { canonical, computeRange, eventsDigest, gapDigest, step, ZERO_HASH, type EventRow, type GapRow, type Source } from "../../src/checkpoint-hash";
import { checkpointOnce, type Anchor, type Deps } from "../../src/checkpoint-core";

const ev = (block: number, idx: number, name = "Transfer", data: unknown = { amount: "5" }): EventRow =>
  ({ block_number: block, event_index: idx, block_hash: "0xAB" + block, pallet: "balances", name, data });

// Source over in-memory rows, honouring the same (after, upto] contract as the database and the API.
const source = (events: EventRow[], gaps: GapRow[] = []): Source => ({
  events: async (a, u) => events.filter((e) => Number(e.block_number) > a && Number(e.block_number) <= u)
    .sort((x, y) => Number(x.block_number) - Number(y.block_number) || x.event_index - y.event_index),
  gaps: async (a, u) => gaps.filter((g) => Number(g.from_block) > a && Number(g.from_block) <= u),
});
const blocks = (from: number, to: number) => { const r: EventRow[] = []; for (let b = from; b <= to; b++) { r.push(ev(b, 0, "ExtrinsicSuccess", { n: b })); if (b % 3 === 0) r.push(ev(b, 1)); } return r; };

describe("canonical JSON", () => {
  it("does not depend on key order, at any depth", () => {
    expect(canonical({ b: 1, a: { d: 2, c: [{ y: 1, x: 2 }] } })).toBe(canonical({ a: { c: [{ x: 2, y: 1 }], d: 2 }, b: 1 }));
  });
  it("keeps values apart", () => {
    expect(canonical({ a: "1" })).not.toBe(canonical({ a: 1 }));
    expect(canonical(null)).toBe("null");
  });
});

describe("digests", () => {
  it("ignores row order within a block and the case of the block hash", () => {
    const a = eventsDigest([ev(1, 0), ev(1, 1, "Deposit")]);
    const b = eventsDigest([{ ...ev(1, 1, "Deposit"), block_hash: "0xab1" }, { ...ev(1, 0), block_hash: "0xAB1" }]);
    expect(a).toBe(b);
  });
  it("changes when any event changes", () => {
    expect(eventsDigest([ev(1, 0, "Transfer", { amount: "5" })])).not.toBe(eventsDigest([ev(1, 0, "Transfer", { amount: "6" })]));
    expect(eventsDigest([ev(1, 0)])).not.toBe(eventsDigest([ev(1, 0, "Deposit")]));
  });
  it("binds each step to its block number and to the previous hash", () => {
    const d = eventsDigest([ev(1, 0)]);
    expect(step(ZERO_HASH, 1, d)).not.toBe(step(ZERO_HASH, 2, d));
    expect(step(ZERO_HASH, 1, d)).not.toBe(step(step(ZERO_HASH, 1, d), 1, d));
  });
});

describe("rolling hash", () => {
  const data = blocks(1, 3500);
  it("gives the same answer in one pass, in two checkpoints, and with a different window size", async () => {
    const s = source(data);
    const whole = await computeRange(s, ZERO_HASH, 0, 3000);
    const first = await computeRange(s, ZERO_HASH, 0, 1000);
    const second = await computeRange(s, first.hash, 1000, 3000);
    const small = await computeRange(s, ZERO_HASH, 0, 3000, 137);
    expect(second.hash).toBe(whole.hash);
    expect(small.hash).toBe(whole.hash);
    expect(whole.steps).toBe(3000);
  });
  it("detects any change in the past", async () => {
    const tampered = data.map((e) => (Number(e.block_number) === 17 && e.event_index === 0 ? { ...e, data: { n: 999 } } : e));
    expect((await computeRange(source(tampered), ZERO_HASH, 0, 3000)).hash).not.toBe((await computeRange(source(data), ZERO_HASH, 0, 3000)).hash);
  });
  it("detects a missing event", async () => {
    const missing = data.filter((e) => !(Number(e.block_number) === 30 && e.event_index === 1));
    expect((await computeRange(source(missing), ZERO_HASH, 0, 3000)).hash).not.toBe((await computeRange(source(data), ZERO_HASH, 0, 3000)).hash);
  });
});

describe("gaps", () => {
  const pruned: GapRow = { from_block: 1200, to_block: 1300, reason: "state pruned by node", filled_at: null };
  const rows = blocks(1, 1199).concat(blocks(1301, 2500)); // nothing stored inside the gap
  it("hashes a permanent gap, so a checkpoint records it instead of hiding it", async () => {
    const withGap = await computeRange(source(rows, [pruned]), ZERO_HASH, 0, 2000);
    const without = await computeRange(source(rows), ZERO_HASH, 0, 2000);
    expect(withGap.hash).not.toBe(without.hash);
    expect(withGap.steps).toBe(without.steps + 1);
    expect(gapDigest(1200, 1300)).toMatch(/^0x[0-9a-f]{64}$/);
  });
  it("applies the gap at the right place, whichever checkpoint it falls in", async () => {
    const s = source(rows, [pruned]);
    const whole = await computeRange(s, ZERO_HASH, 0, 2000);
    const a = await computeRange(s, ZERO_HASH, 0, 1000);
    const b = await computeRange(s, a.hash, 1000, 2000);
    expect(b.hash).toBe(whole.hash);
  });
  it("waits for a skipped block that will be re-read, and ignores it once filled", async () => {
    const skipped: GapRow = { from_block: 500, to_block: 500, reason: "processing error: disconnected", filled_at: null };
    const waiting = await computeRange(source(blocks(1, 1000), [skipped]), ZERO_HASH, 0, 1000);
    expect(waiting.blocked?.from_block).toBe(500);
    expect(waiting.steps).toBe(0);
    const filled = await computeRange(source(blocks(1, 1000), [{ ...skipped, filled_at: "2026-10-21T07:06:34Z" }]), ZERO_HASH, 0, 1000);
    expect(filled.blocked).toBeUndefined();
    expect(filled.hash).toBe((await computeRange(source(blocks(1, 1000)), ZERO_HASH, 0, 1000)).hash);
  });
  it("treats an unrecoverable skipped block as permanent", async () => {
    const dead: GapRow = { from_block: 500, to_block: 500, reason: "unrecoverable: processing error: x", filled_at: null };
    const r = await computeRange(source(blocks(1, 1000).filter((e) => Number(e.block_number) !== 500), [dead]), ZERO_HASH, 0, 1000);
    expect(r.blocked).toBeUndefined();
  });
});

// A fake chain that behaves like the contract: owner-only, block numbers must increase.
function fakeAnchor(owner: string, signer: string | null) {
  const state = { block: 0, hash: ZERO_HASH, sent: [] as [number, string][] };
  const anchor: Anchor = {
    latest: async () => ({ block: state.block, hash: state.hash }),
    owner: async () => owner,
    signer: () => signer,
    publish: async (b, h) => {
      if (b <= state.block) throw new Error("BlockNotIncreasing");
      state.block = b; state.hash = h; state.sent.push([b, h]); return "0xtx" + b;
    },
  };
  return { state, anchor };
}
const deps = (o: { cursor: number; events?: EventRow[]; gaps?: GapRow[]; dryRun?: boolean }, anchor: Anchor): Deps => ({
  src: source(o.events ?? blocks(1, 5000), o.gaps ?? []),
  cursor: async () => o.cursor,
  anchor, every: 1000, dryRun: o.dryRun ?? false, log: () => {}, memo: null,
});

describe("publishing flow", () => {
  it("publishes the newest multiple of the interval, then continues from it", async () => {
    const { state, anchor } = fakeAnchor("0xme", "0xME");
    const d = deps({ cursor: 2600 }, anchor);
    const r1 = await checkpointOnce(d);
    expect(r1).toMatchObject({ status: "published", block: 2000 });
    expect((await checkpointOnce(d)).status).toBe("idle");
    d.cursor = async () => 4100; // the indexer has moved on
    expect(await checkpointOnce(d)).toMatchObject({ status: "published", block: 4000 });
    expect(state.sent.map((x) => x[0])).toEqual([2000, 4000]);
    expect(state.hash).toBe((await computeRange(source(blocks(1, 5000)), ZERO_HASH, 0, 4000)).hash);
  });
  it("does nothing before the first full interval", async () => {
    const { state, anchor } = fakeAnchor("0xme", "0xme");
    expect((await checkpointOnce(deps({ cursor: 999 }, anchor))).status).toBe("idle");
    expect(state.sent).toEqual([]);
  });
  it("a dry run computes but never sends", async () => {
    const { state, anchor } = fakeAnchor("0xme", null);
    expect(await checkpointOnce(deps({ cursor: 3000, dryRun: true }, anchor))).toMatchObject({ status: "dry-run", block: 3000 });
    expect(state.sent).toEqual([]);
  });
  it("refuses to publish when the wallet is not the owner", async () => {
    const { state, anchor } = fakeAnchor("0xowner", "0xsomeoneelse");
    await expect(checkpointOnce(deps({ cursor: 3000 }, anchor))).rejects.toThrow(/not the contract owner/);
    expect(state.sent).toEqual([]);
  });
  it("waits while a skipped block is still to be re-read", async () => {
    const { state, anchor } = fakeAnchor("0xme", "0xme");
    const gap: GapRow = { from_block: 1500, to_block: 1500, reason: "processing error: timeout", filled_at: null };
    expect((await checkpointOnce(deps({ cursor: 2200, gaps: [gap] }, anchor))).status).toBe("blocked");
    expect(state.sent).toEqual([]);
  });
  it("refuses to build on an on-chain checkpoint the data does not reproduce", async () => {
    const { state, anchor } = fakeAnchor("0xme", "0xme");
    state.block = 1000; state.hash = "0x" + "ab".repeat(32); // someone published an unrelated hash by hand
    await expect(checkpointOnce(deps({ cursor: 3000 }, anchor))).rejects.toThrow(/does not match the indexed data/);
    expect(state.sent).toEqual([]);
  });
  it("accepts and builds on an earlier checkpoint it can reproduce", async () => {
    const { state, anchor } = fakeAnchor("0xme", "0xme");
    state.block = 1000; state.hash = (await computeRange(source(blocks(1, 5000)), ZERO_HASH, 0, 1000)).hash;
    expect(await checkpointOnce(deps({ cursor: 3000 }, anchor))).toMatchObject({ status: "published", block: 3000 });
  });
});

// Re-derives a checkpoint from the PUBLIC API only and compares it with what the contract holds. No database access needed.
//   npx tsx scripts/verify-checkpoint.ts            verify the latest checkpoint
//   npx tsx scripts/verify-checkpoint.ts 134000     verify the checkpoint at block 134000
// Optional: API=https://portalindex-98f0.onrender.com  EVM_RPC=...  CHECKPOINT_CONTRACT=0x...
import { Contract, JsonRpcProvider, Network } from "ethers";
import { computeRange, ZERO_HASH, type Source } from "../src/checkpoint-hash.js";

const API = (process.env.API ?? "https://portalindex-98f0.onrender.com").replace(/\/$/, "");
const RPC = process.env.EVM_RPC ?? "https://test-evm-rpc-v3.portaldot.dev";
const ADDRESS = process.env.CHECKPOINT_CONTRACT ?? "0x4DF57190DEbe09D922D1AfE9458AfF439bcd2Cb1";
const PAGE = 1000;

async function getJson(path: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(API + path);
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
      return await r.json();
    } catch (e) { if (attempt >= 4) throw e; await new Promise((r) => setTimeout(r, 1500 * attempt)); }
  }
}

const src: Source = {
  async events(after, upto) {
    const out: any[] = [];
    let b = after, i = -1; // keyset paging: the API caps a response at 1000 rows
    for (;;) {
      const cond = i < 0 ? `block_number=gt.${b}` : `or=(block_number.gt.${b},and(block_number.eq.${b},event_index.gt.${i}))`;
      const rows: any[] = await getJson(`/events?select=block_number,event_index,block_hash,pallet,name,data&${cond}&block_number=lte.${upto}&order=block_number.asc,event_index.asc&limit=${PAGE}`);
      out.push(...rows);
      if (rows.length < PAGE) return out;
      const last = rows[rows.length - 1]; b = Number(last.block_number); i = Number(last.event_index);
    }
  },
  async gaps(after, upto) {
    return getJson(`/indexer_gaps?from_block=gt.${after}&from_block=lte.${upto}&order=from_block.asc`);
  },
};

async function main() {
  const network = Network.from(420420777);
  const c = new Contract(ADDRESS, [
    "function latest() view returns (uint256, bytes32)",
    "function checkpoints(uint256) view returns (bytes32)",
    "function verify(uint256, bytes32) view returns (bool)",
  ], new JsonRpcProvider(RPC, network, { staticNetwork: network }));

  const arg = process.argv[2];
  const block = arg ? Number(arg) : Number((await c.latest())[0]);
  if (!block) { console.log("No checkpoint has been published yet."); return; }
  const anchored: string = await c.checkpoints(block);
  if (/^0x0+$/.test(anchored)) { console.log(`Nothing is anchored for block ${block}.`); process.exit(1); }

  console.log(`Re-deriving blocks 1-${block} from ${API} …`);
  const t = Date.now();
  const r = await computeRange(src, ZERO_HASH, 0, block);
  if (r.blocked) { console.log(`The API still lists a skipped block (${r.blocked.from_block}-${r.blocked.to_block}) as waiting to be re-read.`); process.exit(1); }
  console.log(`derived ${r.hash} in ${Math.round((Date.now() - t) / 1000)} s (${r.steps} steps)`);
  console.log(`anchored ${anchored}`);
  const ok = r.hash.toLowerCase() === anchored.toLowerCase() && (await c.verify(block, r.hash));
  console.log(ok ? `\nMATCH: the data served by the API reproduces the checkpoint anchored on-chain for block ${block}.` : "\nMISMATCH: the API's data does not reproduce the anchored checkpoint.");
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });

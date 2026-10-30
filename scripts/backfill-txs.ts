import { ApiPromise, WsProvider } from "@polkadot/api";
import pg from "pg";
import { EVM_TX_INSERT, evmTxValues, extractEvmTxs } from "../src/evm-tx.js";

// Fills evm_transactions for blocks the indexer already stored. Only blocks that contain an extrinsic
// besides the first (usually the timestamp inherent) are read. Safe to re-run. The node must still serve block bodies.
//   FROM=135900 TO=136100 WS_URL=... DATABASE_URL=... npx tsx scripts/backfill-txs.ts
const DB = process.env.DATABASE_URL ?? "postgres://portalindex:portalindex@localhost:5432/portalindex";
const FROM = Number(process.env.FROM ?? 0), TO = Number(process.env.TO ?? 1e12), DELAY = Number(process.env.DELAY_MS ?? 150);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(process.env.WS_URL) });
  const pool = new pg.Pool({ connectionString: DB });
  const blocks = (await pool.query(
    "SELECT DISTINCT block_number FROM events WHERE extrinsic_index >= 1 AND block_number BETWEEN $1 AND $2 ORDER BY block_number", [FROM, TO]
  )).rows.map((r) => Number(r.block_number));
  console.log(`${blocks.length} candidate blocks`);
  let found = 0, unreadable = 0;
  for (const n of blocks) {
    try {
      const meta = (await pool.query("SELECT block_hash, block_time FROM events WHERE block_number = $1 LIMIT 1", [n])).rows[0];
      const ok = new Map<number, boolean>();
      for (const r of (await pool.query(
        "SELECT extrinsic_index, name FROM events WHERE block_number = $1 AND pallet = 'system' AND name IN ('ExtrinsicSuccess','ExtrinsicFailed') AND extrinsic_index IS NOT NULL", [n]
      )).rows) ok.set(Number(r.extrinsic_index), r.name === "ExtrinsicSuccess");
      const blk: any = await api.rpc.chain.getBlock(meta.block_hash);
      for (const t of extractEvmTxs(blk.block.extrinsics, ok)) {
        await pool.query(EVM_TX_INSERT, evmTxValues(t, n, meta.block_hash, meta.block_time));
        found++;
      }
    } catch (e: any) {
      unreadable++;
      console.warn(`block ${n}: ${String(e?.message ?? e).slice(0, 80)}`);
    }
    await sleep(DELAY);
  }
  console.log(`done: ${found} EVM transactions stored, ${unreadable} blocks unreadable`);
  await pool.end(); await api.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

import { ApiPromise, WsProvider } from "@polkadot/api";
import pg from "pg";

// Reads every asset balance from chain storage at the latest finalized block and
// stores it as the baseline. The asset_balances view then adds only later events.
// Run it once when starting a new database, and again after any gap.
const DB = process.env.DATABASE_URL ?? "postgres://portalindex:portalindex@localhost:5432/portalindex";

async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(process.env.WS_URL) });
  const hash = await api.rpc.chain.getFinalizedHead();
  const block = (await api.rpc.chain.getHeader(hash)).number.toNumber();
  const at = await api.at(hash);

  const rows: { asset: string; holder: string; balance: string }[] = [];
  for (const [key, val] of await (at.query as any).assets.account.entries()) {
    const acct: any = typeof val.isSome === "boolean" ? (val.isSome ? val.unwrap() : null) : val;
    if (!acct) continue;
    rows.push({ asset: key.args[0].toString(), holder: key.args[1].toString(), balance: acct.balance.toString() });
  }

  const pool = new pg.Pool({ connectionString: DB });
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("DELETE FROM asset_baseline");
    for (const r of rows) {
      await c.query("INSERT INTO asset_baseline (asset_id, holder, balance) VALUES ($1,$2,$3)", [r.asset, r.holder, r.balance]);
    }
    await c.query(
      `INSERT INTO state_snapshots (kind, block) VALUES ('assets', $1)
       ON CONFLICT (kind) DO UPDATE SET block = $1, taken_at = now()`,
      [block]
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
  console.log(`Snapshot at block ${block}: ${rows.length} asset balances stored`);
  await pool.end();
  await api.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

import { ApiPromise, WsProvider } from "@polkadot/api";
import pg from "pg";
import { readdirSync, readFileSync } from "fs";
import { buildEventMap, ensureTables, insertTyped, type EventTable } from "./typed.js";

const WS = process.env.WS_URL;
const DB = process.env.DATABASE_URL ?? "postgres://portalindex:portalindex@localhost:5432/portalindex";
const BACKFILL = Number(process.env.BACKFILL ?? 200); // blocks to backfill on first run
const START_BLOCK = process.env.START_BLOCK ? Number(process.env.START_BLOCK) : undefined;
const PALLETS = (process.env.PALLETS ?? "assets,uniques,nfts,balances,staking").trim();
const SAFE_WINDOW = Number(process.env.SAFE_WINDOW ?? 150); // non-archive nodes keep ~256 blocks of state
const DELAY_MS = Number(process.env.DELAY_MS ?? 100); // be gentle with public RPCs

if (!WS) {
  console.error("Set WS_URL, e.g. WS_URL=wss://westend-asset-hub-rpc.polkadot.io");
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({ connectionString: DB });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Integers are stored as strings so u128 balances never lose precision.
function toValue(v: any): unknown {
  const raw = typeof v?.toRawType === "function" ? v.toRawType() : "";
  if (/^(u|i)(8|16|32|64|128|256)$/.test(raw) || raw.startsWith("Compact<u")) return v.toString();
  return typeof v?.toJSON === "function" ? v.toJSON() : v;
}

function eventData(event: any): Record<string, unknown> {
  const fields = event.meta.fields;
  const obj: Record<string, unknown> = {};
  event.data.forEach((v: any, i: number) => {
    const named = fields[i]?.name?.isSome ? fields[i].name.unwrap().toString() : "";
    obj[named || `f${i}`] = toValue(v);
  });
  return obj;
}

async function processBlock(api: ApiPromise, chainKey: string, n: number, typed: Map<string, EventTable>) {
  const hash = await api.rpc.chain.getBlockHash(n);
  const apiAt = await api.at(hash);
  const [events, now] = await Promise.all([
    apiAt.query.system.events() as Promise<any>,
    apiAt.query.timestamp.now(),
  ]);
  const blockTime = new Date(Number(now.toString()));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < events.length; i++) {
      const { event, phase } = events[i];
      const extIdx = phase.isApplyExtrinsic ? phase.asApplyExtrinsic.toNumber() : null;
      await client.query(
        `INSERT INTO events (block_number, event_index, block_hash, extrinsic_index, pallet, name, data, block_time)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (block_number, event_index) DO NOTHING`,
        [n, i, hash.toHex(), extIdx, event.section, event.method, JSON.stringify(eventData(event)), blockTime]
      );
      await insertTyped(client, typed, event, n, i, hash.toHex(), extIdx, blockTime);
    }
    await client.query(
      `INSERT INTO indexer_cursor (chain_key, last_block) VALUES ($1,$2)
       ON CONFLICT (chain_key) DO UPDATE SET last_block = $2, updated_at = now()`,
      [chainKey, n]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  console.log(`block ${n}: ${events.length} events`);
}

// Runs sql/NNN_*.sql in order. Every file is idempotent, so this is safe on each start.
// Files that depend on pallets not being indexed are skipped with a warning.
async function applyMigrations() {
  let files: string[] = [];
  try {
    files = readdirSync("sql").filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort();
  } catch {
    console.warn("No sql/ directory found; skipping migrations");
    return;
  }
  for (const f of files) {
    try {
      await pool.query(readFileSync(`sql/${f}`, "utf8"));
      console.log(`migration ok: ${f}`);
    } catch (e: any) {
      console.warn(`migration skipped: ${f} (${String(e.message).slice(0, 100)})`);
    }
  }
  // Tell PostgREST to reload its schema cache so new tables and views get endpoints.
  try { await pool.query("NOTIFY pgrst, 'reload schema'"); } catch {}
}

async function recordGap(chainKey: string, from: number, to: number, reason: string) {
  await pool.query(
    `INSERT INTO indexer_gaps (chain_key, from_block, to_block, reason) VALUES ($1,$2,$3,$4)`,
    [chainKey, from, to, reason]
  );
}

async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(WS) });
  const chainKey = api.genesisHash.toHex();
  console.log(`Connected to ${(await api.rpc.system.chain()).toString()} (${chainKey.slice(0, 10)}...)`);

  const typed = buildEventMap(api, PALLETS === "*" ? "*" : PALLETS.split(",").map((p) => p.trim()));
  await ensureTables(pool, typed);
  console.log(`Typed tables ready: ${typed.size} (pallets: ${PALLETS})`);

  await applyMigrations();
  await pool.query(
    `CREATE TABLE IF NOT EXISTS indexer_gaps (
       id SERIAL PRIMARY KEY, chain_key TEXT NOT NULL, from_block BIGINT NOT NULL,
       to_block BIGINT NOT NULL, reason TEXT NOT NULL, detected_at TIMESTAMPTZ NOT NULL DEFAULT now())`
  );

  const res = await pool.query("SELECT last_block FROM indexer_cursor WHERE chain_key = $1", [chainKey]);
  let next: number;
  if (res.rows.length) {
    next = Number(res.rows[0].last_block) + 1;
  } else if (START_BLOCK !== undefined) {
    next = START_BLOCK;
  } else {
    const head = await api.rpc.chain.getHeader(await api.rpc.chain.getFinalizedHead());
    next = Math.max(0, head.number.toNumber() - BACKFILL);
  }
  console.log(`Starting at block ${next}`);

  let running = false;
  // Finalized heads only: finalized blocks cannot be reorged.
  await api.rpc.chain.subscribeFinalizedHeads(async (header) => {
    if (running) return; // a catch-up loop is already working
    running = true;
    try {
      const target = header.number.toNumber();
      while (next <= target) {
        try {
          await processBlock(api, chainKey, next, typed);
          next++;
          await sleep(DELAY_MS);
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          // Non-archive node: old state is gone. Record the gap honestly and jump ahead.
          if (/discarded|unknown block|4003/i.test(msg)) {
            const resume = Math.max(next + 1, target - SAFE_WINDOW);
            await recordGap(chainKey, next, resume - 1, "state pruned by node");
            console.warn(`GAP: blocks ${next}-${resume - 1} unavailable (pruned). Resuming at ${resume}.`);
            next = resume;
          } else {
            throw e;
          }
        }
      }
    } catch (e) {
      console.error("ingest error, will retry on next head:", e);
    } finally {
      running = false;
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

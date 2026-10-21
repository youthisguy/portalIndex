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

const knownAccounts = new Set<string>();

// Best effort, never fails a block: store each touched account's H160 (once) and its
// native balance (every time it is touched). `q` is the query namespace to read from.
async function mapAccounts(api: ApiPromise, accounts: string[], blockNum: number, q: any = api.query, delayMs = 0) {
  for (const a of accounts) {
    if (delayMs) await sleep(delayMs);
    try {
      const info: any = await q.system.account(a);
      await pool.query(
        `INSERT INTO account_balances (account, free, reserved, block) VALUES ($1,$2,$3,$4)
         ON CONFLICT (account) DO UPDATE SET free = $2, reserved = $3, block = $4, updated_at = now()
         WHERE account_balances.block <= $4`,
        [a, info.data.free.toString(), info.data.reserved.toString(), blockNum]
      );
    } catch { /* optional */ }
    if (knownAccounts.has(a)) continue;
    try {
      const h160 = (await (api.call as any).reviveApi.address(a)).toString().toLowerCase();
      await pool.query("INSERT INTO address_map (account, h160) VALUES ($1,$2) ON CONFLICT (account) DO NOTHING", [a, h160]);
      knownAccounts.add(a);
    } catch { /* optional */ }
  }
}

// Reads every native balance from chain storage at the finalized head and stores it,
// so the tPOT holder list is complete (not just accounts seen in events).
async function syncNativeBalances(api: ApiPromise) {
  const hash = await api.rpc.chain.getFinalizedHead();
  const block = (await api.rpc.chain.getHeader(hash)).number.toNumber();
  const at: any = await api.at(hash);
  let startKey: string | undefined;
  let total = 0;
  for (;;) {
    const page: any[] = await at.query.system.account.entriesPaged({ pageSize: 200, startKey });
    if (!page.length) break;
    const acc: string[] = [], free: string[] = [], res: string[] = [];
    for (const [k, v] of page) { acc.push(k.args[0].toString()); free.push(v.data.free.toString()); res.push(v.data.reserved.toString()); }
    await pool.query(
      `INSERT INTO account_balances (account, free, reserved, block)
       SELECT a, f, r, $4::bigint FROM unnest($1::text[], $2::numeric[], $3::numeric[]) AS t(a, f, r)
       ON CONFLICT (account) DO UPDATE
         SET free = EXCLUDED.free, reserved = EXCLUDED.reserved, block = EXCLUDED.block, updated_at = now()
         WHERE account_balances.block <= EXCLUDED.block`,
      [acc, free, res, block]
    );
    total += page.length;
    startKey = page[page.length - 1][0].toHex();
    await sleep(100);
  }
  console.log(`native balances synced: ${total} accounts at block ${block}`);
}

// On startup, fetch balances for accounts that have events but no balance yet.
async function seedAccounts(api: ApiPromise) {
  const r = await pool.query(
    "SELECT DISTINCT account FROM account_events WHERE account NOT IN (SELECT account FROM account_balances) LIMIT 400"
  );
  const head = (await api.rpc.chain.getHeader(await api.rpc.chain.getFinalizedHead())).number.toNumber();
  await mapAccounts(api, r.rows.map((x: any) => x.account), head, api.query, 100);
  console.log(`seeded balances for ${r.rows.length} accounts`);
}

async function processBlock(api: ApiPromise, chainKey: string, n: number, typed: Map<string, EventTable>) {
  const hash = await api.rpc.chain.getBlockHash(n);
  const apiAt = await api.at(hash);
  const [events, now] = await Promise.all([
    apiAt.query.system.events() as Promise<any>,
    apiAt.query.timestamp.now(),
  ]);
  const blockTime = new Date(Number(now.toString()));

  const touched = new Set<string>();
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
      (await insertTyped(client, typed, event, n, i, hash.toHex(), extIdx, blockTime)).forEach((a) => touched.add(a));
    }
    await client.query(
      `INSERT INTO indexer_cursor (chain_key, last_block) VALUES ($1,$2)
       ON CONFLICT (chain_key) DO UPDATE SET last_block = $2, updated_at = now()
         WHERE indexer_cursor.last_block <= $2`,
      [chainKey, n]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  await mapAccounts(api, [...touched], n, apiAt.query);
  console.log(`block ${n}: ${events.length} events`);
}

// Re-reads blocks that were skipped because of a processing error, while the node still
// serves their state. A gap is marked filled (kept for the record), or marked unrecoverable.
async function fillGaps(api: ApiPromise, chainKey: string, typed: Map<string, EventTable>) {
  const gaps = await pool.query(
    `SELECT id, from_block, to_block FROM indexer_gaps
     WHERE filled_at IS NULL AND reason LIKE 'processing error%' AND to_block - from_block < 2000 ORDER BY id`
  );
  for (const g of gaps.rows) {
    let ok = true;
    for (let n = Number(g.from_block); n <= Number(g.to_block); n++) {
      try {
        await processBlock(api, chainKey, n, typed);
      } catch (e: any) {
        ok = false;
        if (/discarded|unknown block|4003/i.test(String(e?.message ?? e))) {
          await pool.query("UPDATE indexer_gaps SET reason = 'unrecoverable: ' || reason WHERE id = $1", [g.id]);
          console.warn(`gap ${g.id} (blocks ${g.from_block}-${g.to_block}) can no longer be read from the node`);
        }
        break;
      }
      await sleep(100);
    }
    if (ok) {
      await pool.query("UPDATE indexer_gaps SET filled_at = now() WHERE id = $1", [g.id]);
      console.log(`gap ${g.id} filled (blocks ${g.from_block}-${g.to_block})`);
    }
  }
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
  seedAccounts(api).catch((e) => console.warn("seeding skipped:", String(e.message).slice(0, 80)));
  syncNativeBalances(api).catch((e) => console.warn("native sync skipped:", String(e.message).slice(0, 80)));
  setInterval(() => syncNativeBalances(api).catch(() => {}), 60 * 60 * 1000);
  await pool.query(
    `CREATE TABLE IF NOT EXISTS indexer_gaps (
       id SERIAL PRIMARY KEY, chain_key TEXT NOT NULL, from_block BIGINT NOT NULL,
       to_block BIGINT NOT NULL, reason TEXT NOT NULL, detected_at TIMESTAMPTZ NOT NULL DEFAULT now())`
  );

  await pool.query("ALTER TABLE indexer_gaps ADD COLUMN IF NOT EXISTS filled_at TIMESTAMPTZ");
  fillGaps(api, chainKey, typed).catch((e) => console.warn("gap fill skipped:", String(e.message).slice(0, 80)));
  setInterval(() => fillGaps(api, chainKey, typed).catch(() => {}), 30 * 60 * 1000);

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

  const failures = new Map<number, number>();
  let lastHeadAt = Date.now();
  setInterval(() => {
    if (Date.now() - lastHeadAt > 5 * 60 * 1000) {
      console.error("No finalized head for 5 minutes; exiting so the supervisor reconnects");
      process.exit(1);
    }
  }, 60_000);
  let running = false;
  // Finalized heads only: finalized blocks cannot be reorged.
  await api.rpc.chain.subscribeFinalizedHeads(async (header) => {
    lastHeadAt = Date.now();
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
            // A block that keeps failing must not stall the indexer forever.
            if (/disconnected|abnormal closure|econn|timeout|websocket|not connected/i.test(msg)) throw e; // transient: retry, never skip
            const tries = (failures.get(next) ?? 0) + 1;
            failures.set(next, tries);
            if (tries >= 3) {
              await recordGap(chainKey, next, next, "processing error: " + msg.slice(0, 120));
              console.warn(`SKIP: block ${next} failed ${tries} times (${msg.slice(0, 80)}); recorded as a gap`);
              failures.delete(next);
              next++;
            } else {
              throw e;
            }
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

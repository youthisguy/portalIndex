import type { ApiPromise } from "@polkadot/api";
import type { Pool, PoolClient } from "pg";

export type Kind = "text" | "integer" | "bigint" | "numeric" | "boolean" | "jsonb";
export interface Col { name: string; kind: Kind; index: number; account: boolean }
export interface EventTable { key: string; table: string; cols: Col[]; insertSql: string }

const SQL_TYPE: Record<Kind, string> = {
  text: "TEXT",
  integer: "INTEGER",
  bigint: "BIGINT",
  numeric: "NUMERIC(78,0)",
  boolean: "BOOLEAN",
  jsonb: "JSONB",
};

// Columns every typed table gets, before the event's own fields.
const BASE_COLS = ["block_number", "event_index", "block_hash", "extrinsic_index", "block_time"];

export const snake = (s: string) =>
  s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();

// Map a resolved chain type name to a Postgres column kind.
export function kindOf(typeName: string): Kind {
  let s = typeName.trim();
  for (;;) {
    const m = s.match(/^(Option|Compact)<(.+)>$/);
    if (!m) break;
    s = m[2];
  }
  if (/^(u8|u16|i8|i16|i32)$/.test(s)) return "integer";
  if (/^(u32|i64)$/.test(s)) return "bigint";
  if (/^(u64|u128|u256|i128|i256)$/.test(s)) return "numeric";
  if (s === "bool") return "boolean";
  if (/^(AccountId32|AccountId20|H160|H256|H512|Bytes|Text|Str|String)$/.test(s)) return "text";
  return "jsonb"; // enums, structs, vectors: keep full fidelity as JSON
}

// Read chain metadata and derive one table definition per event.
export function buildEventMap(api: ApiPromise, pallets: string[] | "*"): Map<string, EventTable> {
  const wanted = pallets === "*" ? null : new Set(pallets.map((p) => p.toLowerCase()));
  const out = new Map<string, EventTable>();

  for (const section of Object.keys(api.events)) {
    if (wanted && !wanted.has(section.toLowerCase())) continue;
    for (const method of Object.keys(api.events[section])) {
      const fields = api.events[section][method].meta.fields;
      const used = new Set<string>(BASE_COLS);
      const cols: Col[] = fields.map((f: any, i: number) => {
        let name = f.name.isSome ? snake(f.name.unwrap().toString()) : `f${i}`;
        while (used.has(name)) name += "_f";
        used.add(name);
        const typeName = api.registry.lookup.getTypeDef(f.type).type;
        return { name, kind: kindOf(typeName), index: i, account: typeName === "AccountId32" };
      });

      const table = `${snake(section)}_${snake(method)}`.slice(0, 63);
      const colNames = [...BASE_COLS, ...cols.map((c) => c.name)];
      const placeholders = colNames.map((_, i) => `$${i + 1}`).join(",");
      const insertSql =
        `INSERT INTO "${table}" (${colNames.map((c) => `"${c}"`).join(",")}) ` +
        `VALUES (${placeholders}) ON CONFLICT (block_number, event_index) DO NOTHING`;
      out.set(`${section}.${method}`, { key: `${section}.${method}`, table, cols, insertSql });
    }
  }
  return out;
}

// Create any missing tables. (Schema changes after runtime upgrades are not handled yet.)
export async function ensureTables(pool: Pool, map: Map<string, EventTable>) {
  const client = await pool.connect();
  try {
    for (const t of map.values()) {
      const cols = t.cols.map((c) => `"${c.name}" ${SQL_TYPE[c.kind]}`);
      await client.query(
        `CREATE TABLE IF NOT EXISTS "${t.table}" (
           block_number BIGINT NOT NULL,
           event_index INTEGER NOT NULL,
           block_hash TEXT NOT NULL,
           extrinsic_index INTEGER,
           block_time TIMESTAMPTZ,
           ${cols.length ? cols.join(",\n           ") + "," : ""}
           PRIMARY KEY (block_number, event_index)
         )`
      );
    }
  } finally {
    client.release();
  }
}

function convert(v: any, kind: Kind): unknown {
  if (v && typeof v.isNone === "boolean") return v.isNone ? null : convert(v.unwrap(), kind);
  switch (kind) {
    case "text":
      return typeof v.toRawType === "function" && v.toRawType() === "Bytes" ? v.toHex() : v.toString();
    case "integer":
    case "bigint":
    case "numeric":
      return v.toString();
    case "boolean":
      return typeof v.isTrue === "boolean" ? v.isTrue : Boolean(v.toJSON());
    default:
      return JSON.stringify(v.toJSON());
  }
}

export async function insertTyped(
  client: PoolClient,
  map: Map<string, EventTable>,
  event: any,
  blockNumber: number,
  eventIndex: number,
  blockHash: string,
  extrinsicIndex: number | null,
  blockTime: Date
) : Promise<string[]> {
  const t = map.get(`${event.section}.${event.method}`);
  if (!t) return [];
  const values = [
    blockNumber,
    eventIndex,
    blockHash,
    extrinsicIndex,
    blockTime,
    ...t.cols.map((c) => convert(event.data[c.index], c.kind)),
  ];
  await client.query(t.insertSql, values);

  // Record every account this event touched, so any address can be looked up later.
  const accounts = new Set<string>();
  for (const c of t.cols) {
    if (!c.account) continue;
    const v = event.data[c.index];
    const val = v && typeof v.isNone === "boolean" ? (v.isNone ? null : v.unwrap().toString()) : v?.toString();
    if (val) accounts.add(val);
  }
  for (const a of accounts) {
    await client.query(
      `INSERT INTO account_events (account, block_number, event_index, pallet, name)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [a, blockNumber, eventIndex, event.section, event.method]
    );
  }
  return [...accounts];
}

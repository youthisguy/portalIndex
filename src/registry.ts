// Contract registry + decoder. Public front door: handles /contracts and /c/*,
// proxies everything else to PostgREST. Also runs the decode worker.
import http from "http";
import { createHash, randomBytes } from "crypto";
import pg from "pg";
import type { Interface } from "ethers";
import { buildInterface, decodeLog, eventsOnly } from "./decode.js";

const PORT = Number(process.env.PORT ?? 10000);
const UP = new URL(process.env.POSTGREST_URL ?? "http://127.0.0.1:3000");
const DB =
  process.env.DATABASE_URL ??
  "postgres://portalindex:portalindex@localhost:5432/portalindex";
const MAX_BODY = 256 * 1024;
const MAX_CONTRACTS = Number(process.env.MAX_CONTRACTS ?? 200);
const PER_IP_PER_DAY = Number(process.env.REG_PER_IP_PER_DAY ?? 20);
const WINDOW = 2000; // blocks decoded per step

const pool = new pg.Pool({ connectionString: DB, max: 3 });
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, prefer",
  "access-control-expose-headers": "content-range",
};
function send(res: http.ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { ...CORS, "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 86_400_000);
  if (arr.length >= PER_IP_PER_DAY) {
    hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  hits.set(ip, arr);
  return false;
}

const clientIp = (req: http.IncomingMessage) =>
  String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "?")
    .split(",")[0]
    .trim();

function baseUrl(req: http.IncomingMessage) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const host = String(req.headers.host ?? "localhost");
  return (/^(localhost|127\.)/.test(host) ? "http://" : "https://") + host;
}

const addrHits = new Map<string, number[]>();
function allowAddr(ip: string, max = 30, windowMs = 60_000) {
  const now = Date.now();
  const recent = (addrHits.get(ip) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  addrHits.set(ip, recent);
  if (addrHits.size > 5000) addrHits.clear();
  return recent.length <= max;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

async function register(req: http.IncomingMessage, res: http.ServerResponse) {
  if (limited(clientIp(req)))
    return send(res, 429, {
      error: "Too many registrations from this address today.",
    });
  let body: any;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return send(res, 400, { error: "Body must be JSON under 256 KB." });
  }

  const address = String(body.address ?? "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address))
    return send(res, 400, {
      error: "address must be a 0x... H160 (40 hex chars).",
    });

  let abi = body.abi;
  if (typeof abi === "string") {
    try {
      abi = JSON.parse(abi);
    } catch {
      /* handled below */
    }
  }
  let iface: Interface;
  try {
    iface = buildInterface(abi);
  } catch {
    return send(res, 400, {
      error: "abi could not be parsed (Solidity-style JSON ABI expected).",
    });
  }
  const events = eventsOnly(iface);
  if (!events.length)
    return send(res, 400, {
      error: "abi has no non-anonymous events to decode.",
    });

  const abiJson = JSON.stringify(events);
  const abiHash = sha(abiJson);
  const base = baseUrl(req);

  const dup = await pool.query(
    "SELECT slug FROM contracts WHERE address = $1 AND abi_hash = $2",
    [address, abiHash]
  );
  if (dup.rows.length) {
    const slug = dup.rows[0].slug;
    return send(res, 200, {
      slug,
      url: `${base}/c/${slug}`,
      events_url: `${base}/c/${slug}/events`,
      existing: true,
      note: "Already registered. The manage token was only shown when it was first created.",
    });
  }
  const n = await pool.query("SELECT count(*)::int AS n FROM contracts");
  if (n.rows[0].n >= MAX_CONTRACTS)
    return send(res, 503, { error: "Registry is full." });

  const token = randomBytes(24).toString("hex");
  const slug = `${slugify(String(body.name ?? "")) || "contract"}-${randomBytes(
    3
  ).toString("hex")}`;
  await pool.query(
    "INSERT INTO contracts (slug, address, name, abi, abi_hash, token_hash) VALUES ($1,$2,$3,$4,$5,$6)",
    [
      slug,
      address,
      body.name ? String(body.name).slice(0, 80) : null,
      abiJson,
      abiHash,
      sha(token),
    ]
  );
  send(res, 201, {
    slug,
    url: `${base}/c/${slug}`,
    events_url: `${base}/c/${slug}/events`,
    manage_token: token,
    note: "Save manage_token now; it is shown once and is needed to delete or resync. Event data is public.",
  });
}

async function info(
  res: http.ServerResponse,
  req: http.IncomingMessage,
  c: any
) {
  const base = baseUrl(req);
  const [cur, first, counts] = await Promise.all([
    pool.query("SELECT max(last_block)::bigint AS b FROM indexer_cursor"),
    pool.query("SELECT min(block_number)::bigint AS b FROM events"),
    pool.query(
      "SELECT event_name, count(*)::int AS n FROM decoded_events WHERE contract_id = $1 GROUP BY 1 ORDER BY 1",
      [c.id]
    ),
  ]);
  send(res, 200, {
    slug: c.slug,
    name: c.name,
    address: c.address,
    created_at: c.created_at,
    indexed_from_block:
      first.rows[0]?.b == null ? null : Number(first.rows[0].b),
    indexed_to_block: cur.rows[0]?.b == null ? null : Number(cur.rows[0].b),
    decoded_to_block: Number(c.decoded_to),
    events_decoded: counts.rows,
    abi_events: (c.abi as any[]).map((e) => e.name),
    events_url: `${base}/c/${c.slug}/events`,
    note: "History is complete only from indexed_from_block.",
  });
}

async function listEvents(
  res: http.ServerResponse,
  c: any,
  q: URLSearchParams
) {
  const params: unknown[] = [c.id];
  let where = "contract_id = $1";
  const name = q.get("name");
  if (name) {
    params.push(name);
    where += ` AND event_name = $${params.length}`;
  }
  const from = q.get("from_block"),
    to = q.get("to_block");
  if (from && /^\d+$/.test(from)) {
    params.push(from);
    where += ` AND block_number >= $${params.length}`;
  }
  if (to && /^\d+$/.test(to)) {
    params.push(to);
    where += ` AND block_number <= $${params.length}`;
  }
  const limit = Math.min(Math.max(Number(q.get("limit") ?? 50) || 50, 1), 1000);
  const dir = q.get("order") === "asc" ? "ASC" : "DESC";
  params.push(limit);
  const r = await pool.query(
    `SELECT block_number::int AS block_number, event_index, event_name, args, block_time
     FROM decoded_events WHERE ${where}
     ORDER BY block_number ${dir}, event_index ${dir} LIMIT $${params.length}`,
    params
  );
  send(res, 200, r.rows);
}

function authed(req: http.IncomingMessage, c: any) {
  const t = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  return t.length > 0 && sha(t) === c.token_hash;
}

function proxy(req: http.IncomingMessage, res: http.ServerResponse) {
  const p = http.request(
    {
      host: UP.hostname,
      port: UP.port || 80,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    }
  );
  p.on("error", () =>
    send(res, 502, { error: "API is starting up, try again shortly." })
  );
  req.pipe(p);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      return res.end();
    }
    const u = new URL(req.url ?? "/", "http://x");
    const seg = u.pathname.split("/").filter(Boolean);

    if (seg[0] === "address" && seg.length === 2 && req.method === "GET") {
      if (!allowAddr(clientIp(req))) return send(res, 429, { error: "slow down" });
      const p = http.get({ host: "127.0.0.1", port: 3100, path: "/address/" + seg[1], timeout: 15000 }, (r) => {
        res.writeHead(r.statusCode ?? 502, { ...CORS, "content-type": "application/json" });
        r.pipe(res);
      });
      p.on("timeout", () => p.destroy());
      p.on("error", () => { if (!res.headersSent) send(res, 502, { error: "lookup unavailable, try again shortly" }); });
      return;
    }

    if (seg[0] === "contracts" && seg.length === 1) {
      if (req.method === "POST") return await register(req, res);
      if (req.method === "GET") {
        const r = await pool.query(
          "SELECT slug, name, address, created_at FROM contracts ORDER BY id DESC LIMIT 100"
        );
        return send(res, 200, r.rows);
      }
    }
    if (seg[0] === "c" && seg[1]) {
      const r = await pool.query("SELECT * FROM contracts WHERE slug = $1", [
        seg[1],
      ]);
      const c = r.rows[0];
      if (!c) return send(res, 404, { error: "Unknown contract." });
      if (seg.length === 2 && req.method === "GET")
        return await info(res, req, c);
      if (seg[2] === "events" && req.method === "GET")
        return await listEvents(res, c, u.searchParams);
      if (seg.length === 2 && req.method === "DELETE") {
        if (!authed(req, c))
          return send(res, 401, { error: "Missing or wrong manage token." });
        await pool.query("DELETE FROM contracts WHERE id = $1", [c.id]);
        return send(res, 200, { deleted: true });
      }
      if (seg[2] === "resync" && req.method === "POST") {
        if (!authed(req, c))
          return send(res, 401, { error: "Missing or wrong manage token." });
        await pool.query("UPDATE contracts SET decoded_to = 0 WHERE id = $1", [
          c.id,
        ]);
        return send(res, 200, { resync: "started" });
      }
      return send(res, 405, { error: "Not supported." });
    }
    proxy(req, res);
  } catch (e: any) {
    console.warn("request failed:", String(e?.message ?? e).slice(0, 120));
    if (!res.headersSent) send(res, 500, { error: "Internal error." });
  }
});

// ---- decode worker: turns raw revive.ContractEmitted rows into decoded_events ----
const ifaces = new Map<number, Interface>();
let busy = false;

async function decodeWindow(
  c: any,
  iface: Interface,
  from: number,
  to: number
) {
  const rows = await pool.query(
    `SELECT block_number, event_index, data, block_time FROM events
     WHERE pallet = 'revive' AND name = 'ContractEmitted'
       AND lower(data->>'contract') = $1 AND block_number > $2 AND block_number <= $3
     ORDER BY block_number, event_index`,
    [c.address, from, to]
  );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const r of rows.rows) {
      const topics = Array.isArray(r.data?.topics) ? r.data.topics : [];
      const d = decodeLog(iface, topics, String(r.data?.data ?? "0x"));
      if (!d) continue;
      await client.query(
        `INSERT INTO decoded_events (contract_id, block_number, event_index, event_name, args, block_time)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [
          c.id,
          r.block_number,
          r.event_index,
          d.name,
          JSON.stringify(d.args),
          r.block_time,
        ]
      );
    }
    await client.query(
      "UPDATE contracts SET decoded_to = $1 WHERE id = $2 AND decoded_to < $1",
      [to, c.id]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function decodeTick() {
  if (busy) return;
  busy = true;
  try {
    const cur = await pool.query(
      "SELECT max(last_block)::bigint AS b FROM indexer_cursor"
    );
    const upper = Number(cur.rows[0]?.b ?? 0);
    if (!upper) return;
    const cs = await pool.query(
      "SELECT id, address, abi, decoded_to FROM contracts WHERE decoded_to < $1 ORDER BY id",
      [upper]
    );
    for (const c of cs.rows) {
      let iface = ifaces.get(c.id);
      if (!iface) {
        iface = buildInterface(c.abi);
        ifaces.set(c.id, iface);
      }
      let from = Number(c.decoded_to);
      for (let w = 0; w < 25 && from < upper; w++) {
        const to = Math.min(from + WINDOW, upper);
        await decodeWindow(c, iface, from, to);
        from = to;
      }
    }
  } catch (e: any) {
    console.warn("decode tick failed:", String(e?.message ?? e).slice(0, 120));
  } finally {
    busy = false;
  }
}

server.listen(PORT, () =>
  console.log(`registry listening on :${PORT}, proxying to ${UP.origin}`)
);
setInterval(() => void decodeTick(), 5000);
void decodeTick();

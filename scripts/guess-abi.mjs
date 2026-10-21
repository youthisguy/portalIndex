// node scripts/guess-abi.mjs 0x<contract>
import { Interface } from "ethers";
const API = process.env.API || "https://portalindex-98f0.onrender.com";
const addr = (process.argv[2] || "").toLowerCase();
if (!/^0x[0-9a-f]{40}$/.test(addr)) { console.error("usage: node scripts/guess-abi.mjs 0x<contract>"); process.exit(1); }

const rows = await (await fetch(`${API}/events?pallet=eq.revive&name=eq.ContractEmitted&data->>contract=eq.${addr}&order=block_number.desc&limit=200`)).json();
const byTopic = new Map();
for (const r of rows) { const t = r.data.topics?.[0]; if (t && !byTopic.has(t)) byTopic.set(t, r.data); }
console.log(`${rows.length} events, ${byTopic.size} distinct event types\n`);

const splitTypes = (s) => { const out = []; let d = 0, cur = ""; for (const c of s) { if (c === "(") d++; if (c === ")") d--; if (c === "," && !d) { out.push(cur); cur = ""; } else cur += c; } if (cur) out.push(cur); return out; };
const combos = (n, k) => { const res = []; const go = (s, c) => { if (c.length === k) return res.push(c); for (let i = s; i < n; i++) go(i + 1, [...c, i]); }; go(0, []); return res; };

const abi = [];
for (const [topic0, d] of byTopic) {
  const dataBytes = (d.data.length - 2) / 2;
  const res = await (await fetch(`https://api.openchain.xyz/signature-database/v1/lookup?event=${topic0}&filter=true`)).json();
  const sig = res?.result?.event?.[topic0]?.[0]?.name;
  if (!sig) { console.log(`? ${topic0}  not in signature database (data ${dataBytes} bytes${dataBytes % 32 ? ", not 32-byte aligned: maybe ink!/SCALE" : ""})`); continue; }
  const name = sig.slice(0, sig.indexOf("("));
  const types = splitTypes(sig.slice(sig.indexOf("(") + 1, -1));
  const k = d.topics.length - 1;
  let found = null;
  for (const idx of combos(types.length, k)) {
    const ev = { type: "event", name, anonymous: false, inputs: types.map((t, i) => ({ name: "arg" + i, type: t, indexed: idx.includes(i) })) };
    try { if (new Interface([ev]).parseLog({ topics: d.topics, data: d.data })) { found = ev; break; } } catch {}
  }
  console.log(`${found ? "✓" : "✗"} ${sig}  (${topic0.slice(0, 10)}…)`);
  if (found) abi.push(found);
}
console.log("\nPaste this ABI into Pindex:\n" + JSON.stringify(abi, null, 2));
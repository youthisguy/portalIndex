// One-off patch: adds EVM transaction search to the explorer page.  Run:  node apply-tx-search.mjs demo/app/index.html
// It refuses to write anything unless every target text is found exactly once.
import { readFileSync, writeFileSync } from "fs";
const file = process.argv[2] ?? "demo/app/index.html";
let s = readFileSync(file, "utf8");

const LOOKUP_TX = `async function lookupTx(base, h, out) {
  let rows = [];
  try { rows = await get(base, "/evm_transactions?tx_hash=eq." + h.toLowerCase()); } catch (_) { return false; }
  if (!rows.length) return false;
  const t = rows[0];
  const head = el("div", "sub", "EVM transaction ");
  head.style.marginBottom = "12px";
  head.style.overflowWrap = "anywhere";
  head.append(makeAddressElement(t.tx_hash));
  head.append(makeShareButton());
  out.append(head);
  const box = el("div", "rows");
  box.style.marginBottom = "16px";
  const add = (label, v) => {
    const r = el("div", "row");
    r.append(el("span", null, label), typeof v === "object" ? v : el("span", "num", String(v)));
    box.append(r);
  };
  add("Status", t.success === true ? "Success" : t.success === false ? "Failed" : "Unknown");
  add("Block", "#" + fmt(t.block_number) + (t.block_time ? " · " + ago(t.block_time) : ""));
  add("From", t.from_addr ? makeAddressElement(t.from_addr) : "unknown");
  add("To", t.to_addr ? makeAddressElement(t.to_addr) : "Contract creation");
  add("Value (raw units)", t.value == null ? "n/a" : fmt(t.value));
  if (t.selector) add("Method selector", t.selector);
  add("Input size", (t.input_bytes == null ? 0 : t.input_bytes) + " bytes");
  add("Nonce", t.nonce == null ? "n/a" : t.nonce);
  out.append(box);
  let evs = [];
  try { evs = await get(base, "/events?block_number=eq." + t.block_number + "&extrinsic_index=eq." + t.extrinsic_index + "&order=event_index.asc&limit=200"); } catch (_) {}
  if (evs.length) {
    const title = el("h3", null, "Events in this transaction (" + evs.length + ")");
    title.style.fontSize = "1rem";
    title.style.margin = "0 0 8px 0";
    out.append(title);
    const list = el("div", "events");
    evs.forEach((e) => {
      const r = el("details", "evd");
      const sum = el("summary", null);
      sum.append(el("span", "mono", e.pallet + "." + e.name), el("span", "pv mono", JSON.stringify(e.data)));
      r.append(sum, el("pre", null, JSON.stringify(e.data, null, 2)));
      list.append(r);
    });
    out.append(list);
  }
  return true;
}

`;

// Targets are matched ignoring how your formatter wrapped the lines, and each must match exactly once.
const edits = [
  ['"(balance|total_held|amount|free|reserved)":(-?\\d+)', '"(balance|total_held|amount|free|reserved|value)":(-?\\d+)'],
  ['placeholder="Address, block number or block hash"', 'placeholder="Address, transaction hash, block number or block hash"'],
  ['aria-label="Search by address, block number or block hash"', 'aria-label="Search by address, transaction hash, block number or block hash"'],
  [/<b>block number<\/b>\s+or\s+<b>block hash<\/b>\./, "<b>EVM transaction hash</b>, <b>block number</b> or <b>block hash</b>."],
  ["if (/^\\d{1,12}$/.test(a) || /^0x[0-9a-fA-F]{64}$/.test(a))",
   "if (/^0x[0-9a-fA-F]{64}$/.test(a) && (await lookupTx(base, a, out))) return;\n          if (/^\\d{1,12}$/.test(a) || /^0x[0-9a-fA-F]{64}$/.test(a))"],
  ["async function lookup() {", LOOKUP_TX + "async function lookup() {"],
  [/return say\(\s*"That block isn't in the index\./,
   "return say(\n            /^0x/.test(q) ? \"No transaction or block with that hash is indexed. It may be older than Pindex's history, or not indexed yet.\" : \"That block isn't in the index."],
];
if (s.includes("async function lookupTx(")) { console.error("Already patched: lookupTx exists. Nothing changed."); process.exit(1); }
const count = (f) => typeof f === "string" ? s.split(f).length - 1 : (s.match(new RegExp(f.source, "g")) || []).length;
for (const [f] of edits) {
  const n = count(f);
  if (n !== 1) { console.error(`Not patched: expected 1 match, found ${n} for:\n  ${String(f).slice(0, 90)}`); process.exit(1); }
}
for (const [f, r] of edits) s = s.replace(f, () => r);
writeFileSync(file, s);
console.log(`patched ${file}: ${edits.length} edits`);

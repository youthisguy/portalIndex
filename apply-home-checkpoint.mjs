// Adds an "On-chain checkpoint" section to the home page. Run: node apply-home-checkpoint.mjs demo/index.html
// Reads only the Pindex API (the checkpoint contract's indexed events). Writes nothing unless every anchor matches once.
import { readFileSync, writeFileSync } from "fs";
const file = process.argv[2] ?? "demo/index.html";
let s = readFileSync(file, "utf8");
const CONTRACT = "0x4df57190debe09d922d1afe9458aff439bcd2cb1";
const TOPIC0 = "0x73e1e62d0436e96b9f7e3de5d901448458b26a0905e0a031320b5cb73b3f6a40"; // Checkpoint(uint256,bytes32,address,uint256)

const SECTION = `<section id="checkpoint" aria-labelledby="cp-h">
    <h2 id="cp-h">Check our work: the on-chain checkpoint</h2>
    <p class="muted" style="max-width:40em">Every 1,000 blocks, Pindex anchors one 32-byte hash of everything it has stored, and of every range it could not read, to a contract on the testnet. Anyone can recompute it from the public API and compare, so the index cannot be quietly changed after the fact.</p>
    <div class="panel">
      <div class="kv" id="cp-kv"><span class="k">Status</span><code>Loading…</code><span></span></div>
      <p class="muted" style="font-size:.9rem;margin:0 0 10px">Verify the latest checkpoint yourself:</p>
      <pre>npx tsx scripts/verify-checkpoint.ts</pre>
      <p class="muted" style="font-size:.85rem;margin:0">It proves the stored data has not changed since it was anchored and that the stated gaps are the real ones. It does not prove the data matches the chain. <a href="https://github.com/youthisguy/portalIndex/blob/main/docs/checkpoints.md">How it works</a></p>
    </div>
  </section>

  `;

const JS = `/* ---- on-chain checkpoint ---- */
const CP_CONTRACT = "${CONTRACT}";
const CP_TOPIC = "${TOPIC0}";
async function loadCheckpoint() {
  const kv = $("cp-kv");
  if (!kv) return;
  const row = (label, node, copy) => {
    const k = document.createElement("span"); k.className = "k"; k.textContent = label;
    let v = node;
    if (typeof node === "string") { v = document.createElement("code"); v.textContent = node; }
    kv.append(k, v, copy ? copyBtn(() => copy) : document.createElement("span"));
  };
  try {
    const q = "/events?pallet=eq.revive&name=eq.ContractEmitted&data->>contract=eq." + CP_CONTRACT
      + "&data->topics->>0=eq." + CP_TOPIC + "&order=block_number.desc,event_index.desc&limit=1";
    const rows = await fetch(API + q).then((r) => r.ok ? r.json() : Promise.reject());
    kv.textContent = "";
    if (!rows.length) {
      row("Status", "No checkpoint published yet. The publisher is in testing and will anchor one at the next multiple of 1,000 blocks.");
      row("Contract", CP_CONTRACT, CP_CONTRACT);
      return;
    }
    const e = rows[0], topics = e.data.topics || [], d = String(e.data.data || "").replace(/^0x/, "");
    const hash = "0x" + d.slice(0, 64);
    const when = new Date(Number(BigInt("0x" + d.slice(64, 128))) * 1000);
    row("Latest checkpoint", "Block " + fmt(BigInt(topics[1]).toString()));
    row("State hash", hash, hash);
    row("Published", ago(when.toISOString()));
    try {
      const tx = await fetch(API + "/evm_transactions?block_number=eq." + e.block_number + "&extrinsic_index=eq." + e.extrinsic_index).then((r) => r.json());
      if (tx.length) {
        const a = document.createElement("a"); a.href = "app/?q=" + tx[0].tx_hash; a.textContent = tx[0].tx_hash;
        a.style.overflowWrap = "anywhere"; a.style.fontSize = ".8rem";
        row("Transaction", a, tx[0].tx_hash);
      }
    } catch (_) {}
    row("Contract", CP_CONTRACT, CP_CONTRACT);
  } catch (_) {
    kv.textContent = "";
    row("Status", "Checkpoint unavailable right now. Try again shortly.");
  }
}
loadCheckpoint(); setInterval(loadCheckpoint, 60000);

/* ---- console loop ---- */`;

const edits = [
  ['<section aria-labelledby="can">', SECTION + '<section aria-labelledby="can">'],
  ["/* ---- console loop ---- */", JS],
];
if (s.includes("async function loadCheckpoint(")) { console.error("Already patched: loadCheckpoint exists. Nothing changed."); process.exit(1); }
for (const [f] of edits) {
  const n = s.split(f).length - 1;
  if (n !== 1) { console.error(`Not patched: expected 1 match, found ${n} for:\n  ${f.slice(0, 80)}`); process.exit(1); }
}
for (const [f, r] of edits) s = s.replace(f, () => r);
writeFileSync(file, s);
console.log(`patched ${file}: ${edits.length} edits`);

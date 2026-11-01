// Adds an "On-chain checkpoint" card to the explorer page. Run: node apply-checkpoint-card.mjs demo/app/index.html
// Reads only the Pindex API (the checkpoint contract's indexed events), so it needs no RPC access from the browser.
// Writes nothing unless every target text is found exactly once; refuses a second run.
import { readFileSync, writeFileSync } from "fs";
const file = process.argv[2] ?? "demo/app/index.html";
let s = readFileSync(file, "utf8");
const CONTRACT = "0x4df57190debe09d922d1afe9458aff439bcd2cb1";
const TOPIC0 = "0x73e1e62d0436e96b9f7e3de5d901448458b26a0905e0a031320b5cb73b3f6a40"; // Checkpoint(uint256,bytes32,address,uint256)

const CARD = `<!-- On-chain checkpoint -->
      <section class="card" aria-labelledby="h-checkpoint" style="margin-bottom: 24px">
        <div class="feed-header" style="border-bottom: 1px solid var(--line); padding-bottom: 14px; margin-bottom: 0">
          <h2 id="h-checkpoint" style="margin: 0; font-size: 1.15rem">On-chain checkpoint</h2>
        </div>
        <div id="checkpoint" class="rows"></div>
        <p class="sub" style="margin: 0">
          Every 1,000 blocks Pindex anchors one hash of everything it has stored to a contract on the testnet.
          Check it yourself: <span class="mono">npx tsx scripts/verify-checkpoint.ts</span>
        </p>
      </section>

      `;

const JS = `const CHECKPOINT_CONTRACT = "${CONTRACT}";
      const CHECKPOINT_TOPIC = "${TOPIC0}";
      async function loadCheckpoint(base) {
        const box = $("#checkpoint");
        if (!box) return;
        const row = (label, v) => {
          const r = el("div", "row");
          r.append(el("span", null, label), typeof v === "object" ? v : el("span", "num", String(v)));
          box.append(r);
        };
        try {
          const rows = await get(base, "/events?pallet=eq.revive&name=eq.ContractEmitted&data->>contract=eq." + CHECKPOINT_CONTRACT + "&data->topics->>0=eq." + CHECKPOINT_TOPIC + "&order=block_number.desc,event_index.desc&limit=1");
          box.replaceChildren();
          if (!rows.length) {
            box.append(el("div", "empty", "No checkpoint published yet. The publisher is in testing and will anchor one at the next multiple of 1,000 blocks."));
            return;
          }
          const e = rows[0], topics = e.data.topics || [], d = String(e.data.data || "").replace(/^0x/, "");
          const cpBlock = BigInt(topics[1]);
          const hash = "0x" + d.slice(0, 64);
          const when = new Date(Number(BigInt("0x" + d.slice(64, 128))) * 1000);
          row("Latest checkpoint", "Block " + fmt(cpBlock.toString()));
          row("State hash", makeAddressElement(hash));
          row("Published", ago(when.toISOString()));
          let tx = [];
          try { tx = await get(base, "/evm_transactions?block_number=eq." + e.block_number + "&extrinsic_index=eq." + e.extrinsic_index); } catch (_) {}
          if (tx.length) {
            const a = el("a", "mono", short(tx[0].tx_hash));
            a.href = "?q=" + tx[0].tx_hash;
            row("Transaction", a);
          }
          row("Contract", makeAddressElement(CHECKPOINT_CONTRACT));
        } catch (_) {
          box.replaceChildren(el("div", "empty", "Checkpoint unavailable right now."));
        }
      }

      async function loadTransfers(base) {`;

const edits = [
  ["<!-- Core Token & NFT Section (Full Width Stacked) -->", CARD + "<!-- Core Token & NFT Section (Full Width Stacked) -->"],
  ["async function loadTransfers(base) {", JS],
  ["loadBlocks(base);", "loadBlocks(base);\n        loadCheckpoint(base);"],
];
if (s.includes("async function loadCheckpoint(")) { console.error("Already patched: loadCheckpoint exists. Nothing changed."); process.exit(1); }
for (const [f] of edits) {
  const n = s.split(f).length - 1;
  if (n !== 1) { console.error(`Not patched: expected 1 match, found ${n} for:\n  ${f.slice(0, 80)}`); process.exit(1); }
}
for (const [f, r] of edits) s = s.replace(f, () => r);
writeFileSync(file, s);
console.log(`patched ${file}: ${edits.length} edits`);

// Adds the one-chain-per-database guard, a check for an endpoint that switches chains while running,
// and fixes the native balance sync. Usage: node apply-chain-guard.mjs src/ingest.ts
// Safe to run again after an earlier version of this script: it only adds what is missing.
// Every target must match exactly once or nothing is written.
import { readFileSync, writeFileSync } from "fs";
const file = process.argv[2] ?? "src/ingest.ts";
let s = readFileSync(file, "utf8");

const OLD_IMPORT = 'import { foreignChain } from "./chain-guard.js";';
const NEW_IMPORT = 'import { foreignChain, nodeFarBehind } from "./chain-guard.js";';
const GAPS_IMPORT = 'import { gapInsert } from "./gaps.js";';
const ALTER = '  await pool.query("ALTER TABLE indexer_gaps ADD COLUMN IF NOT EXISTS filled_at TIMESTAMPTZ");';
const TARGET = "      const target = header.number.toNumber();";

const GUARD = `${ALTER}

  // One database holds one chain: events are not stored per chain, so a second chain would silently mix in.
  const known = await pool.query("SELECT chain_key FROM indexer_cursor").then((r) => r.rows.map((x: any) => x.chain_key as string), () => [] as string[]);
  const other = foreignChain(known, chainKey);
  if (other) {
    console.error(\`REFUSING TO INDEX: this node is chain \${chainKey}, but the database already holds \${other.join(", ")}. \` +
      "Events are not stored per chain, so mixing chains corrupts data. Check WS_URL, or use a fresh database if the network was reset.");
    process.exit(1);
  }`;

const HEAD_CHECK = `${TARGET}
      // The endpoint switched to a different chain while we were running: restart so the chain is identified again.
      if (nodeFarBehind(target, next)) {
        console.error(\`Node head \${target} is far behind block \${next}: the endpoint changed chain. Exiting so the supervisor restarts and re-checks it.\`);
        process.exit(1);
      }`;

const steps = [];
if (!s.includes(NEW_IMPORT)) {
  steps.push(s.includes(OLD_IMPORT) ? [OLD_IMPORT, NEW_IMPORT] : [GAPS_IMPORT, `${GAPS_IMPORT}\n${NEW_IMPORT}`]);
}
if (!s.includes("REFUSING TO INDEX")) steps.push([ALTER, GUARD]);
if (!s.includes("args: []")) steps.push(["entriesPaged({ pageSize: 200, startKey })", "entriesPaged({ args: [], pageSize: 200, startKey })"]);
if (!s.includes("the endpoint changed chain")) steps.push([TARGET, HEAD_CHECK]);

if (!steps.length) { console.error("Already fully patched. Nothing changed."); process.exit(1); }
for (const [find] of steps) {
  const n = s.split(find).length - 1;
  if (n !== 1) { console.error(`Not patched: expected 1 match, found ${n} for:\n  ${find.slice(0, 90)}`); process.exit(1); }
}
for (const [find, rep] of steps) s = s.replace(find, () => rep);
writeFileSync(file, s);
console.log(`patched ${file}: ${steps.length} edit(s) applied`);

// Removes the "On-chain checkpoint" card added by apply-checkpoint-card.mjs from the explorer page.
//   node remove-checkpoint-card.mjs demo/app/index.html
// Tolerant of reformatting. Writes nothing unless each part is found exactly once.
import { readFileSync, writeFileSync } from "fs";
const file = process.argv[2] ?? "demo/app/index.html";
let s = readFileSync(file, "utf8");
if (!s.includes("loadCheckpoint")) { console.error("Nothing to remove: the checkpoint card is not in " + file); process.exit(1); }
const parts = [
  [/<!-- On-chain checkpoint -->[\s\S]*?<\/section>\s*/g, ""],
  [/const CHECKPOINT_CONTRACT = [\s\S]*?(?=async function loadTransfers\(base\) \{)/g, ""],
  [/\s*loadCheckpoint\(base\);/g, ""],
];
for (const [re] of parts) {
  const n = (s.match(re) || []).length;
  if (n !== 1) { console.error(`Not changed: expected 1 match, found ${n} for ${re}`); process.exit(1); }
}
for (const [re, r] of parts) s = s.replace(re, r);
if (/checkpoint/i.test(s.replace(/<title>[\s\S]*?<\/title>/, ""))) console.warn("Note: the word 'checkpoint' still appears elsewhere in the file; check it is intended.");
writeFileSync(file, s);
console.log(`removed the checkpoint card from ${file}`);

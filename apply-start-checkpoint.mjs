// Starts the checkpoint worker from start.sh when CHECKPOINT_PRIVATE_KEY is set. Usage: node apply-start-checkpoint.mjs start.sh
// Every target must match exactly once or nothing is written.
import { readFileSync, writeFileSync } from "fs";
const file = process.argv[2] ?? "start.sh";
let s = readFileSync(file, "utf8");
if (s.includes("CP_PID")) { console.error("Already patched. Nothing changed."); process.exit(1); }

const BLOCK = `REG_PID=$!

# Automatic checkpoints: only started when a publisher key is configured (see docs/checkpoints.md).
CP_PID=""
if [ -n "\${CHECKPOINT_PRIVATE_KEY:-}" ]; then
  (
    while true; do
      npx tsx src/checkpoint.ts
      echo "checkpoint worker exited; restarting in 60s"
      sleep 60
    done
  ) &
  CP_PID=$!
fi`;

const edits = [
  ["REG_PID=$!", BLOCK],
  ["trap 'kill $PG_PID $ING_PID $REG_PID 2>/dev/null; exit 0' TERM INT", "trap 'kill $PG_PID $ING_PID $REG_PID $CP_PID 2>/dev/null; exit 0' TERM INT"],
  ['echo "a process exited; stopping the container so it restarts"\nkill $PG_PID $ING_PID $REG_PID 2>/dev/null', 'echo "a process exited; stopping the container so it restarts"\nkill $PG_PID $ING_PID $REG_PID $CP_PID 2>/dev/null'],
];
for (const [find] of edits) {
  const n = s.split(find).length - 1;
  if (n !== 1) { console.error(`Not patched: expected 1 match, found ${n} for:\n  ${find.slice(0, 90)}\nAdd the block by hand instead (see docs/checkpoints.md).`); process.exit(1); }
}
for (const [find, rep] of edits) s = s.replace(find, () => rep);
writeFileSync(file, s);
console.log(`patched ${file}: ${edits.length} edits`);

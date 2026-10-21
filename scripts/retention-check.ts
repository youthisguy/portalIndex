import { ApiPromise, WsProvider } from "@polkadot/api";

// Finds how far back this node still serves chain state (events), and whether it keeps old block bodies.
async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(process.env.WS_URL) });
  const head = (await api.rpc.chain.getHeader()).number.toNumber();
  const stateOk = async (n: number) => {
    try {
      const at = await api.at(await api.rpc.chain.getBlockHash(n));
      await at.query.system.events();
      return true;
    } catch { return false; }
  };
  console.log(`head: ${head}`);
  for (const n of [1, 1000, 41000, 50000, 100000, head - 1000]) {
    if (n < 1 || n > head) continue;
    const hash = await api.rpc.chain.getBlockHash(n);
    let body = "no";
    try { const b: any = await api.rpc.chain.getBlock(hash); body = `yes (${b.block.extrinsics.length} extrinsics)`; } catch { /* pruned */ }
    console.log(`block ${n}: body ${body} | events ${(await stateOk(n)) ? "YES" : "no"}`);
  }
  // binary search for the oldest block whose events are still readable (assumes a contiguous recent window)
  if (await stateOk(1)) { console.log("RESULT: events are available from block 1 (archive-like node)"); }
  else {
    let lo = 1, hi = head;
    while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (await stateOk(mid)) hi = mid; else lo = mid; }
    console.log(`RESULT: oldest readable events at about block ${hi} (${head - hi} blocks, roughly ${Math.round(((head - hi) * 6) / 3600)} h at 6 s/block)`);
  }
  await api.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

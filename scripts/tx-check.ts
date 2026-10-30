import { ApiPromise, WsProvider } from "@polkadot/api";
import { Transaction, keccak256 } from "ethers";

// Works out which hash the chain's own EVM RPC uses for a transaction, and whether our derivation matches it.
//   WS_URL=wss://test-node-v3.portaldot.dev npx tsx scripts/tx-check.ts
// Defaults: the checkpoint contract deployment from the README (block 135953).
const BLOCK = Number(process.env.BLOCK ?? 135953);
const EXPECT = (process.env.EXPECT ?? "0x6459ab692c450bb9088b38673bf7eb1b76346f6400706372abf111acfe93eb33").toLowerCase();
const EVM_RPC = process.env.EVM_RPC ?? "https://test-evm-rpc-v3.portaldot.dev";

async function rpc(method: string, params: unknown[]) {
  const r = await fetch(EVM_RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j: any = await r.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}

async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(process.env.WS_URL) });
  const hash = await api.rpc.chain.getBlockHash(BLOCK);
  const blk: any = await api.rpc.chain.getBlock(hash);
  const exts: any[] = blk.block.extrinsics;
  console.log(`\nblock ${BLOCK}: ${exts.length} extrinsics, looking for ${EXPECT}\n`);

  let matched = false;
  exts.forEach((e, i) => {
    console.log(`[${i}] ${e.method.section}.${e.method.method}`);
    const candidates: Record<string, string> = { "extrinsic hash (blake2)": e.hash.toHex(), "call hash": e.method.hash.toHex() };
    if (e.method.section === "revive" && e.method.method === "ethTransact") {
      const payload = e.method.args[0].toHex();
      candidates["keccak256(payload)  <- what the indexer stores"] = keccak256(payload);
      try { candidates["keccak256(re-serialized tx)"] = Transaction.from(payload).hash ?? "-"; } catch { /* not decodable */ }
    }
    for (const [name, h] of Object.entries(candidates)) {
      const hit = h.toLowerCase() === EXPECT;
      matched ||= hit;
      console.log(`    ${name.padEnd(48)} ${h}${hit ? "   <== EQUALS THE EXPECTED HASH" : ""}`);
    }
  });

  console.log(`\nAsking the chain's EVM RPC (${EVM_RPC}):`);
  try { console.log("  eth_getTransactionByHash(expected):", JSON.stringify(pick(await rpc("eth_getTransactionByHash", [EXPECT])))); } catch (e: any) { console.log("  eth_getTransactionByHash failed:", e.message); }
  try {
    const b = await rpc("eth_getBlockByNumber", ["0x" + BLOCK.toString(16), false]);
    console.log("  eth_getBlockByNumber transactions:", JSON.stringify(b?.transactions ?? b));
  } catch (e: any) { console.log("  eth_getBlockByNumber failed:", e.message); }

  console.log(matched ? "\nMATCH: one of the derivations equals the expected hash." : "\nNO MATCH: none of the derivations equals the expected hash. Send this whole output.");
  await api.disconnect();
  process.exit(matched ? 0 : 1);
}
const pick = (t: any) => (t ? { hash: t.hash, blockNumber: t.blockNumber, transactionIndex: t.transactionIndex, from: t.from, to: t.to } : t);
main().catch((e) => { console.error(e); process.exit(1); });

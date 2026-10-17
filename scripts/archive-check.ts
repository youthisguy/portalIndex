import { ApiPromise, WsProvider } from "@polkadot/api";
async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(process.env.WS_URL) });
  for (const n of [1, 1000, 50000]) {
    try {
      const at = await api.at(await api.rpc.chain.getBlockHash(n));
      const ev: any = await at.query.system.events();
      console.log(`block ${n}: OK (${ev.length} events)`);
    } catch (e: any) {
      console.log(`block ${n}: FAILED - ${String(e.message).slice(0, 80)}`);
    }
  }
  await api.disconnect();
}
main();

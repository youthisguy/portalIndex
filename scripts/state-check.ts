import { ApiPromise, WsProvider } from "@polkadot/api";

// Counts what already exists in chain storage right now. If these are all zero,
// event-derived balances/ownership are complete from the moment the indexer starts.
const TARGETS: [string, string][] = [
  ["assets", "asset"], ["assets", "account"],
  ["nfts", "collection"], ["nfts", "item"],
  ["uniques", "class"], ["uniques", "collection"], ["uniques", "asset"], ["uniques", "item"],
];

async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(process.env.WS_URL) });
  for (const [pallet, item] of TARGETS) {
    const q = (api.query as any)[pallet]?.[item];
    if (!q) continue;
    try {
      const keys = await q.keys();
      console.log(`${pallet}.${item}: ${keys.length}`);
    } catch (e: any) {
      console.log(`${pallet}.${item}: error ${String(e.message).slice(0, 60)}`);
    }
  }
  await api.disconnect();
}
main();

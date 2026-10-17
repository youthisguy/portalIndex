import { ApiPromise, WsProvider } from "@polkadot/api";
async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(process.env.WS_URL) });
  const cur: any = (await api.query.staking.currentEra()).toJSON();
  console.log("current era:", cur);
  try { console.log("historyDepth:", (await api.query.staking.historyDepth()).toString()); } catch { console.log("historyDepth: not found"); }
  for (const era of [cur, cur - 1, cur - 5]) {
    try {
      const r: any = await api.query.staking.erasValidatorReward(era);
      console.log(`era ${era} validator reward:`, r.toString() || "none");
    } catch (e: any) { console.log(`era ${era}: error ${e.message.slice(0, 60)}`); }
  }
  await api.disconnect();
}
main();

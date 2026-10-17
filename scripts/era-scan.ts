import { ApiPromise, WsProvider } from "@polkadot/api";
async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(process.env.WS_URL) });
  const c: any = api.consts.staking;
  console.log("historyDepth const:", c.historyDepth?.toString() ?? "n/a", "| sessionsPerEra:", c.sessionsPerEra?.toString() ?? "n/a");
  const cur = Number((await api.query.staking.currentEra()).toString());
  const active: any = (await api.query.staking.activeEra()).toJSON();
  console.log("currentEra:", cur, "| activeEra:", active?.index);
  for (let era = 0; era <= cur; era++) {
    const reward: any = await api.query.staking.erasValidatorReward(era);
    const pts: any = await api.query.staking.erasRewardPoints(era);
    const vals = Object.keys((pts.toJSON() as any)?.individual ?? {}).length;
    console.log(`era ${era}: reward=${reward.toString() || "-"} | validators with points=${vals}`);
  }
  await api.disconnect();
}
main();

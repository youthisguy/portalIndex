import { ApiPromise, WsProvider } from "@polkadot/api";
async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(process.env.WS_URL) });
  const h160 = process.env.ADDR!;
  const acct = await (api.call as any).reviveApi.accountId(h160);
  console.log("H160:", h160);
  console.log("mapped native account:", acct.toString());
  const back = await (api.call as any).reviveApi.address(acct.toString());
  console.log("round trip H160:", back.toString());
  await api.disconnect();
}
main();

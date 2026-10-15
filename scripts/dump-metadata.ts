import { ApiPromise, WsProvider } from "@polkadot/api";
import { mkdirSync, writeFileSync } from "fs";

const WS = process.env.WS_URL ?? "wss://testnetv3-node.feso-apps.xyz";
const WANTED = ["assets", "uniques", "nfts", "revive", "balances"];

async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(WS) });
  const out: string[] = [];
  const log = (s = "") => {
    console.log(s);
    out.push(s);
  };

  const chain = (await api.rpc.system.chain()).toString();
  const decimals = api.registry.chainDecimals;
  const ss58 = api.registry.chainSS58;
  const tokens = api.registry.chainTokens;
  log(`# Portaldot metadata dump`);
  log(`- Chain: ${chain}`);
  log(`- Endpoint: ${WS}`);
  log(`- Tokens: ${tokens.join(", ")} | Decimals: ${decimals.join(", ")} | SS58: ${ss58}`);
  log(`- Spec version: ${api.runtimeVersion.specVersion.toString()}`);
  log();

  // 1. Pallet list
  const pallets = api.runtimeMetadata.asLatest.pallets.map((p) => ({
    name: p.name.toString(),
    index: p.index.toNumber(),
  }));
  log(`## Pallets (${pallets.length})`);
  pallets.forEach((p) => log(`- [${p.index}] ${p.name}`));
  log();

  // 2. Check wanted pallets
  log(`## Presence check`);
  for (const w of WANTED) {
    const found = pallets.find((p) => p.name.toLowerCase() === w);
    log(`- ${w}: ${found ? "YES (" + found.name + ")" : "MISSING"}`);
  }
  log();

  // 3. Events per pallet (wanted pallets get full field shapes)
  log(`## Events`);
  for (const section of Object.keys(api.events).sort()) {
    const isWanted = WANTED.includes(section.toLowerCase());
    const names = Object.keys(api.events[section]);
    log(`### ${section} (${names.length} events)`);
    for (const name of names) {
      if (!isWanted) {
        log(`- ${name}`);
        continue;
      }
      const fields = api.events[section][name].meta.fields
        .map((f) => `${f.name.unwrapOr("").toString()}: ${f.typeName.unwrapOr("?").toString()}`)
        .join(", ");
      log(`- ${name}(${fields})`);
    }
  }
  log();

  // 4. Runtime APIs (look for reviveApi)
  log(`## Runtime APIs`);
  Object.keys(api.call)
    .sort()
    .forEach((k) => log(`- ${k}: ${Object.keys((api.call as any)[k]).join(", ")}`));
  log();

  // 5. Latest finalized block events
  const hash = await api.rpc.chain.getFinalizedHead();
  const block = await api.rpc.chain.getBlock(hash);
  const apiAt = await api.at(hash);
  const events = (await apiAt.query.system.events()) as any;
  log(`## Latest finalized block #${block.block.header.number.toString()} (${hash.toHex()})`);
  log(`- Extrinsics: ${block.block.extrinsics.length} | Events: ${events.length}`);
  events.forEach((r: any) => {
    log(`- ${r.event.section}.${r.event.method} ${JSON.stringify(r.event.data.toHuman())}`);
  });

  mkdirSync("docs", { recursive: true });
  writeFileSync("docs/pallets.md", out.join("\n"));
  console.log("\nSaved to docs/pallets.md");
  await api.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

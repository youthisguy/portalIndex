import { ApiPromise, WsProvider } from "@polkadot/api";

// Compares Pindex's derived state (asset balances, NFT owners) with chain storage,
// read at the exact block the indexer last processed. Reports every difference.
const API = process.env.API ?? "https://portalindex-98f0.onrender.com";

async function getJson(path: string): Promise<any[]> {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  const t = (await r.text()).replace(/"(balance)":(-?\d+)/g, '"$1":"$2"'); // keep big ints exact
  return JSON.parse(t);
}

function diff(label: string, chain: Map<string, string>, index: Map<string, string>) {
  let bad = 0;
  for (const [k, v] of chain) {
    if (!index.has(k)) { console.log(`  MISSING in index: ${k} (chain ${v})`); bad++; }
    else if (index.get(k) !== v) { console.log(`  DIFFERENT: ${k} chain=${v} index=${index.get(k)}`); bad++; }
  }
  for (const [k, v] of index) if (!chain.has(k)) { console.log(`  EXTRA in index: ${k} (index ${v})`); bad++; }
  console.log(`${label}: chain=${chain.size} index=${index.size} mismatches=${bad}`);
  return bad;
}

async function main() {
  const api = await ApiPromise.create({ provider: new WsProvider(process.env.WS_URL) });
  const cur = (await getJson("/indexer_cursor"))[0];
  const hash = await api.rpc.chain.getBlockHash(cur.last_block);
  const at: any = await api.at(hash);
  console.log(`Comparing at block ${cur.last_block}`);
  let bad = 0;

  // Assets: balance per (asset, holder)
  const chainA = new Map<string, string>();
  for (const [k, v] of await at.query.assets.account.entries()) {
    const acct: any = typeof v.isSome === "boolean" ? (v.isSome ? v.unwrap() : null) : v;
    if (acct && acct.balance.toString() !== "0") chainA.set(`${k.args[0]}:${k.args[1]}`, acct.balance.toString());
  }
  const idxA = new Map<string, string>();
  for (const r of await getJson("/asset_balances?limit=1000")) idxA.set(`${r.asset_id}:${r.holder}`, String(r.balance));
  bad += diff("assets", chainA, idxA);

  // NFTs: owner per (collection, item), for each NFT pallet that exists
  for (const pallet of ["nfts", "uniques"]) {
    if (!at.query[pallet]?.account) continue;
    const chainN = new Map<string, string>();
    for (const k of await at.query[pallet].account.keys()) chainN.set(`${k.args[1]}:${k.args[2]}`, k.args[0].toString());
    const idxN = new Map<string, string>();
    for (const r of await getJson(`/nft_owners?pallet=eq.${pallet}&limit=1000`)) idxN.set(`${r.collection}:${r.item}`, r.owner);
    bad += diff(pallet, chainN, idxN);
  }
  console.log(bad === 0 ? "ALL MATCH" : `${bad} DIFFERENCES`);
  await api.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

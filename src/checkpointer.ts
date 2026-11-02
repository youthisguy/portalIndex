// Publishes the rolling state hash to PortalIndexCheckpoint on a schedule. See docs/checkpoints.md.
//   npx tsx src/checkpointer.ts            run forever
//   npx tsx src/checkpointer.ts --once     one attempt, then exit
// Needs CHECKPOINT_PRIVATE_KEY (the contract owner's key) unless CHECKPOINT_DRY_RUN=1.
import pg from "pg";
import { Contract, JsonRpcProvider, Network, Wallet } from "ethers";
import { checkpointOnce, dbCursor, dbSource, ethersAnchor, type Deps } from "./checkpoint-core.js";

const DB = process.env.DATABASE_URL ?? "postgres://portalindex:portalindex@localhost:5432/portalindex";
const RPC = process.env.EVM_RPC ?? "https://test-evm-rpc-v3.portaldot.dev";
const CHAIN_ID = Number(process.env.EVM_CHAIN_ID ?? 420420777);
const ADDRESS = process.env.CHECKPOINT_CONTRACT ?? "0x4DF57190DEbe09D922D1AfE9458AfF439bcd2Cb1";
const EVERY = Number(process.env.CHECKPOINT_EVERY ?? 1000);
const INTERVAL_MIN = Number(process.env.CHECKPOINT_INTERVAL_MIN ?? 15);
const DRY = process.env.CHECKPOINT_DRY_RUN === "1";
const ONCE = process.argv.includes("--once");
const KEY = process.env.CHECKPOINT_PRIVATE_KEY;

const ABI = [
  "function publish(uint256 blockNumber, bytes32 stateHash)",
  "function latest() view returns (uint256 blockNumber, bytes32 stateHash)",
  "function owner() view returns (address)",
];

if (!KEY && !DRY) {
  console.error("Set CHECKPOINT_PRIVATE_KEY (the contract owner's key), or CHECKPOINT_DRY_RUN=1 to only compute the hash.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DB, max: 2 });
const network = Network.from(CHAIN_ID);
const provider = new JsonRpcProvider(RPC, network, { staticNetwork: network });
const wallet = KEY ? new Wallet(KEY, provider) : null;
const contract = new Contract(ADDRESS, ABI, wallet ?? provider);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (m: string) => console.log(`[checkpoint] ${m}`);

const query = (text: string, params?: unknown[]) => pool.query(text, params as any[]).then((r) => r.rows);

const deps: Deps = {
  src: dbSource(query),
  anchor: ethersAnchor(contract, wallet?.address ?? null, log),
  cursor: () => dbCursor(query),
  log, every: EVERY, dryRun: DRY, memo: null,
};

async function main() {
  log(`contract ${ADDRESS}, every ${EVERY} blocks, ${DRY ? "DRY RUN" : "publishing as " + wallet!.address}`);
  for (;;) {
    try {
      const r = await checkpointOnce(deps);
      if (r.status === "published") log(`PUBLISHED block ${r.block} hash ${r.hash} tx ${r.tx}`);
      else if (r.status === "dry-run") log(`dry run: would publish block ${r.block} hash ${r.hash}`);
      else log(`${r.status}: ${r.reason}`);
    } catch (e: any) {
      console.error("[checkpoint] failed:", String(e?.shortMessage ?? e?.message ?? e).slice(0, 300));
      if (ONCE) process.exit(1);
    }
    if (ONCE) break;
    await sleep(INTERVAL_MIN * 60_000);
  }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });

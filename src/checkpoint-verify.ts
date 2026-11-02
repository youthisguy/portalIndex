// "Verify now" endpoint for the home page: recompute the rolling state hash from the stored events and gaps,
// and compare it with the latest checkpoint on the contract. Reuses the same hashing code as the publisher.
// Wire into the registry as:  GET /checkpoint/verify
// Results are cached per checkpoint (CHECKPOINT_VERIFY_TTL_MIN, default 10) and concurrent requests share one run,
// because a full recompute reads every stored event.
import { computeRange, ZERO_HASH } from "./checkpoint-hash.js";
import { dbSource } from "./checkpoint-core.js";

type Query = (text: string, params?: unknown[]) => Promise<any[]>;

export interface VerifyResult {
  status: "match" | "mismatch" | "none" | "waiting";
  contract: string;
  block?: number;
  onchain?: string;
  computed?: string;
  steps?: number;
  note?: string;
  checkedAt: string;
  ms: number;
  cached?: boolean;
}

export interface VerifyOpts {
  contract?: string;
  rpc?: string;
  chainId?: number;
  ttlMs?: number;
  latest?: () => Promise<{ block: number; hash: string }>; // injectable for tests
  now?: () => number;
}

export function makeVerifier(query: Query, o: VerifyOpts = {}) {
  const contract = o.contract ?? process.env.CHECKPOINT_CONTRACT ?? "0x4DF57190DEbe09D922D1AfE9458AfF439bcd2Cb1";
  const rpc = o.rpc ?? process.env.EVM_RPC ?? "https://test-evm-rpc-v3.portaldot.dev";
  const chainId = o.chainId ?? Number(process.env.EVM_CHAIN_ID ?? 420420777);
  const ttl = o.ttlMs ?? Number(process.env.CHECKPOINT_VERIFY_TTL_MIN ?? 10) * 60_000;
  const now = o.now ?? Date.now;

  const latest = o.latest ?? (async () => {
    const { Contract, JsonRpcProvider, Network } = await import("ethers");
    const network = Network.from(chainId);
    const c = new Contract(contract, ["function latest() view returns (uint256 blockNumber, bytes32 stateHash)"],
      new JsonRpcProvider(rpc, network, { staticNetwork: network }));
    const [b, h] = await c.latest();
    return { block: Number(b), hash: String(h) };
  });

  let cache: { block: number; hash: string; at: number; result: VerifyResult } | null = null;
  let inflight: Promise<VerifyResult> | null = null;

  async function run(onchain: { block: number; hash: string }): Promise<VerifyResult> {
    const t0 = now();
    const base = { contract, checkedAt: new Date(t0).toISOString() };
    const r = await computeRange(dbSource(query), ZERO_HASH, 0, onchain.block);
    const ms = now() - t0;
    if (r.blocked) {
      return { ...base, ms, status: "waiting", block: onchain.block, onchain: onchain.hash,
        note: `A skipped block (${r.blocked.from_block}-${r.blocked.to_block}) is still waiting to be re-read, so the hash cannot be recomputed yet.` };
    }
    const match = r.hash.toLowerCase() === onchain.hash.toLowerCase();
    return { ...base, ms, status: match ? "match" : "mismatch", block: onchain.block, onchain: onchain.hash, computed: r.hash, steps: r.steps };
  }

  return async function verify(): Promise<VerifyResult> {
    const t0 = now();
    const onchain = await latest();
    if (onchain.block === 0) return { status: "none", contract, checkedAt: new Date(t0).toISOString(), ms: now() - t0, note: "No checkpoint has been published yet." };
    if (cache && cache.block === onchain.block && cache.hash === onchain.hash && now() - cache.at < ttl) return { ...cache.result, cached: true };
    if (!inflight) {
      inflight = run(onchain)
        .then((result) => { if (result.status !== "waiting") cache = { block: onchain.block, hash: onchain.hash, at: now(), result }; return result; })
        .finally(() => { inflight = null; });
    }
    return inflight;
  };
}

// Minimal HTTP handler (Node's http.ServerResponse). Open CORS so the home page can call it from another origin.
export async function sendVerify(verify: () => Promise<VerifyResult>, res: any) {
  res.setHeader("content-type", "application/json");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("cache-control", "no-store");
  try {
    res.end(JSON.stringify(await verify()));
  } catch (e: any) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "Could not run the check right now. " + String(e?.shortMessage ?? e?.message ?? e).slice(0, 120) }));
  }
}

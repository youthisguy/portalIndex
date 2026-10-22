import type { ApiPromise } from "@polkadot/api";

// Resolves ANY address, indexed or not, straight from the chain:
//  - an EVM address (0x + 40 hex) -> its native Portaldot account, via reviveApi.accountId
//  - a native address (5...)      -> its EVM address, via reviveApi.address
// plus the live native balance. An account the chain has never seen reads as 0, not "unknown".
export interface AddressInfo {
  input: string;
  h160: string;
  account: string;
  balance: { free: string; reserved: string; frozen: string };
  nonce: string;
  funded: boolean;
  source: "chain";
}

const cache = new Map<string, { at: number; value: AddressInfo }>();
const TTL_MS = 15_000;

export async function lookupAddress(api: ApiPromise, input: string): Promise<AddressInfo> {
  const q = input.trim();
  const hit = cache.get(q.toLowerCase());
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const a: any = api;
  let h160: string;
  let account: string;
  if (/^0x[0-9a-fA-F]{40}$/.test(q)) {
    h160 = q.toLowerCase();
    account = (await a.call.reviveApi.accountId(h160)).toString();
  } else {
    account = a.createType("AccountId32", q).toString(); // throws on an invalid address
    h160 = (await a.call.reviveApi.address(account)).toString().toLowerCase();
  }

  const info: any = await a.query.system.account(account);
  const free = info.data.free.toString();
  const reserved = info.data.reserved.toString();
  const frozen = info.data.frozen ? info.data.frozen.toString() : "0";
  const value: AddressInfo = {
    input: q,
    h160,
    account,
    balance: { free, reserved, frozen },
    nonce: info.nonce.toString(),
    funded: BigInt(free) + BigInt(reserved) > 0n,
    source: "chain",
  };
  cache.set(q.toLowerCase(), { at: Date.now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return value;
}

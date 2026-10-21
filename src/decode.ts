import { Interface, Indexed } from "ethers";

export function buildInterface(abi: unknown): Interface {
  return new Interface(abi as any);
}

// Keep only named, non-anonymous events (anonymous events have no topic0 to match on).
export function eventsOnly(iface: Interface): any[] {
  const out: any[] = [];
  iface.forEachEvent((f) => {
    if (!f.anonymous) out.push(JSON.parse(f.format("json")));
  });
  return out;
}

// bigint -> string (like u128 elsewhere); indexed dynamic types only exist as a hash in topics.
function plain(v: any): any {
  if (typeof v === "bigint") return v.toString();
  if (Indexed.isIndexed(v)) return { indexed_hash: v.hash };
  if (Array.isArray(v)) return v.map(plain);
  return v;
}

export function decodeLog(iface: Interface, topics: string[], data: string) {
  try {
    const log = iface.parseLog({ topics, data });
    if (!log) return null;
    const args: Record<string, unknown> = {};
    log.fragment.inputs.forEach((inp, i) => {
      args[inp.name || `arg${i}`] = plain(log.args[i]);
    });
    return { name: log.name, args };
  } catch {
    return null; // not in this ABI, or malformed
  }
}

// The events table is not stored per chain, so one database must only ever hold one chain.
// Returns the chain keys already in the database when this node is a different chain, otherwise null.
export function foreignChain(known: string[], chainKey: string): string[] | null {
  return known.length > 0 && !known.includes(chainKey) ? known : null;
}

// The node's head is far below where the indexer is: the endpoint now serves a different chain (or was reset).
// A running process cannot notice this by itself, so it should exit and be restarted to re-identify the chain.
export const nodeFarBehind = (head: number, next: number, margin = 1000) => head + margin < next;

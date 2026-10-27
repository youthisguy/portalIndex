// Builds the statement that records a block range the indexer could not read.
export function gapInsert(chainKey: string, from: number, to: number, reason: string) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) throw new Error(`invalid gap range ${from}-${to}`);
  return {
    text: "INSERT INTO indexer_gaps (chain_key, from_block, to_block, reason) VALUES ($1,$2,$3,$4)",
    values: [chainKey, from, to, reason.slice(0, 300)],
  };
}

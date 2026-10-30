// EVM transactions on Portaldot V3 (pallet-revive): every Ethereum transaction travels inside a
// `revive.ethTransact` extrinsic whose payload is the raw signed Ethereum transaction (RLP bytes).
// The Ethereum transaction hash is therefore keccak256(payload). Verify with scripts/tx-check.ts.
import { Transaction, keccak256 } from "ethers";

export interface EvmTx {
  hash: string;
  extrinsicIndex: number;
  from: string | null;
  to: string | null; // null = contract creation
  value: string | null; // raw integer as a string, never a JS number
  nonce: number | null;
  type: number | null;
  selector: string | null; // first 4 bytes of calldata
  inputBytes: number | null;
  success: boolean | null;
}

export function extractEvmTxs(extrinsics: any[], success: Map<number, boolean> = new Map()): EvmTx[] {
  const out: EvmTx[] = [];
  extrinsics.forEach((ext, i) => {
    const m = ext?.method;
    if (m?.section !== "revive" || m?.method !== "ethTransact") return;
    const payload = String(m.args?.[0]?.toHex?.() ?? "");
    if (!/^0x([0-9a-fA-F]{2})+$/.test(payload)) return;
    const tx: EvmTx = {
      hash: keccak256(payload).toLowerCase(), extrinsicIndex: i,
      from: null, to: null, value: null, nonce: null, type: null, selector: null, inputBytes: null,
      success: success.has(i) ? success.get(i)! : null,
    };
    try { // the hash stays valid even if the fields cannot be decoded
      const t = Transaction.from(payload);
      tx.from = t.from ? t.from.toLowerCase() : null;
      tx.to = t.to ? t.to.toLowerCase() : null;
      tx.value = t.value.toString();
      tx.nonce = Number(t.nonce);
      tx.type = t.type;
      tx.selector = t.data.length >= 10 ? t.data.slice(0, 10) : null;
      tx.inputBytes = (t.data.length - 2) / 2;
    } catch { /* keep the hash only */ }
    out.push(tx);
  });
  return out;
}

export const EVM_TX_INSERT =
  `INSERT INTO evm_transactions (tx_hash, block_number, extrinsic_index, block_hash, block_time, from_addr, to_addr, value, nonce, tx_type, selector, input_bytes, success)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (tx_hash) DO NOTHING`;

export const evmTxValues = (t: EvmTx, block: number, blockHash: string, blockTime: Date | null) =>
  [t.hash, block, t.extrinsicIndex, blockHash, blockTime, t.from, t.to, t.value, t.nonce, t.type, t.selector, t.inputBytes, t.success];

import { describe, it, expect } from "vitest";
import { Wallet, Transaction, keccak256 } from "ethers";
import { extractEvmTxs } from "../../src/evm-tx";

const key = "0x" + "11".repeat(32);
const wallet = new Wallet(key);
const TO = "0x6a5cce928e49c5062acd7aa876335a8041c7adc9";
const ext = (section: string, method: string, payload: string) => ({ method: { section, method, args: [{ toHex: () => payload }] } });

describe("EVM transaction hashes", () => {
  it("derives the Ethereum hash, sender and fields of an EIP-1559 transaction", async () => {
    const raw = await wallet.signTransaction({ type: 2, chainId: 420420777, nonce: 7, to: TO, value: 5n, gasLimit: 21000n, maxFeePerGas: 10n, maxPriorityFeePerGas: 1n, data: "0xa9059cbb00" });
    const [t] = extractEvmTxs([{ method: { section: "timestamp", method: "set", args: [] } }, ext("revive", "ethTransact", raw)]);
    expect(t.hash).toBe(Transaction.from(raw).hash);
    expect(t.extrinsicIndex).toBe(1);
    expect(t.from).toBe(wallet.address.toLowerCase());
    expect(t.to).toBe(TO);
    expect([t.value, t.nonce, t.type, t.selector, t.inputBytes]).toEqual(["5", 7, 2, "0xa9059cbb", 5]);
  });
  it("handles a legacy transaction and a contract creation", async () => {
    const raw = await wallet.signTransaction({ type: 0, chainId: 420420777, nonce: 0, value: 0n, gasLimit: 100000n, gasPrice: 1n, data: "0x6080" });
    const [t] = extractEvmTxs([ext("revive", "ethTransact", raw)]);
    expect(t.hash).toBe(keccak256(raw));
    expect(t.to).toBeNull();
  });
  it("keeps the hash but nulls the fields when the payload cannot be decoded", () => {
    const [t] = extractEvmTxs([ext("revive", "ethTransact", "0xdeadbeef")]);
    expect(t.hash).toBe(keccak256("0xdeadbeef"));
    expect([t.from, t.to, t.value]).toEqual([null, null, null]);
  });
  it("ignores other extrinsics and records success per extrinsic index", async () => {
    const raw = await wallet.signTransaction({ type: 2, chainId: 1, nonce: 1, to: TO, gasLimit: 21000n, maxFeePerGas: 1n, maxPriorityFeePerGas: 1n });
    const txs = extractEvmTxs([ext("balances", "transferKeepAlive", raw), ext("revive", "ethTransact", raw)], new Map([[1, false]]));
    expect(txs).toHaveLength(1);
    expect(txs[0].success).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { Interface } from "ethers";
import { buildInterface, decodeLog, eventsOnly } from "../../src/decode";

const ABI = [
  { type: "function", name: "mint", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { type: "event", name: "Transfer", anonymous: false, inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "value", type: "uint256", indexed: false }] },
];
const FROM = "0x378598779d64d4c0ee191dbb98a487535e2b7048";
const TO = "0x6a5cce928e49c5062acd7aa876335a8041c7adc9";

describe("contract event decoding", () => {
  it("keeps only events from a full ABI", () => {
    const events = eventsOnly(buildInterface(ABI));
    expect(events).toHaveLength(1);
    expect((events[0] as any).name).toBe("Transfer");
  });
  it("decodes a Transfer log into named arguments", () => {
    const enc = new Interface(ABI).encodeEventLog("Transfer", [FROM, TO, 1000n]);
    const d: any = decodeLog(buildInterface(ABI), enc.topics as string[], enc.data);
    expect(d.name).toBe("Transfer");
    expect(String(d.args.value)).toBe("1000");
    expect(String(d.args.from).toLowerCase()).toBe(FROM);
    expect(String(d.args.to).toLowerCase()).toBe(TO);
  });
  it("returns nothing for a log the ABI does not describe", () => {
    expect(decodeLog(buildInterface(ABI), ["0x" + "11".repeat(32)], "0x")).toBeFalsy();
  });
});

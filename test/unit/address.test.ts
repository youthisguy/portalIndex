import { describe, it, expect } from "vitest";
import { decodeAddress } from "@polkadot/util-crypto";
import { u8aToHex } from "@polkadot/util";
import { lookupAddress } from "../../src/address-lookup";

const s = (v: string) => ({ toString: () => v });
const chain = (balances: Record<string, string>): any => ({
  call: { reviveApi: {
    accountId: async (h: string) => s("5Native" + h.slice(2, 8)),
    address: async () => s("0xAbCdEf0123456789aBcDeF0123456789AbCdEf01"),
  } },
  createType: (_t: string, v: string) => { if (!/^5/.test(v)) throw new Error("bad address"); return s(v); },
  query: { system: { account: async (a: string) => ({
    nonce: s("0"),
    data: { free: s(balances[a] ?? "0"), reserved: s("0"), frozen: s("0") },
  }) } },
});

describe("H160 <-> native mapping (known vector from the live chain, 2026-10-17)", () => {
  it("an unmapped EVM address maps to its 20 bytes followed by twelve 0xEE bytes", () => {
    const key = u8aToHex(decodeAddress("5Dm4Yz9Znw6qKqpVdZSVxPVm3JzXG6MNsfpz5h2qqNWw2cuV"));
    expect(key).toBe("0x4b03b733df0da1999e5435b126436988094604fd" + "ee".repeat(12));
  });
});

describe("live address lookup", () => {
  it("resolves an EVM address and reports 0 for an account the chain has never seen", async () => {
    const r = await lookupAddress(chain({}), "0x4B03B733DF0DA1999E5435B126436988094604FD");
    expect(r.h160).toBe("0x4b03b733df0da1999e5435b126436988094604fd");
    expect(r.account).toBe("5Native4b03b7");
    expect(r.balance.free).toBe("0");
    expect(r.funded).toBe(false);
  });
  it("resolves a native address to its EVM address and reads a large balance exactly", async () => {
    const r = await lookupAddress(chain({ "5Funded": "15000000000000000000" }), "5Funded");
    expect(r.h160).toBe("0xabcdef0123456789abcdef0123456789abcdef01");
    expect(r.balance.free).toBe("15000000000000000000");
    expect(r.funded).toBe(true);
  });
  it("rejects input that is not an address", async () => {
    await expect(lookupAddress(chain({}), "not-an-address")).rejects.toThrow();
  });
});

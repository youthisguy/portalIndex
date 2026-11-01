import { describe, it, expect } from "vitest";
import { foreignChain } from "../../src/chain-guard";

const A = "0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd";
const B = "0x6e7f1f24628d2fa3a1ac81a8b45157c63b1037fee4123a7664aae2c55cdbbc36";

describe("one database, one chain", () => {
  it("allows a fresh database", () => expect(foreignChain([], A)).toBeNull());
  it("allows the chain the database already holds", () => expect(foreignChain([A], A)).toBeNull());
  it("refuses a different chain and reports what the database holds", () => expect(foreignChain([A], B)).toEqual([A]));
  it("refuses even when one of several stored chains matches nothing", () => expect(foreignChain([A, B], "0xother")).toEqual([A, B]));
});

import { nodeFarBehind } from "../../src/chain-guard";

describe("endpoint switched chains while running", () => {
  it("flags a node whose head is far below the next block to index (the 877,859 vs 274,971 case)", () => expect(nodeFarBehind(274971, 877859)).toBe(true));
  it("does not flag normal operation", () => {
    expect(nodeFarBehind(275000, 275001)).toBe(false);
    expect(nodeFarBehind(275000, 275000)).toBe(false);
  });
  it("tolerates a node that is briefly a little behind", () => expect(nodeFarBehind(274500, 275001)).toBe(false));
});

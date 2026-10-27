import { describe, it, expect } from "vitest";
import { isTransient, isPruned } from "../../src/errors";
import { gapInsert } from "../../src/gaps";

describe("error classification (from real incidents)", () => {
  it("treats a dropped websocket as transient, never as a bad block", () => {
    const m = "disconnected from wss://test-node-v3.portaldot.dev: 1006:: Abnormal Closure";
    expect(isTransient(m)).toBe(true);
    expect(isPruned(m)).toBe(false);
  });
  it("treats discarded state as a gap", () => {
    expect(isPruned("4003: Client error: Api called for an unknown Block: State already discarded for 0xabc")).toBe(true);
    expect(isTransient("State already discarded for 0xabc")).toBe(false);
  });
  it("does not misclassify a decode bug", () => {
    const m = "TypeError: v.unwrap is not a function";
    expect(isTransient(m)).toBe(false);
    expect(isPruned(m)).toBe(false);
  });
});

describe("gap recording", () => {
  it("builds the insert for a range", () => {
    const q = gapInsert("0xchain", 50001, 71181, "state pruned by node");
    expect(q.text).toContain("INSERT INTO indexer_gaps");
    expect(q.values).toEqual(["0xchain", 50001, 71181, "state pruned by node"]);
  });
  it("accepts a single-block gap", () => {
    expect(gapInsert("c", 107052, 107052, "processing error").values.slice(1, 3)).toEqual([107052, 107052]);
  });
  it("rejects an inverted range", () => {
    expect(() => gapInsert("c", 10, 5, "x")).toThrow(/invalid gap range/);
  });
  it("caps the reason length", () => {
    expect(gapInsert("c", 1, 2, "x".repeat(1000)).values[3]).toHaveLength(300);
  });
});

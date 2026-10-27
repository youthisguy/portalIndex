import { describe, it, expect } from "vitest";
import { snake, kindOf, convert, buildEventMap, insertTyped } from "../../src/typed";

const s = (v: string) => ({ toString: () => v });
const field = (name: string | null, type: number) => ({
  name: name ? { isSome: true, unwrap: () => s(name) } : { isSome: false },
  type,
});
const fakeApi = (events: any, types: Record<number, string>): any => ({
  events,
  registry: { lookup: { getTypeDef: (t: number) => ({ type: types[t] }) } },
});

describe("snake / kindOf", () => {
  it("snake-cases pallet and event names", () => {
    expect(snake("assetConversion")).toBe("asset_conversion");
    expect(snake("ExtrinsicSuccess")).toBe("extrinsic_success");
    expect(snake("a-b c")).toBe("a_b_c");
  });
  it.each([
    ["u128", "numeric"], ["u64", "numeric"], ["u32", "bigint"], ["u8", "integer"], ["bool", "boolean"],
    ["AccountId32", "text"], ["H160", "text"], ["Bytes", "text"],
    ["Option<u128>", "numeric"], ["Compact<u32>", "bigint"], ["Vec<u32>", "jsonb"], ["PalletStakingRewardDestination", "jsonb"],
  ])("maps %s to %s", (t, k) => expect(kindOf(t)).toBe(k));
});

describe("convert", () => {
  it("keeps u128 exact as a string", () => {
    const max = "340282366920938463463374607431768211455";
    expect(convert(s(max), "numeric")).toBe(max);
  });
  it("turns an empty Option into null and unwraps a present one", () => {
    expect(convert({ isNone: true, unwrap: () => { throw new Error("no"); } }, "numeric")).toBeNull();
    expect(convert({ isNone: false, unwrap: () => s("42") }, "numeric")).toBe("42");
  });
  it("does not unwrap an enum that merely has a None variant (staking RewardDestination regression)", () => {
    const rewardDestNone = { isNone: true, toJSON: () => "none" };
    expect(convert(rewardDestNone, "jsonb")).toBe('"none"');
  });
  it("reads bytes as hex and booleans as booleans", () => {
    expect(convert({ toRawType: () => "Bytes", toHex: () => "0xdead" }, "text")).toBe("0xdead");
    expect(convert({ isTrue: true }, "boolean")).toBe(true);
  });
});

describe("table generation from metadata", () => {
  const api = fakeApi(
    {
      balances: { Transfer: { meta: { fields: [field("from", 1), field("to", 1), field("amount", 2)] } } },
      assets: { MetadataSet: { meta: { fields: [field("asset_id", 3), field("block_number", 3), field(null, 4)] } } },
      system: { ExtrinsicSuccess: { meta: { fields: [] } } },
    },
    { 1: "AccountId32", 2: "u128", 3: "u32", 4: "Bytes" }
  );

  it("creates one table per event with typed columns", () => {
    const map = buildEventMap(api, ["balances"]);
    const t = map.get("balances.Transfer")!;
    expect(t.table).toBe("balances_transfer");
    expect(t.cols.map((c) => [c.name, c.kind])).toEqual([["from", "text"], ["to", "text"], ["amount", "numeric"]]);
    expect(t.cols[0].account).toBe(true);
    expect(t.cols[2].account).toBe(false);
  });
  it("only generates tables for the pallets you ask for", () => {
    expect([...buildEventMap(api, ["balances"]).keys()]).toEqual(["balances.Transfer"]);
    expect(buildEventMap(api, "*").size).toBe(3);
  });
  it("quotes identifiers and is idempotent on conflict", () => {
    const sql = buildEventMap(api, ["balances"]).get("balances.Transfer")!.insertSql;
    expect(sql).toContain('INSERT INTO "balances_transfer"');
    expect(sql).toContain('"from"');
    expect(sql).toContain("ON CONFLICT (block_number, event_index) DO NOTHING");
  });
  it("renames fields that collide with built-in columns and names unnamed fields", () => {
    const cols = buildEventMap(api, ["assets"]).get("assets.MetadataSet")!.cols.map((c) => c.name);
    expect(cols).toEqual(["asset_id", "block_number_f", "f2"]);
  });
  it("supports events with no fields", () => {
    expect(buildEventMap(api, ["system"]).get("system.ExtrinsicSuccess")!.cols).toEqual([]);
  });
});

describe("event to row", () => {
  it("writes a typed row and records every account touched", async () => {
    const api = fakeApi({ balances: { Transfer: { meta: { fields: [field("from", 1), field("to", 1), field("amount", 2)] } } } }, { 1: "AccountId32", 2: "u128" });
    const map = buildEventMap(api, ["balances"]);
    const calls: { text: string; values: unknown[] }[] = [];
    const client: any = { query: async (text: string, values: unknown[]) => { calls.push({ text, values }); } };
    const event = { section: "balances", method: "Transfer", data: [s("5Alice"), s("5Bob"), s("15000000000000000000")] };

    const accounts = await insertTyped(client, map, event, 106954, 4, "0xhash", 1, new Date("2026-10-19T19:13:36Z"));

    expect(calls[0].text).toContain('INSERT INTO "balances_transfer"');
    expect(calls[0].values.slice(0, 5)).toEqual([106954, 4, "0xhash", 1, new Date("2026-10-19T19:13:36Z")]);
    expect(calls[0].values.slice(5)).toEqual(["5Alice", "5Bob", "15000000000000000000"]);
    expect(accounts.sort()).toEqual(["5Alice", "5Bob"]);
    expect(calls.filter((c) => c.text.includes("account_events"))).toHaveLength(2);
  });
  it("ignores events it has no table for", async () => {
    const client: any = { query: async () => { throw new Error("should not be called"); } };
    expect(await insertTyped(client, new Map(), { section: "x", method: "Y", data: [] }, 1, 0, "0x", null, new Date())).toEqual([]);
  });
});

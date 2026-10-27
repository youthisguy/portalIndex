// Smoke tests against a running API. Run with: npm run test:live
// Point it elsewhere with API=http://localhost:10000 npm run test:live
import { describe, it, expect } from "vitest";

const API = (process.env.API ?? "https://portalindex-98f0.onrender.com").replace(/\/$/, "");
const get = async (path: string) => {
  const r = await fetch(API + path);
  expect(r.ok, `${path} returned HTTP ${r.status}`).toBe(true);
  return r.json();
};

describe("hosted API response shape", () => {
  it("indexer_cursor has a block number and a recent timestamp", async () => {
    const [row] = await get("/indexer_cursor");
    expect(typeof row.last_block).toBe("number");
    expect(Date.now() - new Date(row.updated_at).getTime()).toBeLessThan(15 * 60 * 1000);
  });
  it("events rows carry block, pallet, name and JSON data", async () => {
    const [row] = await get("/events?limit=1");
    expect(row).toMatchObject({ block_number: expect.any(Number), event_index: expect.any(Number), pallet: expect.any(String), name: expect.any(String) });
    expect(typeof row.data).toBe("object");
  });
  it("indexer_gaps is a list", async () => {
    expect(Array.isArray(await get("/indexer_gaps"))).toBe(true);
  });
  it("the checkpoint contract deployment was indexed", async () => {
    const rows = await get("/revive_instantiated?contract=eq.0x6a5cce928e49c5062acd7aa876335a8041c7adc9");
    expect(rows[0]).toMatchObject({ block_number: 135953, deployer: "0x378598779d64d4c0ee191dbb98a487535e2b7048" });
  });
  it("unknown contract slugs return 404", async () => {
    const r = await fetch(API + "/c/does-not-exist-000000");
    expect(r.status).toBe(404);
  });
});

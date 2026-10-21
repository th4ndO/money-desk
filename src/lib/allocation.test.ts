import { describe, expect, it } from "vitest";
import { parseAllocationForm, readyToAllocate } from "./allocation";

const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b2";

describe("readyToAllocate", () => {
  it("is income minus what has been allocated", () => {
    expect(readyToAllocate([{ amount_cents: 850000 }, { amount_cents: 300000 }], [{ amount_cents: 50000 }])).toBe(1100000);
    expect(readyToAllocate([], [])).toBe(0);
  });
});

describe("parseAllocationForm", () => {
  it("collects non-blank amounts for items and pots", () => {
    const r = parseAllocationForm(
      [["item:" + A, "500"], ["pot:" + B, "1 000,50"], ["item:" + B, ""], ["note", "hello"]],
      1_000_000,
    );
    expect(r).toEqual({
      ok: true,
      rows: [{ cycle_item_id: A, amount_cents: 50000 }, { reserve_id: B, amount_cents: 100050 }],
      total: 150050,
    });
  });

  it("reads pocket funding for a cycle", () => {
    expect(parseAllocationForm([["fund:" + A, "500"]], 50000)).toEqual({
      ok: true,
      rows: [{ cycle_id: A, amount_cents: 50000 }],
      total: 50000,
    });
  });

  it("refuses more than is ready", () => {
    expect(parseAllocationForm([["item:" + A, "500"]], 49999)).toEqual({ ok: false, message: "That's more than you have ready to allocate." });
  });

  it("allows exactly what is ready", () => {
    expect(parseAllocationForm([["item:" + A, "500"]], 50000).ok).toBe(true);
  });

  it("needs at least one amount and rejects nonsense", () => {
    expect(parseAllocationForm([["item:" + A, ""]], 100).ok).toBe(false);
    expect(parseAllocationForm([["item:" + A, "abc"]], 100)).toMatchObject({ ok: false });
    expect(parseAllocationForm([["item:not-a-uuid", "5"]], 10000)).toMatchObject({ ok: false });
  });
});

import { describe, expect, it } from "vitest";
import { affordable, openWishes } from "./wishlist";

const w = (id: string, price: number, priority: 1 | 2 | 3, bought: string | null = null) => ({
  id, price_cents: price, priority, bought_on: bought, sort_order: 0,
});

describe("wish list", () => {
  const items = [w("tablet", 600000, 2), w("shoes", 90000, 1), w("lamp", 40000, 3), w("bag", 50000, 1), w("old", 1000, 1, "2026-10-01")];

  it("orders open items by priority, then price, leaving out bought ones", () => {
    expect(openWishes(items).map((i) => i.id)).toEqual(["bag", "shoes", "tablet", "lamp"]);
  });

  it("covers what fits in priority order and skips what doesn't", () => {
    const r = affordable(items, 165600);
    expect(r.covered.map((i) => i.id)).toEqual(["bag", "shoes"]);
    expect(r.left).toBe(25600);
  });

  it("skips a big item but still fits a smaller, lower-priority one", () => {
    expect(affordable(items, 190000).covered.map((i) => i.id)).toEqual(["bag", "shoes", "lamp"]);
  });

  it("covers nothing with no budget", () => {
    expect(affordable(items, -500)).toEqual({ covered: [], left: 0 });
  });
});

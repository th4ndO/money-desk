import { describe, expect, it } from "vitest";
import { reviewCycle } from "./review";
import type { CycleItemRow } from "./types";

function ci(o: Partial<CycleItemRow>): CycleItemRow {
  return {
    id: o.name ?? "x",
    cycle_id: "c",
    recurring_item_id: null,
    name: "x",
    kind: "bill",
    category: null,
    planned_cents: 0,
    due_date: null,
    paid: false,
    paid_on: null,
    actual_cents: null,
    sort_order: 0,
    ...o,
  };
}

describe("reviewCycle", () => {
  const items = [
    ci({ name: "Netflix", planned_cents: 22900, paid: true, actual_cents: 24900 }),
    ci({ name: "Canva", planned_cents: 11000, paid: true, actual_cents: 11000 }),
    ci({ name: "Water", planned_cents: 100000 }),
    ci({ name: "Groceries", kind: "envelope", planned_cents: 136200 }),
  ];
  const r = reviewCycle(974500, items, [
    { cycle_item_id: "Groceries", amount_cents: 120000 },
    { cycle_item_id: null, amount_cents: 3000 },
  ]);

  it("compares planned and actual per item", () => {
    expect(r.lines.map((l) => [l.name, l.planned, l.actual, l.difference])).toEqual([
      ["Netflix", 22900, 24900, 2000],
      ["Canva", 11000, 11000, 0],
      ["Water", 100000, 0, -100000],
      ["Groceries", 136200, 120000, -16200],
      ["Unplanned spending", 0, 3000, 3000],
    ]);
  });

  it("flags bills that were never ticked", () => {
    expect(r.lines.find((l) => l.name === "Water")?.note).toBe("Not ticked as paid");
    expect(r.lines.find((l) => l.name === "Netflix")?.note).toBeUndefined();
  });

  it("totals over/under and what was left of the pocket", () => {
    expect(r.planned).toBe(270100);
    expect(r.actual).toBe(158900);
    expect(r.difference).toBe(158900 - 270100);
    expect(r.leftOver).toBe(974500 - 158900);
  });
});

import { describe, expect, it } from "vitest";
import { cycleStatus, daysLeftInCycle, summariseCycle } from "./summary";
import type { CycleItemRow } from "./types";

const cycle = { start_date: "2026-10-23", end_date: "2026-11-22", pocket_cents: 974500, closed_at: null };

let n = 0;
function ci(overrides: Partial<CycleItemRow>): CycleItemRow {
  n += 1;
  return {
    id: `i${n}`,
    cycle_id: "c",
    recurring_item_id: null,
    name: `Item ${n}`,
    kind: "bill",
    category: null,
    planned_cents: 10000,
    due_date: "2026-10-25",
    paid: false,
    paid_on: null,
    actual_cents: null,
    sort_order: 0,
    ...overrides,
  };
}

describe("cycleStatus", () => {
  it("derives the status from dates and closed_at", () => {
    expect(cycleStatus(cycle, "2026-10-22")).toBe("planned");
    expect(cycleStatus(cycle, "2026-10-23")).toBe("active");
    expect(cycleStatus(cycle, "2026-11-22")).toBe("active");
    expect(cycleStatus(cycle, "2026-11-23")).toBe("ended");
    expect(cycleStatus({ ...cycle, closed_at: "2026-11-23T08:00:00Z" }, "2026-11-01")).toBe("closed");
  });
});

describe("daysLeftInCycle", () => {
  it("counts today, is the full length before the start, and 0 after the end", () => {
    expect(daysLeftInCycle(cycle, "2026-11-22")).toBe(1);
    expect(daysLeftInCycle(cycle, "2026-11-13")).toBe(10);
    expect(daysLeftInCycle(cycle, "2026-10-01")).toBe(31);
    expect(daysLeftInCycle(cycle, "2026-11-23")).toBe(0);
  });
});

describe("summariseCycle", () => {
  const rent = ci({ name: "Debt", planned_cents: 158500, paid: true, actual_cents: 158500, due_date: "2026-10-23" });
  const netflix = ci({ name: "Netflix", planned_cents: 22900, paid: true, actual_cents: 24900, due_date: "2026-10-27" });
  const rain = ci({ name: "Rain", planned_cents: 67900, due_date: "2026-11-03" });
  const water = ci({ name: "Water", planned_cents: 100000, due_date: "2026-11-01" });
  const icloud = ci({ name: "iCloud", planned_cents: 20000, due_date: "2026-11-14" });
  const savings = ci({ name: "Savings", kind: "saving", planned_cents: 100000, paid: true, actual_cents: 100000 });
  const groceries = ci({ name: "Groceries", kind: "envelope", planned_cents: 136200, due_date: null });
  const transport = ci({ name: "Transport", kind: "envelope", planned_cents: 100000, due_date: null });
  const items = [rent, netflix, rain, water, icloud, savings, groceries, transport];
  const txs = [
    { cycle_item_id: groceries.id, amount_cents: 45000 },
    { cycle_item_id: groceries.id, amount_cents: 15000 },
    { cycle_item_id: transport.id, amount_cents: 20000 },
    { cycle_item_id: null, amount_cents: 5000 },
  ];

  const s = summariseCycle(cycle, items, txs, "2026-11-13");

  it("counts paid bills at their actual amount plus all spending", () => {
    expect(s.billsPaid).toBe(158500 + 24900 + 100000);
    expect(s.spent).toBe(158500 + 24900 + 100000 + 45000 + 15000 + 20000 + 5000);
    expect(s.left).toBe(974500 - s.spent);
  });

  it("sums unpaid bills at their planned amount", () => {
    expect(s.billsDue).toBe(67900 + 100000 + 20000);
    expect(s.billsPaidCount).toBe(3);
    expect(s.billsCount).toBe(6);
  });

  it("tracks envelopes and unplanned spending separately", () => {
    expect(s.envelopes).toEqual([
      { id: groceries.id, name: "Groceries", planned: 136200, spent: 60000, lent: 0, repaidFromEarlier: 0, remaining: 76200 },
      { id: transport.id, name: "Transport", planned: 100000, spent: 20000, lent: 0, repaidFromEarlier: 0, remaining: 80000 },
    ]);
    expect(s.unplannedSpent).toBe(5000);
    expect(s.envelopeRemaining).toBe(156200);
  });

  it("divides envelope money by days left including today, in whole cents", () => {
    expect(s.daysLeft).toBe(10);
    expect(s.safePerDay).toBe(15620);
    const odd = summariseCycle(cycle, [ci({ kind: "envelope", planned_cents: 10000, due_date: null })], [], "2026-11-20");
    expect(odd.safePerDay).toBe(3333);
  });

  it("lists the next three unpaid bills by due date", () => {
    expect(s.nextBills.map((b) => b.name)).toEqual(["Water", "Rain", "iCloud"]);
  });

  it("is on track when nothing is wrong", () => {
    expect(s.health).toBe("On track");
  });

  it("flags an envelope that went negative, and shows zero safe per day", () => {
    const over = summariseCycle(cycle, [groceries], [{ cycle_item_id: groceries.id, amount_cents: 150000 }], "2026-11-13");
    expect(over.envelopes[0].remaining).toBe(-13800);
    expect(over.health).toBe("Envelopes over");
    expect(over.safePerDay).toBe(0);
  });

  it("flags a plan bigger than the pocket", () => {
    expect(summariseCycle({ ...cycle, pocket_cents: 100 }, [ci({ planned_cents: 200 })], [], "2026-11-13").health).toBe(
      "Plan exceeds pocket",
    );
  });

  it("puts overspent above everything else", () => {
    const o = summariseCycle(
      { ...cycle, pocket_cents: 1000 },
      [groceries],
      [{ cycle_item_id: groceries.id, amount_cents: 200000 }],
      "2026-11-13",
    );
    expect(o.left).toBeLessThan(0);
    expect(o.health).toBe("Overspent");
  });

  it("gives zero safe per day after the cycle ends", () => {
    expect(summariseCycle(cycle, items, txs, "2026-11-23").safePerDay).toBe(0);
  });
});

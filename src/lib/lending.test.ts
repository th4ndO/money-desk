import { describe, expect, it } from "vitest";
import { openLoans, loansWithRepayments } from "./loans";
import { reviewCycle } from "./review";
import { envelopeFlows, summariseCycle } from "./summary";
import type { CycleItemRow } from "./types";

const cycle = { start_date: "2026-10-23", end_date: "2026-11-22", pocket_cents: 100000, closed_at: null };
const personal: CycleItemRow = {
  id: "personal", cycle_id: "nov", recurring_item_id: null, name: "Personal", kind: "envelope",
  category: null, planned_cents: 100000, due_date: null, paid: false, paid_on: null, actual_cents: null, sort_order: 0,
};
const base = { cycle_id: "nov", cycle_item_id: "personal", note: null, date: "2026-10-24" };

describe("envelope flows", () => {
  it("counts a loan as out, but not as spent", () => {
    const f = envelopeFlows([{ ...base, id: "l1", kind: "lend", amount_cents: 30000 }]);
    expect(f).toEqual({ spent: 0, lent: 30000, repaidFromEarlier: 0, net: 30000 });
  });

  it("a repaid loan leaves nothing spent and nothing lent", () => {
    const f = envelopeFlows([
      { ...base, id: "l1", kind: "lend", amount_cents: 30000 },
      { ...base, id: "r1", kind: "refund", repays_id: "l1", amount_cents: 30000 },
    ]);
    expect(f).toEqual({ spent: 0, lent: 0, repaidFromEarlier: 0, net: 0 });
  });

  it("a shop refund reduces spent", () => {
    const f = envelopeFlows([
      { ...base, id: "s1", kind: "spend", amount_cents: 50000 },
      { ...base, id: "r1", kind: "refund", amount_cents: 20000 },
    ]);
    expect(f.spent).toBe(30000);
    expect(f.net).toBe(30000);
  });

  it("a repayment of a loan from another cycle shows as repaid from earlier", () => {
    const f = envelopeFlows([{ ...base, id: "r1", kind: "refund", repays_id: "old-loan", amount_cents: 20000 }]);
    expect(f).toEqual({ spent: 0, lent: 0, repaidFromEarlier: 20000, net: -20000 });
  });

  it("treats entries without a kind as spending (older rows)", () => {
    expect(envelopeFlows([{ ...base, amount_cents: 100 }]).spent).toBe(100);
  });
});

describe("cycle summary with lending", () => {
  it("lend R300 then get it back: Personal is whole again and nothing is spent", () => {
    const lent = summariseCycle(cycle, [personal], [{ ...base, id: "l1", kind: "lend", amount_cents: 30000 }], "2026-11-01");
    expect(lent.envelopes[0]).toMatchObject({ spent: 0, lent: 30000, remaining: 70000 });
    expect(lent.left).toBe(70000);

    const back = summariseCycle(
      cycle,
      [personal],
      [
        { ...base, id: "l1", kind: "lend", amount_cents: 30000 },
        { ...base, id: "r1", kind: "refund", repays_id: "l1", amount_cents: 30000 },
      ],
      "2026-11-01",
    );
    expect(back.envelopes[0]).toMatchObject({ spent: 0, lent: 0, remaining: 100000 });
    expect(back.spent).toBe(0);
    expect(back.left).toBe(100000);
  });

  it("partly repaid: only the rest is still lent", () => {
    const s = summariseCycle(
      cycle,
      [personal],
      [
        { ...base, id: "l1", kind: "lend", amount_cents: 45000 },
        { ...base, id: "r1", kind: "refund", repays_id: "l1", amount_cents: 20000 },
      ],
      "2026-11-01",
    );
    expect(s.envelopes[0]).toMatchObject({ lent: 25000, remaining: 75000 });
  });
});

describe("review with lending", () => {
  it("counts the net out of the envelope", () => {
    const r = reviewCycle(100000, [personal], [
      { ...base, id: "s1", kind: "spend", amount_cents: 10000 },
      { ...base, id: "l1", kind: "lend", amount_cents: 30000 },
      { ...base, id: "r1", kind: "refund", repays_id: "l1", amount_cents: 30000 },
    ]);
    expect(r.lines[0].actual).toBe(10000);
  });
});

describe("open loans", () => {
  const entries = [
    { ...base, id: "l1", kind: "lend", counterparty: "Phathu", amount_cents: 45000 },
    { ...base, id: "l2", kind: "lend", counterparty: "Thabo", amount_cents: 30000, date: "2026-10-25" },
    { ...base, cycle_id: "dec", id: "r1", kind: "refund", repays_id: "l1", amount_cents: 45000, date: "2026-11-30" },
    { ...base, id: "r2", kind: "refund", repays_id: "l2", amount_cents: 10000 },
  ];

  it("tracks repayments across cycles", () => {
    expect(loansWithRepayments(entries).map((l) => [l.counterparty, l.repaid, l.outstanding])).toEqual([
      ["Phathu", 45000, 0],
      ["Thabo", 10000, 20000],
    ]);
  });

  it("lists only what's still owed", () => {
    expect(openLoans(entries).map((l) => [l.counterparty, l.outstanding])).toEqual([["Thabo", 20000]]);
  });
});

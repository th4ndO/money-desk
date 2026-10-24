import { describe, expect, it } from "vitest";
import { HISTORY_FILTERS, buildHistory, signedAmount } from "./history";

const src = {
  income: [{ id: "i1", amount_cents: 120000, date: "2026-10-22", source: "ZA Maid", notes: null, created_at: "2026-10-22T10:00:00Z" }],
  allocations: [
    { id: "a1", amount_cents: 50000, date: "2026-10-22", note: "PP", cycle_item_id: null, reserve_id: null, cycle_id: "nov", created_at: "2026-10-22T10:05:00Z" },
    { id: "a2", amount_cents: 20000, date: "2026-10-23", note: null, cycle_item_id: "personal", reserve_id: null, cycle_id: null },
  ],
  transactions: [
    { id: "t1", amount_cents: 45000, date: "2026-10-24", note: null, kind: "lend", counterparty: "Phathu", cycle_id: "nov", cycle_item_id: "personal", created_at: "2026-10-24T08:00:00Z" },
    { id: "t2", amount_cents: 45000, date: "2026-10-24", note: null, kind: "refund", counterparty: "Phathu", repays_id: "t1", cycle_id: "nov", cycle_item_id: "personal", created_at: "2026-10-24T09:00:00Z" },
    { id: "t3", amount_cents: 7000, date: "2026-10-23", note: "Airtime", cycle_id: "nov", cycle_item_id: "personal" },
  ],
  paidBills: [{ id: "b1", name: "Debt review", paid_on: "2026-10-23", actual_cents: 158500, planned_cents: 158500, cycle_id: "nov" }],
  itemNames: new Map([["personal", { name: "Personal", cycleId: "nov" }]]),
  reserveNames: new Map<string, string>(),
  cycleNames: new Map([["nov", "November 2026"]]),
};

describe("buildHistory", () => {
  const h = buildHistory(src);

  it("lists everything newest first, with same-day entries by time", () => {
    expect(h.map((e) => e.key)).toEqual(["tx:t2", "tx:t1", "allocation:a2", "tx:t3", "bill:b1", "allocation:a1", "income:i1"]);
  });

  it("describes each movement plainly", () => {
    const by = Object.fromEntries(h.map((e) => [e.key, e]));
    expect(by["tx:t1"].title).toBe("Lent to Phathu");
    expect(by["tx:t2"].title).toBe("Phathu paid back");
    expect(by["tx:t2"].detail).toBe("into Personal · November 2026");
    expect(by["tx:t3"].title).toBe("Airtime");
    expect(by["allocation:a1"].title).toBe("Allocated to November 2026 plan");
    expect(by["allocation:a2"].title).toBe("Allocated to Personal (November 2026)");
    expect(by["bill:b1"].title).toBe("Debt review paid");
  });

  it("marks what can be undone or deleted", () => {
    const undo = Object.fromEntries(h.map((e) => [e.key, e.undo]));
    expect(undo).toMatchObject({ "income:i1": "income", "allocation:a1": "allocation", "tx:t1": "transaction", "bill:b1": null });
  });

  it("filters", () => {
    expect(h.filter(HISTORY_FILTERS.loans).map((e) => e.key)).toEqual(["tx:t2", "tx:t1"]);
    expect(h.filter(HISTORY_FILTERS.spending).map((e) => e.key)).toEqual(["tx:t3", "bill:b1"]);
  });

  it("signs amounts by direction", () => {
    const by = Object.fromEntries(h.map((e) => [e.key, signedAmount(e)]));
    expect(by["income:i1"]).toBe("+R1 200");
    expect(by["tx:t1"]).toBe("−R450");
    expect(by["allocation:a1"]).toBe("R500");
  });
});

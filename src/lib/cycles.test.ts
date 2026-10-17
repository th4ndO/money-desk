import { describe, expect, it } from "vitest";
import {
  type RecurringItem,
  cycleBounds,
  cycleStartFor,
  generateCycleItems,
  nextCycleStart,
  occurrencesInCycle,
  plannedTotal,
} from "./cycles";

function item(overrides: Partial<RecurringItem>): RecurringItem {
  return {
    id: overrides.name ?? "item",
    name: "Item",
    kind: "bill",
    amount_cents: 10000,
    due_day: 1,
    frequency: "monthly",
    interval_months: null,
    starts_on: "2026-01-01",
    ends_on: null,
    category: null,
    active: true,
    sort_order: 0,
    ...overrides,
  };
}

function dueDates(i: RecurringItem, startDay: number, start: string) {
  const b = cycleBounds(start, startDay);
  return occurrencesInCycle(i, b.start_date, b.end_date);
}

describe("cycle bounds", () => {
  it("runs from the start day to the day before the next start, both inclusive", () => {
    expect(cycleBounds("2026-10-23", 23)).toEqual({
      start_date: "2026-10-23",
      end_date: "2026-11-22",
      name: "November 2026",
    });
  });

  it("spans December into January and is named after January", () => {
    expect(cycleBounds("2026-12-23", 23)).toEqual({
      start_date: "2026-12-23",
      end_date: "2027-01-22",
      name: "January 2027",
    });
  });

  it("handles February in a leap year and a common year", () => {
    expect(cycleBounds("2028-01-23", 23).end_date).toBe("2028-02-22");
    expect(cycleBounds("2028-02-23", 23).end_date).toBe("2028-03-22");
    expect(cycleBounds("2028-02-01", 1).end_date).toBe("2028-02-29");
    expect(cycleBounds("2027-02-01", 1).end_date).toBe("2027-02-28");
  });

  it("clamps a start day of 29–31 in short months", () => {
    expect(cycleBounds("2027-01-31", 31)).toMatchObject({
      end_date: "2027-02-27",
      name: "February 2027",
    });
    expect(cycleBounds("2027-02-28", 31).end_date).toBe("2027-03-30");
    expect(cycleBounds("2028-01-30", 30).end_date).toBe("2028-02-28");
    expect(cycleBounds("2028-02-29", 30).end_date).toBe("2028-03-29");
  });

  it("finds the cycle containing a date", () => {
    expect(cycleStartFor("2026-10-17", 23)).toBe("2026-09-23");
    expect(cycleStartFor("2026-10-23", 23)).toBe("2026-10-23");
    expect(cycleStartFor("2027-01-05", 23)).toBe("2026-12-23");
    expect(cycleStartFor("2027-03-05", 31)).toBe("2027-02-28");
  });

  it("moves to the nearest boundary after the start day changes", () => {
    expect(nextCycleStart("2026-11-01", 23)).toBe("2026-11-23");
    expect(nextCycleStart("2026-10-23", 1)).toBe("2026-11-01");
  });

  it("tiles the calendar with no gaps or overlaps for every start day", () => {
    for (const startDay of [1, 15, 23, 28, 29, 30, 31]) {
      let start = cycleStartFor("2027-11-01", startDay);
      for (let i = 0; i < 30; i++) {
        const b = cycleBounds(start, startDay);
        expect(b.end_date >= b.start_date).toBe(true);
        start = nextCycleStart(start, startDay);
        expect(start > b.end_date).toBe(true);
      }
    }
  });
});

describe("due dates", () => {
  it("puts a late due day in the first month and an early one in the second", () => {
    expect(dueDates(item({ due_day: 25 }), 23, "2026-10-23")).toEqual(["2026-10-25"]);
    expect(dueDates(item({ due_day: 3 }), 23, "2026-10-23")).toEqual(["2026-11-03"]);
    expect(dueDates(item({ due_day: 23 }), 23, "2026-10-23")).toEqual(["2026-10-23"]);
    expect(dueDates(item({ due_day: 22 }), 23, "2026-10-23")).toEqual(["2026-11-22"]);
  });

  it("splits a Dec→Jan cycle across the year end", () => {
    expect(dueDates(item({ due_day: 25 }), 23, "2026-12-23")).toEqual(["2026-12-25"]);
    expect(dueDates(item({ due_day: 3 }), 23, "2026-12-23")).toEqual(["2027-01-03"]);
  });

  it("clamps the 31st to the end of a short month", () => {
    expect(dueDates(item({ due_day: 31 }), 23, "2026-10-23")).toEqual(["2026-10-31"]);
    expect(dueDates(item({ due_day: 31 }), 23, "2026-11-23")).toEqual(["2026-11-30"]);
    expect(dueDates(item({ due_day: 31 }), 1, "2027-02-01")).toEqual(["2027-02-28"]);
    expect(dueDates(item({ due_day: 31 }), 1, "2028-02-01")).toEqual(["2028-02-29"]);
    expect(dueDates(item({ due_day: 30 }), 23, "2028-01-23")).toEqual(["2028-01-30"]);
  });

  it("lands every monthly due day exactly once in every cycle for start days 1–28", () => {
    for (const startDay of [1, 10, 23, 28]) {
      let start = cycleStartFor("2026-01-15", startDay);
      for (let i = 0; i < 36; i++) {
        for (let dueDay = 1; dueDay <= 31; dueDay++) {
          expect(dueDates(item({ due_day: dueDay, starts_on: "2000-01-01" }), startDay, start)).toHaveLength(1);
        }
        start = nextCycleStart(start, startDay);
      }
    }
  });
});

describe("start and end windows", () => {
  const gym = item({ name: "Gym", due_day: 30, ends_on: "2026-12-31" });

  it("keeps an item up to and including its end date", () => {
    expect(dueDates(gym, 23, "2026-11-23")).toEqual(["2026-11-30"]);
    // 30 Dec is on or before 31 Dec, so the gym is still in the January cycle.
    expect(dueDates(gym, 23, "2026-12-23")).toEqual(["2026-12-30"]);
  });

  it("drops an item after its end date", () => {
    expect(dueDates(gym, 23, "2027-01-23")).toEqual([]);
  });

  it("leaves an item out before its start date", () => {
    const rent = item({ name: "Rent", due_day: 1, starts_on: "2027-01-01" });
    expect(dueDates(rent, 23, "2026-11-23")).toEqual([]);
    expect(dueDates(rent, 23, "2026-12-23")).toEqual(["2027-01-01"]);
  });

  it("skips a due date that falls before the start date within the same cycle", () => {
    const late = item({ due_day: 25, starts_on: "2026-11-01" });
    expect(dueDates(late, 23, "2026-10-23")).toEqual([]);
    expect(dueDates(late, 23, "2026-11-23")).toEqual(["2026-11-25"]);
  });
});

describe("every-n-months and once", () => {
  it("repeats every n months from its start month", () => {
    const quarterly = item({
      frequency: "every_n_months",
      interval_months: 3,
      due_day: 10,
      starts_on: "2027-01-10",
    });
    const hits = ["2026-12-23", "2027-01-23", "2027-02-23", "2027-03-23", "2027-06-23", "2027-09-23"]
      .map((start) => dueDates(quarterly, 23, start));
    expect(hits).toEqual([["2027-01-10"], [], [], ["2027-04-10"], ["2027-07-10"], ["2027-10-10"]]);
  });

  it("does nothing before its anchor month", () => {
    const yearly = item({
      frequency: "every_n_months",
      interval_months: 12,
      due_day: 5,
      starts_on: "2027-03-05",
    });
    expect(dueDates(yearly, 23, "2026-02-23")).toEqual([]);
    expect(dueDates(yearly, 23, "2027-02-23")).toEqual(["2027-03-05"]);
    expect(dueDates(yearly, 23, "2028-02-23")).toEqual(["2028-03-05"]);
  });

  it("puts a once item on its start date only", () => {
    const once = item({ frequency: "once", due_day: null, starts_on: "2026-11-05" });
    expect(dueDates(once, 23, "2026-10-23")).toEqual(["2026-11-05"]);
    expect(dueDates(once, 23, "2026-11-23")).toEqual([]);
  });
});

describe("generateCycleItems", () => {
  const items = [
    item({ name: "Water", due_day: 1, sort_order: 2 }),
    item({ name: "Debt", due_day: 23, sort_order: 1 }),
    item({ name: "Groceries", kind: "envelope", due_day: null, amount_cents: 136200 }),
    item({ name: "Old", active: false }),
    item({ name: "Ended", ends_on: "2026-06-30" }),
    item({
      name: "Bi-monthly envelope",
      kind: "envelope",
      due_day: null,
      frequency: "every_n_months",
      interval_months: 2,
      starts_on: "2026-11-01",
    }),
  ];

  it("snapshots active, in-window items sorted by due date with envelopes last", () => {
    const out = generateCycleItems(items, "2026-10-23", "2026-11-22");
    expect(out.map((i) => [i.name, i.due_date])).toEqual([
      ["Debt", "2026-10-23"],
      ["Water", "2026-11-01"],
      ["Groceries", null],
      ["Bi-monthly envelope", null],
    ]);
    expect(out[0]).toMatchObject({ recurring_item_id: "Debt", planned_cents: 10000, kind: "bill" });
  });

  it("skips an every-n-months envelope in off months", () => {
    const out = generateCycleItems(items, "2026-11-23", "2026-12-22");
    expect(out.map((i) => i.name)).not.toContain("Bi-monthly envelope");
  });

  it("totals planned amounts", () => {
    expect(plannedTotal(generateCycleItems(items, "2026-10-23", "2026-11-22"))).toBe(
      10000 + 10000 + 136200 + 10000,
    );
  });
});

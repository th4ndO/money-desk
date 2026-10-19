import { describe, expect, it } from "vitest";
import { computeRunway } from "./runway";
import { seedAsRecurringItems } from "./seed-data";

const recurring = seedAsRecurringItems();
const base = {
  spendableReserves: 0,
  currentCommitted: 0,
  futureCycles: [],
  recurring,
  startDay: 23,
  nextStart: "2026-12-23",
};

describe("computeRunway", () => {
  it("covers whole cycles and then part of one, with the run-out date inside it", () => {
    // Jan plans R9 745 (gym still in), Feb onward R9 495.
    const r = computeRunway({ ...base, bankBalance: 974500 + 949500 + 474750 });
    expect(r.schedule[0]).toMatchObject({ name: "January 2027", planned: 974500, covered: "full" });
    expect(r.schedule[1]).toMatchObject({ name: "February 2027", planned: 949500, covered: "full" });
    expect(r.schedule[2]).toMatchObject({ name: "March 2027", covered: "part" });
    expect(r.cyclesCovered).toBe(2.5);
    // March cycle: 23 Feb–22 Mar 2027 is 28 days; half of it is 14 days.
    expect(r.runsOutOn).toBe("2027-03-08");
  });

  it("counts spendable reserves and subtracts what the current cycle still needs", () => {
    const r = computeRunway({ ...base, bankBalance: 500000, spendableReserves: 600000, currentCommitted: 125500 });
    expect(r.available).toBe(974500);
    expect(r.cyclesCovered).toBe(1);
    expect(r.runsOutOn).toBe("2027-01-22");
  });

  it("uses cycles already created instead of projecting them", () => {
    const r = computeRunway({
      ...base,
      bankBalance: 2_000_000,
      futureCycles: [
        { name: "January 2027", start_date: "2026-12-23", end_date: "2027-01-22", planned: 1_500_000, source: "existing" },
      ],
    });
    expect(r.schedule[0]).toMatchObject({ planned: 1_500_000, source: "existing" });
    expect(r.schedule[1]).toMatchObject({ name: "February 2027", source: "projected", covered: "part" });
  });

  it("picks up rent once it is switched on", () => {
    const withRent = recurring.map((i) => (i.name === "Rent" ? { ...i, active: true } : i));
    const r = computeRunway({ ...base, recurring: withRent, bankBalance: 10_000_000 });
    expect(r.schedule[0].planned).toBe(974500 + 650000);
  });

  it("says the money is already gone when there is none to spare", () => {
    const r = computeRunway({ ...base, bankBalance: 100000, currentCommitted: 200000 });
    expect(r.available).toBe(-100000);
    expect(r.cyclesCovered).toBe(0);
    expect(r.runsOutOn).toBe("2026-12-22");
  });

  it("returns null when the money outlasts the horizon", () => {
    const r = computeRunway({ ...base, bankBalance: 1_000_000_000, horizon: 6 });
    expect(r.runsOutOn).toBeNull();
    expect(r.cyclesCovered).toBe(6);
  });
});

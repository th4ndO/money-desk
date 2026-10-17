import { describe, expect, it } from "vitest";
import { cycleBounds, generateCycleItems, plannedTotal } from "./cycles";
import { SEED_CYCLES, SEED_SETTINGS, seedAsRecurringItems } from "./seed-data";

const items = seedAsRecurringItems();
const startDay = SEED_SETTINGS.cycle_start_day;

function plan(start: string) {
  const b = cycleBounds(start, startDay);
  return { ...b, items: generateCycleItems(items, b.start_date, b.end_date) };
}

describe("seed data", () => {
  it.each(SEED_CYCLES.map((c) => [c.start_date]))(
    "plans exactly R9 745 for the cycle starting %s",
    (start) => {
      const c = plan(start);
      expect(plannedTotal(c.items)).toBe(974500);
      expect(c.items).toHaveLength(15);
    },
  );

  it("matches each cycle's pocket to its plan", () => {
    for (const c of SEED_CYCLES) {
      expect(plannedTotal(plan(c.start_date).items)).toBe(c.pocket_cents);
    }
  });

  it("names and bounds the seeded cycles", () => {
    expect(SEED_CYCLES.map((c) => plan(c.start_date)).map((c) => [c.name, c.start_date, c.end_date])).toEqual([
      ["October 2026", "2026-09-23", "2026-10-22"],
      ["November 2026", "2026-10-23", "2026-11-22"],
      ["December 2026", "2026-11-23", "2026-12-22"],
    ]);
  });

  it("puts Rain on the 3rd of the second month and Water on the 1st", () => {
    const nov = plan("2026-10-23").items;
    expect(nov.find((i) => i.name === "Rain Wi-Fi")?.due_date).toBe("2026-11-03");
    expect(nov.find((i) => i.name === "Water")?.due_date).toBe("2026-11-01");
    expect(nov.find((i) => i.name === "Debt review")?.due_date).toBe("2026-10-23");
  });

  it("still has the gym in January (debit on 30 Dec, before its 31 Dec end date)", () => {
    const jan = plan("2026-12-23");
    expect(jan.name).toBe("January 2027");
    expect(jan.items.find((i) => i.name === "Gym")?.due_date).toBe("2026-12-30");
    expect(plannedTotal(jan.items)).toBe(974500);
  });

  it("drops the gym from February onward and leaves inactive items out", () => {
    const feb = plan("2027-01-23");
    expect(feb.items.map((i) => i.name)).not.toContain("Gym");
    expect(feb.items.map((i) => i.name)).not.toContain("Rent");
    expect(plannedTotal(feb.items)).toBe(974500 - 25000);
  });

  it("includes rent from January once it is switched on", () => {
    const withRent = items.map((i) => (i.name === "Rent" ? { ...i, active: true } : i));
    const jan = cycleBounds("2026-12-23", startDay);
    const dec = cycleBounds("2026-11-23", startDay);
    expect(generateCycleItems(withRent, dec.start_date, dec.end_date).map((i) => i.name)).not.toContain("Rent");
    expect(
      generateCycleItems(withRent, jan.start_date, jan.end_date).find((i) => i.name === "Rent")?.due_date,
    ).toBe("2027-01-01");
  });
});

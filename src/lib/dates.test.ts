import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  clampedDate,
  daysInMonth,
  daysInclusive,
  formatDate,
  isISODate,
  todayJHB,
} from "./dates";

describe("daysInMonth and clamping", () => {
  it("knows February in leap and common years", () => {
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
  });

  it("clamps the 31st to the last day of shorter months", () => {
    expect(clampedDate(2027, 2, 31)).toBe("2027-02-28");
    expect(clampedDate(2028, 2, 31)).toBe("2028-02-29");
    expect(clampedDate(2026, 11, 31)).toBe("2026-11-30");
    expect(clampedDate(2026, 12, 31)).toBe("2026-12-31");
  });
});

describe("month and day arithmetic", () => {
  it("wraps months across years", () => {
    expect(addMonths(2026, 12, 1)).toEqual({ y: 2027, m: 1 });
    expect(addMonths(2027, 1, -1)).toEqual({ y: 2026, m: 12 });
    expect(addMonths(2026, 11, 14)).toEqual({ y: 2028, m: 1 });
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });

  it("counts days inclusively", () => {
    expect(daysInclusive("2026-10-23", "2026-10-23")).toBe(1);
    expect(daysInclusive("2026-10-23", "2026-11-22")).toBe(31);
    expect(daysInclusive("2027-01-23", "2027-02-22")).toBe(31);
  });
});

describe("todayJHB", () => {
  it("is already tomorrow in Johannesburg at 22:30 UTC", () => {
    expect(todayJHB(new Date("2026-10-22T22:30:00Z"))).toBe("2026-10-23");
  });

  it("is still today at 21:59 UTC", () => {
    expect(todayJHB(new Date("2026-10-22T21:59:00Z"))).toBe("2026-10-22");
  });

  it("rolls the year at midnight SAST", () => {
    expect(todayJHB(new Date("2026-12-31T22:00:00Z"))).toBe("2027-01-01");
  });
});

describe("validation and formatting", () => {
  it("rejects impossible dates", () => {
    expect(isISODate("2027-02-29")).toBe(false);
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(isISODate("26-1-1")).toBe(false);
  });

  it("formats", () => {
    expect(formatDate("2026-10-23")).toBe("23 Oct 2026");
  });
});

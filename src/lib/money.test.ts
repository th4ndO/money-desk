import { describe, expect, it } from "vitest";
import { centsToInput, formatZAR, parseRandToCents, sumCents } from "./money";

const nb = " ";

describe("formatZAR", () => {
  it("uses a space as thousands separator and hides zero cents", () => {
    expect(formatZAR(158500)).toBe(`R1${nb}585`);
    expect(formatZAR(974500)).toBe(`R9${nb}745`);
    expect(formatZAR(123456789)).toBe(`R1${nb}234${nb}567.89`);
  });

  it("shows cents when non-zero", () => {
    expect(formatZAR(11321)).toBe("R113.21");
    expect(formatZAR(5)).toBe("R0.05");
    expect(formatZAR(150050)).toBe(`R1${nb}500.50`);
  });

  it("handles zero and negatives", () => {
    expect(formatZAR(0)).toBe("R0");
    expect(formatZAR(-15000)).toBe("−R150");
  });

  it("rejects non-integers", () => {
    expect(() => formatZAR(1.5)).toThrow();
  });
});

describe("parseRandToCents", () => {
  it.each([
    ["150", 15000],
    ["R150", 15000],
    ["r 1 585", 158500],
    ["1,585", 158500],
    ["1585.5", 158550],
    ["113.21", 11321],
    ["113,21", 11321],
    ["1,234.56", 123456],
    ["0", 0],
    [" 9 745 ", 974500],
  ])("parses %s", (input, expected) => {
    expect(parseRandToCents(input)).toBe(expected);
  });

  it.each(["", "abc", "-5", "1.234", "1..2", "R", "12a"])("rejects %s", (input) => {
    expect(parseRandToCents(input)).toBeNull();
  });

  it("never produces floating-point drift", () => {
    expect(parseRandToCents("0.29")).toBe(29);
    expect(parseRandToCents("1.15")).toBe(115);
  });
});

describe("centsToInput / sumCents", () => {
  it("round-trips through parse", () => {
    for (const c of [0, 5, 11321, 158500, 150050]) {
      expect(parseRandToCents(centsToInput(c))).toBe(c);
    }
  });

  it("sums integers", () => {
    expect(sumCents([10, 20, 30])).toBe(60);
    expect(sumCents([])).toBe(0);
  });
});

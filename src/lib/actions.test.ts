import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseForm, zCheckbox, zMoney, zOptionalDate, zOptionalText, zPositiveMoney } from "./actions";

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("form parsing", () => {
  const schema = z.object({ amount: zPositiveMoney, date: zOptionalDate, note: zOptionalText(10), done: zCheckbox });

  it("accepts optional fields that are missing from the form entirely", () => {
    const r = parseForm(schema, fd({ amount: "150" }));
    expect(r).toEqual({ ok: true, data: { amount: 15000, date: null, note: null, done: false } });
  });

  it("turns blanks into null and checkboxes into booleans", () => {
    const r = parseForm(schema, fd({ amount: "1 585,50", date: "", note: "  ", done: "on" }));
    expect(r).toEqual({ ok: true, data: { amount: 158550, date: null, note: null, done: true } });
  });

  it("explains bad input in plain words", () => {
    const bad = (e: Record<string, string>) => {
      const r = parseForm(schema, fd(e));
      return r.ok ? "" : r.result.message;
    };
    expect(bad({ amount: "abc" })).toBe("Enter an amount like 150 or 113.21.");
    expect(bad({ amount: "0" })).toBe("Enter an amount above R0.");
    expect(bad({ amount: "5", date: "2027-02-29" })).toBe("Pick a valid date.");
    expect(bad({ amount: "5", note: "this is far too long" })).toBe("Keep it under 10 characters.");
    expect(bad({})).toBe("Something's missing from the form. Refresh the page and try again.");
  });

  it("parses money without floats", () => {
    expect(zMoney.parse("0.29")).toBe(29);
  });
});

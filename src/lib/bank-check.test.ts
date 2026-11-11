import { describe, expect, it } from "vitest";
import { bankCheck, checkedToday, daysSinceCheck } from "./bank-check";

const base = { ready: 0, pocketLeft: 300000, setAsideAhead: 0, reserves: 40000, previousLeftover: 0 };

describe("bankCheck", () => {
  it("finds money the app doesn't know about", () => {
    const r = bankCheck(540000, base, "November 2026");
    expect(r.accounted).toBe(340000);
    expect(r.gap).toBe(200000);
  });

  it("shows unlogged spending as a negative gap", () => {
    expect(bankCheck(300000, base, "November 2026").gap).toBe(-40000);
  });

  it("matches when everything is accounted for", () => {
    const r = bankCheck(415000, { ...base, ready: 10000, setAsideAhead: 50000, previousLeftover: 15000 }, "November 2026");
    expect(r.gap).toBe(0);
  });

  it("counts an overspent previous cycle and negative ready money", () => {
    expect(bankCheck(0, { ...base, ready: -5000, previousLeftover: -35000 }, "X").accounted).toBe(300000);
  });

  it("hides empty lines but always shows pocket and ready", () => {
    const labels = bankCheck(1, { ...base, reserves: 0 }, "November 2026").lines.map((l) => l.label);
    expect(labels).toEqual(["Left in November 2026 pocket", "Ready to allocate"]);
  });
});

describe("check freshness", () => {
  it("only trusts a balance entered today", () => {
    expect(checkedToday("2026-11-11", "2026-11-11")).toBe(true);
    expect(checkedToday("2026-11-10", "2026-11-11")).toBe(false);
    expect(checkedToday(null, "2026-11-11")).toBe(false);
  });

  it("counts days since the last check", () => {
    expect(daysSinceCheck(null, "2026-11-11")).toBeNull();
    expect(daysSinceCheck("2026-11-11", "2026-11-11")).toBe(0);
    expect(daysSinceCheck("2026-11-03", "2026-11-11")).toBe(8);
  });
});

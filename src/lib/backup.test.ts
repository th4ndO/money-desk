import { describe, expect, it } from "vitest";
import { backupCounts, parseBackup, toCSV } from "./backup";
import { plannedTotal } from "./cycles";
import { buildSeedBackup } from "./seed-data";

let counter = 0;
const fakeId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

describe("seed backup", () => {
  const seed = buildSeedBackup("2026-10-19", fakeId);

  it("is a valid backup", () => {
    expect(parseBackup(JSON.stringify(seed)).ok).toBe(true);
  });

  it("has the expected rows", () => {
    expect(backupCounts(seed)).toEqual({
      recurring_items: 19,
      cycles: 3,
      cycle_items: 45,
      transactions: 0,
      income: 0,
      reserves: 2,
      todos: 5,
      allocations: 0,
    });
  });

  it("plans R9 745 in every seeded cycle", () => {
    for (const c of seed.cycles) {
      expect(plannedTotal(seed.cycle_items.filter((i) => i.cycle_id === c.id))).toBe(974500);
      expect(c.pocket_cents).toBe(974500);
    }
  });

  it("ticks October bills due by the load date, and savings everywhere", () => {
    const oct = seed.cycles[0].id;
    const paidOct = seed.cycle_items.filter((i) => i.cycle_id === oct && i.paid).map((i) => i.name);
    // Due 23 Sep–19 Oct: everything except nothing later in October (cycle ends 22 Oct).
    expect(paidOct).toContain("Savings");
    expect(paidOct).toContain("Spotify Student");
    expect(paidOct).not.toContain("Groceries");
    for (const c of seed.cycles.slice(1)) {
      const paid = seed.cycle_items.filter((i) => i.cycle_id === c.id && i.paid).map((i) => i.name);
      expect(paid).toEqual(["Savings"]);
    }
  });

  it("leaves October bills due after the load date unticked", () => {
    const early = buildSeedBackup("2026-10-01", fakeId);
    const oct = early.cycles[0].id;
    const unpaid = early.cycle_items.filter((i) => i.cycle_id === oct && i.kind === "bill" && !i.paid).map((i) => i.name);
    expect(unpaid).toEqual(["Rain Wi-Fi", "Apple iCloud", "Spotify Student"]);
  });
});

describe("parseBackup", () => {
  const good = buildSeedBackup("2026-10-19", fakeId);

  it("rejects non-JSON and other files", () => {
    expect(parseBackup("not json")).toEqual({ ok: false, error: "That file isn't valid JSON." });
    expect(parseBackup('{"hello":1}').ok).toBe(false);
  });

  it("rejects floats in amounts", () => {
    const bad = structuredClone(good);
    bad.income.push({ id: fakeId(), amount_cents: 10.5, date: "2026-10-01", source: "x", notes: null });
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false);
  });

  it("rejects dangling references", () => {
    const bad = structuredClone(good);
    bad.transactions.push({ id: fakeId(), cycle_id: fakeId(), cycle_item_id: null, amount_cents: 100, date: "2026-10-01", note: null, kind: "spend", counterparty: null, repays_id: null });
    const r = parseBackup(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("missing cycle");
  });

  it("rejects impossible dates", () => {
    const bad = structuredClone(good);
    bad.todos[0].due_date = "2027-02-29";
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false);
  });
});

describe("allocations in backups", () => {
  const good = buildSeedBackup("2026-10-19", fakeId);

  it("accepts older backups without allocations", () => {
    const old: Record<string, unknown> = structuredClone(good);
    delete old.allocations;
    const r = parseBackup(JSON.stringify(old));
    expect(r.ok && r.backup.allocations).toEqual([]);
  });

  it("rejects an allocation pointing at nothing", () => {
    const bad = structuredClone(good);
    bad.allocations.push({ id: fakeId(), cycle_item_id: fakeId(), reserve_id: null, cycle_id: null, amount_cents: 100, date: "2026-10-19", note: null });
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false);
  });

  it("accepts an allocation to a real pot", () => {
    const ok = structuredClone(good);
    ok.allocations.push({ id: fakeId(), cycle_item_id: null, reserve_id: ok.reserves[0].id, cycle_id: null, amount_cents: 100, date: "2026-10-19", note: null });
    expect(parseBackup(JSON.stringify(ok)).ok).toBe(true);
  });

  it("accepts pocket funding for a real cycle, and rejects two targets at once", () => {
    const ok = structuredClone(good);
    ok.allocations.push({ id: fakeId(), cycle_item_id: null, reserve_id: null, cycle_id: ok.cycles[1].id, amount_cents: 50000, date: "2026-10-21", note: null });
    expect(parseBackup(JSON.stringify(ok)).ok).toBe(true);
    const bad = structuredClone(good);
    bad.allocations.push({ id: fakeId(), cycle_item_id: null, reserve_id: bad.reserves[0].id, cycle_id: bad.cycles[1].id, amount_cents: 1, date: "2026-10-21", note: null });
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false);
  });
});

describe("toCSV", () => {
  it("adds a rands column next to each cents column and quotes awkward text", () => {
    expect(
      toCSV([
        { name: 'Check "Apple", R180', amount_cents: 18000 },
        { name: "Plain", amount_cents: 5 },
      ]),
    ).toBe('name,amount_cents,amount_rands\r\n"Check ""Apple"", R180",18000,180.00\r\nPlain,5,0.05\r\n');
  });

  it("returns an empty string for no rows", () => {
    expect(toCSV([])).toBe("");
  });
});

describe("lending in backups", () => {
  const good = buildSeedBackup("2026-10-19", fakeId);
  const cycleId = good.cycles[1].id;
  const tx = (o: Partial<(typeof good.transactions)[number]>) => ({
    id: fakeId(), cycle_id: cycleId, cycle_item_id: null, amount_cents: 100, date: "2026-10-24", note: null,
    kind: "spend" as const, counterparty: null, repays_id: null, ...o,
  });

  it("treats older entries without a kind as spending", () => {
    const old = structuredClone(good) as unknown as { transactions: Record<string, unknown>[] };
    old.transactions.push({ id: fakeId(), cycle_id: cycleId, cycle_item_id: null, amount_cents: 100, date: "2026-10-24", note: null });
    const r = parseBackup(JSON.stringify(old));
    expect(r.ok && r.backup.transactions[0].kind).toBe("spend");
  });

  it("accepts a loan and its repayment", () => {
    const ok = structuredClone(good);
    const loan = tx({ kind: "lend", counterparty: "Thabo" });
    ok.transactions.push(loan, tx({ kind: "refund", repays_id: loan.id }));
    expect(parseBackup(JSON.stringify(ok)).ok).toBe(true);
  });

  it("rejects a nameless loan and a repayment of a spend", () => {
    const a = structuredClone(good);
    a.transactions.push(tx({ kind: "lend" }));
    expect(parseBackup(JSON.stringify(a)).ok).toBe(false);
    const b = structuredClone(good);
    const spend = tx({});
    b.transactions.push(spend, tx({ kind: "refund", repays_id: spend.id }));
    expect(parseBackup(JSON.stringify(b)).ok).toBe(false);
  });
});

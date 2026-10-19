import { type ISODate, daysInclusive } from "./dates";
import type { Cents } from "./money";
import type { CycleItemRow, CycleRow, TransactionRow } from "./types";

export type CycleStatus = "planned" | "active" | "ended" | "closed";

/** Derived from the dates and today; never stored. */
export function cycleStatus(cycle: Pick<CycleRow, "start_date" | "end_date" | "closed_at">, today: ISODate): CycleStatus {
  if (cycle.closed_at) return "closed";
  if (today < cycle.start_date) return "planned";
  if (today > cycle.end_date) return "ended";
  return "active";
}

export type Health = "Overspent" | "Envelopes over" | "Plan exceeds pocket" | "On track";

export interface EnvelopeSummary {
  id: string;
  name: string;
  planned: Cents;
  spent: Cents;
  remaining: Cents;
}

export interface CycleSummary {
  planned: Cents;
  pocket: Cents;
  spent: Cents;
  left: Cents;
  billsPaid: Cents;
  billsDue: Cents;
  billsPaidCount: number;
  billsCount: number;
  envelopes: EnvelopeSummary[];
  envelopeRemaining: Cents;
  unplannedSpent: Cents;
  daysLeft: number;
  safePerDay: Cents;
  health: Health;
  nextBills: CycleItemRow[];
}

const isDated = (i: Pick<CycleItemRow, "kind">) => i.kind !== "envelope";

/** Days left in the cycle counting today; the whole cycle before it starts, 0 after it ends. */
export function daysLeftInCycle(cycle: Pick<CycleRow, "start_date" | "end_date">, today: ISODate): number {
  if (today > cycle.end_date) return 0;
  const from = today < cycle.start_date ? cycle.start_date : today;
  return daysInclusive(from, cycle.end_date);
}

/**
 * Every figure on the dashboard, computed from the cycle's rows. Bills and
 * savings are both "dated" items that get ticked; envelopes are spent
 * against with transactions.
 */
export function summariseCycle(
  cycle: Pick<CycleRow, "start_date" | "end_date" | "pocket_cents">,
  items: readonly CycleItemRow[],
  transactions: readonly Pick<TransactionRow, "cycle_item_id" | "amount_cents">[],
  today: ISODate,
): CycleSummary {
  const dated = items.filter(isDated);
  const paid = dated.filter((i) => i.paid);
  const unpaid = dated.filter((i) => !i.paid);

  const spentByItem = new Map<string, Cents>();
  let unplannedSpent = 0;
  let txTotal = 0;
  for (const t of transactions) {
    txTotal += t.amount_cents;
    if (t.cycle_item_id) spentByItem.set(t.cycle_item_id, (spentByItem.get(t.cycle_item_id) ?? 0) + t.amount_cents);
    else unplannedSpent += t.amount_cents;
  }

  const envelopes = items
    .filter((i) => i.kind === "envelope")
    .map((i) => {
      const spent = spentByItem.get(i.id) ?? 0;
      return { id: i.id, name: i.name, planned: i.planned_cents, spent, remaining: i.planned_cents - spent };
    });

  const planned = items.reduce((s, i) => s + i.planned_cents, 0);
  const billsPaid = paid.reduce((s, i) => s + (i.actual_cents ?? i.planned_cents), 0);
  const billsDue = unpaid.reduce((s, i) => s + i.planned_cents, 0);
  const spent = billsPaid + txTotal;
  const left = cycle.pocket_cents - spent;
  const envelopeRemaining = envelopes.reduce((s, e) => s + e.remaining, 0);
  const daysLeft = daysLeftInCycle(cycle, today);
  const safePerDay = daysLeft > 0 ? Math.floor(Math.max(0, envelopeRemaining) / daysLeft) : 0;

  const health: Health =
    left < 0
      ? "Overspent"
      : envelopes.some((e) => e.remaining < 0)
        ? "Envelopes over"
        : planned > cycle.pocket_cents
          ? "Plan exceeds pocket"
          : "On track";

  const nextBills = [...unpaid]
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, 3);

  return {
    planned,
    pocket: cycle.pocket_cents,
    spent,
    left,
    billsPaid,
    billsDue,
    billsPaidCount: paid.length,
    billsCount: dated.length,
    envelopes,
    envelopeRemaining,
    unplannedSpent,
    daysLeft,
    safePerDay,
    health,
    nextBills,
  };
}

export function healthTone(health: Health): "good" | "warn" | "bad" {
  if (health === "On track") return "good";
  if (health === "Overspent") return "bad";
  return "warn";
}

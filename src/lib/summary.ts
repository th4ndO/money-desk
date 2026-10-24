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
  /** Planned plus any top-ups. */
  planned: Cents;
  /** Spent for good, net of refunds that aren't loan repayments. */
  spent: Cents;
  /** Lent out of this envelope this cycle, net of repayments of those loans. */
  lent: Cents;
  /** Repayments that came in for loans made in other cycles. */
  repaidFromEarlier: Cents;
  remaining: Cents;
}

export type EntryLike = Pick<TransactionRow, "cycle_item_id" | "amount_cents"> &
  Partial<Pick<TransactionRow, "id" | "kind" | "repays_id">>;

/**
 * Net effect of entries on one envelope (or on "unplanned"):
 * remaining = planned - spends - loans + money back.
 */
export function envelopeFlows(entries: readonly EntryLike[]) {
  const loanIds = new Set(entries.filter((e) => e.kind === "lend" && e.id).map((e) => e.id));
  let spent = 0;
  let lent = 0;
  let repaidFromEarlier = 0;
  for (const e of entries) {
    const kind = e.kind ?? "spend";
    if (kind === "spend") spent += e.amount_cents;
    else if (kind === "lend") lent += e.amount_cents;
    else if (e.repays_id && loanIds.has(e.repays_id)) lent -= e.amount_cents;
    else if (e.repays_id) repaidFromEarlier += e.amount_cents;
    else spent -= e.amount_cents;
  }
  return { spent, lent, repaidFromEarlier, net: spent + lent - repaidFromEarlier };
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
  transactions: readonly EntryLike[],
  today: ISODate,
): CycleSummary {
  const dated = items.filter(isDated);
  const paid = dated.filter((i) => i.paid);
  const unpaid = dated.filter((i) => !i.paid);

  const byItem = new Map<string | null, EntryLike[]>();
  for (const t of transactions) {
    const key = t.cycle_item_id ?? null;
    byItem.set(key, [...(byItem.get(key) ?? []), t]);
  }
  const allFlows = envelopeFlows(transactions);
  const unplannedSpent = envelopeFlows(byItem.get(null) ?? []).net;

  const envelopes = items
    .filter((i) => i.kind === "envelope")
    .map((i) => {
      const f = envelopeFlows(byItem.get(i.id) ?? []);
      return {
        id: i.id,
        name: i.name,
        planned: i.planned_cents,
        spent: f.spent,
        lent: f.lent,
        repaidFromEarlier: f.repaidFromEarlier,
        remaining: i.planned_cents - f.net,
      };
    });

  const planned = items.reduce((s, i) => s + i.planned_cents, 0);
  const billsPaid = paid.reduce((s, i) => s + (i.actual_cents ?? i.planned_cents), 0);
  const billsDue = unpaid.reduce((s, i) => s + i.planned_cents, 0);
  // Cash that left the pocket: bills paid, spending and loans, less money back.
  const spent = billsPaid + allFlows.net;
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

import type { Cents } from "./money";
import { formatZAR } from "./money";
import type { ISODate } from "./dates";

export type HistoryType = "income" | "allocation" | "spend" | "lend" | "refund" | "bill";

export interface HistoryEntry {
  key: string;
  type: HistoryType;
  id: string;
  date: ISODate;
  /** For ordering entries on the same day (newest first). */
  at: string;
  title: string;
  detail: string;
  amount: Cents;
  /** +1 money in, -1 money out, 0 moved between jobs. */
  direction: 1 | -1 | 0;
  /** Which kind of row Undo/Delete acts on, if any. */
  undo: "allocation" | "transaction" | "income" | null;
  cycleId: string | null;
  itemId: string | null;
}

export interface HistorySources {
  income: { id: string; amount_cents: Cents; date: ISODate; source: string; notes: string | null; created_at?: string }[];
  allocations: {
    id: string;
    amount_cents: Cents;
    date: ISODate;
    note: string | null;
    cycle_item_id: string | null;
    reserve_id: string | null;
    cycle_id: string | null;
    created_at?: string;
  }[];
  transactions: {
    id: string;
    amount_cents: Cents;
    date: ISODate;
    note: string | null;
    kind?: string;
    counterparty?: string | null;
    repays_id?: string | null;
    cycle_id: string;
    cycle_item_id: string | null;
    created_at?: string;
  }[];
  paidBills: { id: string; name: string; paid_on: ISODate | null; actual_cents: Cents | null; planned_cents: Cents; cycle_id: string }[];
  itemNames: Map<string, { name: string; cycleId: string }>;
  reserveNames: Map<string, string>;
  cycleNames: Map<string, string>;
}

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

/** Every money movement as one list, newest first. */
export function buildHistory(src: HistorySources): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  const cycleName = (id: string | null) => (id ? src.cycleNames.get(id) ?? null : null);

  for (const i of src.income) {
    out.push({
      key: `income:${i.id}`, type: "income", id: i.id, date: i.date, at: i.created_at ?? "",
      title: i.source, detail: join("Income", i.notes), amount: i.amount_cents, direction: 1,
      undo: "income", cycleId: null, itemId: null,
    });
  }

  for (const a of src.allocations) {
    const item = a.cycle_item_id ? src.itemNames.get(a.cycle_item_id) : undefined;
    const target = item
      ? `${item.name} (${cycleName(item.cycleId) ?? "cycle"})`
      : a.reserve_id
        ? `${src.reserveNames.get(a.reserve_id) ?? "Reserve"} (reserve)`
        : `${cycleName(a.cycle_id) ?? "Cycle"} plan`;
    out.push({
      key: `allocation:${a.id}`, type: "allocation", id: a.id, date: a.date, at: a.created_at ?? "",
      title: `Allocated to ${target}`, detail: join(a.reserve_id ? "Added to pot" : a.cycle_id ? "Funded the plan" : "Top-up", a.note),
      amount: a.amount_cents, direction: 0, undo: "allocation",
      cycleId: item?.cycleId ?? a.cycle_id, itemId: a.cycle_item_id,
    });
  }

  for (const t of src.transactions) {
    const kind = (t.kind ?? "spend") as "spend" | "lend" | "refund";
    const envelope = t.cycle_item_id ? src.itemNames.get(t.cycle_item_id)?.name ?? "Envelope" : "Unplanned";
    const title =
      kind === "lend"
        ? `Lent to ${t.counterparty ?? "someone"}`
        : kind === "refund"
          ? t.repays_id
            ? `${t.counterparty ?? "Loan"} paid back`
            : `Money back${t.counterparty ? ` from ${t.counterparty}` : ""}`
          : t.note || `Spent from ${envelope}`;
    const where = kind === "refund" ? `into ${envelope}` : `from ${envelope}`;
    out.push({
      key: `tx:${t.id}`, type: kind, id: t.id, date: t.date, at: t.created_at ?? "",
      title, detail: join(where, cycleName(t.cycle_id), kind === "spend" ? null : t.note),
      amount: t.amount_cents, direction: kind === "refund" ? 1 : -1, undo: "transaction",
      cycleId: t.cycle_id, itemId: t.cycle_item_id,
    });
  }

  for (const b of src.paidBills) {
    if (!b.paid_on) continue;
    out.push({
      key: `bill:${b.id}`, type: "bill", id: b.id, date: b.paid_on, at: "",
      title: `${b.name} paid`, detail: join("Bill", cycleName(b.cycle_id)),
      amount: b.actual_cents ?? b.planned_cents, direction: -1, undo: null,
      cycleId: b.cycle_id, itemId: b.id,
    });
  }

  return out.sort((x, y) => y.date.localeCompare(x.date) || y.at.localeCompare(x.at));
}

export const HISTORY_FILTERS = {
  all: () => true,
  income: (e: HistoryEntry) => e.type === "income",
  allocations: (e: HistoryEntry) => e.type === "allocation",
  spending: (e: HistoryEntry) => e.type === "spend" || e.type === "bill",
  loans: (e: HistoryEntry) => e.type === "lend" || e.type === "refund",
} as const;
export type HistoryFilter = keyof typeof HISTORY_FILTERS;

/** "+R300", "−R150" or "R500" (moved). */
export function signedAmount(e: Pick<HistoryEntry, "amount" | "direction">): string {
  const v = formatZAR(e.amount);
  return e.direction > 0 ? `+${v}` : e.direction < 0 ? `−${v}` : v;
}

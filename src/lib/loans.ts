import type { Cents } from "./money";
import type { ISODate } from "./dates";

export interface Loan {
  id: string;
  counterparty: string;
  amount: Cents;
  repaid: Cents;
  outstanding: Cents;
  date: ISODate;
  cycle_id: string;
  cycle_item_id: string | null;
  note: string | null;
}

type Entry = {
  id: string;
  kind?: string;
  amount_cents: Cents;
  counterparty?: string | null;
  repays_id?: string | null;
  date: ISODate;
  cycle_id: string;
  cycle_item_id: string | null;
  note: string | null;
};

/** Every loan with what has been paid back so far, across all cycles. */
export function loansWithRepayments(entries: readonly Entry[]): Loan[] {
  const repaid = new Map<string, Cents>();
  for (const e of entries) {
    if (e.kind === "refund" && e.repays_id) repaid.set(e.repays_id, (repaid.get(e.repays_id) ?? 0) + e.amount_cents);
  }
  return entries
    .filter((e) => e.kind === "lend")
    .map((e) => {
      const back = repaid.get(e.id) ?? 0;
      return {
        id: e.id,
        counterparty: e.counterparty ?? "Someone",
        amount: e.amount_cents,
        repaid: back,
        outstanding: Math.max(0, e.amount_cents - back),
        date: e.date,
        cycle_id: e.cycle_id,
        cycle_item_id: e.cycle_item_id,
        note: e.note,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Loans still (partly) owed to me. */
export function openLoans(entries: readonly Entry[]): Loan[] {
  return loansWithRepayments(entries).filter((l) => l.outstanding > 0);
}

import type { Cents } from "./money";
import type { CycleItemRow, TransactionRow } from "./types";

export interface ReviewLine {
  id: string | null;
  name: string;
  kind: CycleItemRow["kind"] | "unplanned";
  planned: Cents;
  actual: Cents;
  /** actual − planned: positive is over, negative is under. */
  difference: Cents;
  note?: string;
}

export interface CycleReview {
  lines: ReviewLine[];
  planned: Cents;
  actual: Cents;
  difference: Cents;
  pocket: Cents;
  /** pocket − actual: what was left over (negative if overspent). */
  leftOver: Cents;
}

/**
 * Planned vs actual per item. A bill that was never ticked counts as R0
 * actual and is flagged, so a forgotten tick is visible in the review.
 */
export function reviewCycle(
  pocket: Cents,
  items: readonly CycleItemRow[],
  transactions: readonly Pick<TransactionRow, "cycle_item_id" | "amount_cents">[],
): CycleReview {
  const spent = new Map<string, Cents>();
  let unplanned = 0;
  for (const t of transactions) {
    if (t.cycle_item_id) spent.set(t.cycle_item_id, (spent.get(t.cycle_item_id) ?? 0) + t.amount_cents);
    else unplanned += t.amount_cents;
  }

  const lines: ReviewLine[] = items.map((i) => {
    const actual =
      i.kind === "envelope" ? (spent.get(i.id) ?? 0) : i.paid ? (i.actual_cents ?? i.planned_cents) : 0;
    return {
      id: i.id,
      name: i.name,
      kind: i.kind,
      planned: i.planned_cents,
      actual,
      difference: actual - i.planned_cents,
      note: i.kind !== "envelope" && !i.paid ? "Not ticked as paid" : undefined,
    };
  });

  if (unplanned > 0) {
    lines.push({ id: null, name: "Unplanned spending", kind: "unplanned", planned: 0, actual: unplanned, difference: unplanned });
  }

  const planned = lines.reduce((s, l) => s + l.planned, 0);
  const actual = lines.reduce((s, l) => s + l.actual, 0);
  return { lines, planned, actual, difference: actual - planned, pocket, leftOver: pocket - actual };
}

import type { Cents } from "./money";
import { type EntryLike, envelopeFlows } from "./summary";
import type { CycleItemRow } from "./types";

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
  transactions: readonly EntryLike[],
): CycleReview {
  const byItem = new Map<string | null, EntryLike[]>();
  for (const t of transactions) {
    const key = t.cycle_item_id ?? null;
    byItem.set(key, [...(byItem.get(key) ?? []), t]);
  }
  const net = (id: string | null) => envelopeFlows(byItem.get(id) ?? []).net;
  const unplanned = net(null);

  const lines: ReviewLine[] = items.map((i) => {
    const actual =
      i.kind === "envelope" ? net(i.id) : i.paid ? (i.actual_cents ?? i.planned_cents) : 0;
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

  if (unplanned !== 0) {
    lines.push({ id: null, name: "Unplanned spending", kind: "unplanned", planned: 0, actual: unplanned, difference: unplanned });
  }

  const planned = lines.reduce((s, l) => s + l.planned, 0);
  const actual = lines.reduce((s, l) => s + l.actual, 0);
  return { lines, planned, actual, difference: actual - planned, pocket, leftOver: pocket - actual };
}

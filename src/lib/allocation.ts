import type { Cents } from "./money";
import { parseRandToCents } from "./money";

/** Money that came in but hasn't been given a job yet. Never stored. */
export function readyToAllocate(
  income: readonly { amount_cents: Cents }[],
  allocations: readonly { amount_cents: Cents }[],
): Cents {
  const sum = (rows: readonly { amount_cents: Cents }[]) => rows.reduce((s, r) => s + r.amount_cents, 0);
  return sum(income) - sum(allocations);
}

export type AllocationRow =
  | { cycle_item_id: string; amount_cents: Cents }
  | { reserve_id: string; amount_cents: Cents }
  | { cycle_id: string; amount_cents: Cents };

const TARGET_FIELD = { item: "cycle_item_id", pot: "reserve_id", fund: "cycle_id" } as const;

/**
 * Read the allocation form: one amount field per target, named
 * "item:<uuid>" (top up an item and its cycle's pocket), "pot:<uuid>" (a
 * reserve) or "fund:<uuid>" (a cycle's pocket only, to fund what's already
 * planned). Blank fields are skipped.
 */
export function parseAllocationForm(
  entries: Iterable<[string, FormDataEntryValue]>,
  ready: Cents,
): { ok: true; rows: AllocationRow[]; total: Cents } | { ok: false; message: string } {
  const rows: AllocationRow[] = [];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const [key, value] of entries) {
    const match = /^(item|pot|fund):(.+)$/.exec(key);
    if (!match || typeof value !== "string" || value.trim() === "") continue;
    if (!uuid.test(match[2])) return { ok: false, message: "Something went wrong: refresh the page and try again." };
    const cents = parseRandToCents(value);
    if (cents === null) return { ok: false, message: `"${value}" isn't an amount. Use numbers like 500 or 150.50.` };
    if (cents === 0) continue;
    const field = TARGET_FIELD[match[1] as keyof typeof TARGET_FIELD];
    rows.push({ [field]: match[2], amount_cents: cents } as AllocationRow);
  }
  const total = rows.reduce((s, r) => s + r.amount_cents, 0);
  if (rows.length === 0) return { ok: false, message: "Enter an amount next to at least one item." };
  if (total > ready) return { ok: false, message: "That's more than you have ready to allocate." };
  return { ok: true, rows, total };
}

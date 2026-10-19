import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Backup } from "./backup";

/** Everything the signed-in user owns, in the backup format. */
export async function fetchBackup(supabase: SupabaseClient): Promise<Backup> {
  const q = (table: string, cols: string, order = "created_at") =>
    supabase.from(table).select(cols).order(order).order("id").limit(100000);

  const [settings, recurring, cycles, items, txs, income, reserves, todos] = await Promise.all([
    supabase.from("settings").select("cycle_start_day, bank_balance_cents, bank_balance_on").maybeSingle(),
    q("recurring_items", "id, name, kind, amount_cents, due_day, frequency, interval_months, starts_on, ends_on, category, notes, active, sort_order", "sort_order"),
    q("cycles", "id, name, start_date, end_date, pocket_cents, closed_at, notes", "start_date"),
    q("cycle_items", "id, cycle_id, recurring_item_id, name, kind, category, planned_cents, due_date, paid, paid_on, actual_cents, sort_order"),
    q("transactions", "id, cycle_id, cycle_item_id, amount_cents, date, note", "date"),
    q("income", "id, amount_cents, date, source, notes", "date"),
    q("reserves", "id, name, balance_cents, spendable, notes, sort_order", "sort_order"),
    q("todos", "id, text, done, due_date, sort_order", "sort_order"),
  ]);
  for (const r of [settings, recurring, cycles, items, txs, income, reserves, todos]) {
    if (r.error) throw r.error;
  }

  return {
    app: "money-desk",
    version: 1,
    exported_at: new Date().toISOString(),
    settings: settings.data ?? { cycle_start_day: 23, bank_balance_cents: null, bank_balance_on: null },
    recurring_items: recurring.data as unknown as Backup["recurring_items"],
    cycles: cycles.data as unknown as Backup["cycles"],
    cycle_items: items.data as unknown as Backup["cycle_items"],
    transactions: txs.data as unknown as Backup["transactions"],
    income: income.data as unknown as Backup["income"],
    reserves: reserves.data as unknown as Backup["reserves"],
    todos: todos.data as unknown as Backup["todos"],
  };
}

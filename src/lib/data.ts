import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readyToAllocate } from "./allocation";
import type { HistorySources } from "./history";
import type { RecurringItem } from "./cycles";
import type { ISODate } from "./dates";
import type { CycleItemRow, CycleRow, RecurringItemRow, SettingsRow, TransactionRow } from "./types";

type DB = SupabaseClient;

const SETTINGS_COLS = "id, cycle_start_day, currency, timezone, bank_balance_cents, bank_balance_on";

/** The settings row, created with defaults the first time. */
export async function getSettings(supabase: DB): Promise<SettingsRow> {
  const { data, error } = await supabase.from("settings").select(SETTINGS_COLS).maybeSingle();
  if (error) throw error;
  if (data) return data as SettingsRow;
  const inserted = await supabase.from("settings").upsert({}, { onConflict: "user_id" }).select(SETTINGS_COLS).single();
  if (inserted.error) throw inserted.error;
  return inserted.data as SettingsRow;
}

export async function getCycles(supabase: DB): Promise<CycleRow[]> {
  const { data, error } = await supabase
    .from("cycles")
    .select("id, name, start_date, end_date, pocket_cents, closed_at, notes")
    .order("start_date", { ascending: false });
  if (error) throw error;
  return data as CycleRow[];
}

export async function getCycleCovering(supabase: DB, day: ISODate): Promise<CycleRow | null> {
  const { data, error } = await supabase
    .from("cycles")
    .select("id, name, start_date, end_date, pocket_cents, closed_at, notes")
    .lte("start_date", day)
    .gte("end_date", day)
    .maybeSingle();
  if (error) throw error;
  return data as CycleRow | null;
}

export interface CycleBundle {
  cycle: CycleRow;
  items: CycleItemRow[];
  transactions: TransactionRow[];
}

export async function getCycleBundle(supabase: DB, cycleId: string): Promise<CycleBundle | null> {
  const [cycle, items, txs] = await Promise.all([
    supabase.from("cycles").select("id, name, start_date, end_date, pocket_cents, closed_at, notes").eq("id", cycleId).maybeSingle(),
    supabase
      .from("cycle_items")
      .select("id, cycle_id, recurring_item_id, name, kind, category, planned_cents, due_date, paid, paid_on, actual_cents, sort_order")
      .eq("cycle_id", cycleId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("sort_order"),
    supabase
      .from("transactions")
      .select("id, cycle_id, cycle_item_id, amount_cents, date, note, kind, counterparty, repays_id, created_at")
      .eq("cycle_id", cycleId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  if (cycle.error) throw cycle.error;
  if (items.error) throw items.error;
  if (txs.error) throw txs.error;
  if (!cycle.data) return null;
  return { cycle: cycle.data as CycleRow, items: items.data as CycleItemRow[], transactions: txs.data as TransactionRow[] };
}

/** Items and transactions for many cycles at once (for lists and runway). */
export async function getItemsAndTransactions(supabase: DB, cycleIds: string[]) {
  if (cycleIds.length === 0) return { items: [] as CycleItemRow[], transactions: [] as TransactionRow[] };
  const [items, txs] = await Promise.all([
    supabase
      .from("cycle_items")
      .select("id, cycle_id, recurring_item_id, name, kind, category, planned_cents, due_date, paid, paid_on, actual_cents, sort_order")
      .in("cycle_id", cycleIds),
    supabase.from("transactions").select("id, cycle_id, cycle_item_id, amount_cents, date, note, kind, repays_id").in("cycle_id", cycleIds),
  ]);
  if (items.error) throw items.error;
  if (txs.error) throw txs.error;
  return { items: items.data as CycleItemRow[], transactions: txs.data as TransactionRow[] };
}

export async function getRecurring(supabase: DB): Promise<RecurringItemRow[]> {
  const { data, error } = await supabase
    .from("recurring_items")
    .select("id, name, kind, amount_cents, due_day, frequency, interval_months, starts_on, ends_on, category, notes, active, sort_order")
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return data as RecurringItemRow[];
}

export function asRecurringItems(rows: RecurringItemRow[]): RecurringItem[] {
  return rows;
}

/** The cycle's closed state, for refusing writes to a closed cycle. */
export async function cycleIsOpen(supabase: DB, cycleId: string): Promise<boolean | null> {
  const { data, error } = await supabase.from("cycles").select("closed_at").eq("id", cycleId).maybeSingle();
  if (error || !data) return null;
  return data.closed_at === null;
}

/** Total income minus everything allocated: money still waiting for a job. */
export async function getReadyToAllocate(supabase: DB): Promise<number> {
  const [income, allocations] = await Promise.all([
    supabase.from("income").select("amount_cents"),
    supabase.from("allocations").select("amount_cents"),
  ]);
  if (income.error) throw income.error;
  if (allocations.error) throw allocations.error;
  return readyToAllocate(income.data, allocations.data);
}

/** The first cycle that isn't closed and starts after `after`, if any. */
export async function getNextOpenCycle(supabase: DB, after: ISODate): Promise<CycleRow | null> {
  const { data, error } = await supabase
    .from("cycles")
    .select("id, name, start_date, end_date, pocket_cents, closed_at, notes")
    .gt("start_date", after)
    .is("closed_at", null)
    .order("start_date")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as CycleRow | null;
}

/** All loans and their repayments, across every cycle. */
export async function getLoanEntries(supabase: DB) {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, cycle_id, cycle_item_id, amount_cents, date, note, kind, counterparty, repays_id")
    .or("kind.eq.lend,repays_id.not.is.null");
  if (error) throw error;
  return data as TransactionRow[];
}

/**
 * The cycle you're working in: the one covering today, or, once that is
 * closed, the next open one.
 */
export async function getWorkingCycle(supabase: DB, today: ISODate): Promise<CycleRow | null> {
  const covering = await getCycleCovering(supabase, today);
  if (covering && !covering.closed_at) return covering;
  return getNextOpenCycle(supabase, covering ? covering.end_date : today);
}

/**
 * Everything the history list needs. With a cycleId, only that cycle's
 * spending, bills and allocations to its items (for envelope histories).
 */
export async function getHistorySources(supabase: DB, cycleId?: string): Promise<HistorySources> {
  const itemsQ = supabase.from("cycle_items").select("id, name, cycle_id, kind, paid, paid_on, actual_cents, planned_cents");
  const txQ = supabase
    .from("transactions")
    .select("id, amount_cents, date, note, kind, counterparty, repays_id, cycle_id, cycle_item_id, created_at")
    .order("date", { ascending: false })
    .limit(500);
  const [items, txs, income, allocations, reserves, cycles] = await Promise.all([
    cycleId ? itemsQ.eq("cycle_id", cycleId) : itemsQ,
    cycleId ? txQ.eq("cycle_id", cycleId) : txQ,
    cycleId
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("income").select("id, amount_cents, date, source, notes, created_at").order("date", { ascending: false }).limit(300),
    supabase
      .from("allocations")
      .select("id, amount_cents, date, note, cycle_item_id, reserve_id, cycle_id, created_at")
      .order("date", { ascending: false })
      .limit(300),
    supabase.from("reserves").select("id, name"),
    supabase.from("cycles").select("id, name"),
  ]);
  for (const r of [items, txs, income, allocations, reserves, cycles]) if (r.error) throw r.error;

  const itemRows = items.data ?? [];
  const itemIds = new Set(itemRows.map((i) => i.id));
  return {
    income: income.data ?? [],
    allocations: (allocations.data ?? []).filter((a) => !cycleId || (a.cycle_item_id && itemIds.has(a.cycle_item_id))),
    transactions: txs.data ?? [],
    paidBills: itemRows.filter((i) => i.kind !== "envelope" && i.paid),
    itemNames: new Map(itemRows.map((i) => [i.id, { name: i.name, cycleId: i.cycle_id }])),
    reserveNames: new Map((reserves.data ?? []).map((r) => [r.id, r.name])),
    cycleNames: new Map((cycles.data ?? []).map((c) => [c.id, c.name])),
  };
}

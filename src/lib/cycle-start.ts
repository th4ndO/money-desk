import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type CycleBounds, generateCycleItems, newCycleBounds, plannedTotal, proposeCycleForToday } from "./cycles";
import { asRecurringItems, getCycleCovering, getRecurring, getSettings } from "./data";
import type { ISODate } from "./dates";
import type { CycleRow } from "./types";

type DB = SupabaseClient;

export type CreateResult =
  | { ok: true; cycleId: string; bounds: CycleBounds }
  | { ok: false; reason: "covered" | "failed" };

/**
 * Create the cycle that starts on `start` from the recurring items, in one
 * transaction. The pocket starts at the planned total.
 */
export async function createCycleStarting(supabase: DB, start: ISODate): Promise<CreateResult> {
  const [settings, recurring, existing] = await Promise.all([
    getSettings(supabase),
    getRecurring(supabase),
    supabase.from("cycles").select("start_date, end_date"),
  ]);
  if (existing.error) return { ok: false, reason: "failed" };
  const bounds = newCycleBounds(start, settings.cycle_start_day, existing.data);
  if (!bounds) return { ok: false, reason: "covered" };

  const items = generateCycleItems(asRecurringItems(recurring), bounds.start_date, bounds.end_date);
  const { data, error } = await supabase.rpc("create_cycle", {
    p_name: bounds.name,
    p_start: bounds.start_date,
    p_end: bounds.end_date,
    p_pocket: plannedTotal(items),
    p_items: items,
  });
  if (error) return { ok: false, reason: error.code === "23505" || error.code === "23P01" ? "covered" : "failed" };
  return { ok: true, cycleId: data as string, bounds };
}

/**
 * The cycle covering today, starting it automatically when its day has come
 * and none exists yet. Opening the app twice (or on two devices) at once is
 * safe: the database refuses a second cycle for the same dates, and we then
 * read the one that was created.
 */
export async function ensureCurrentCycle(supabase: DB, today: ISODate): Promise<CycleRow | null> {
  const covering = await getCycleCovering(supabase, today);
  if (covering) return covering;

  const [settings, recurring, existing] = await Promise.all([
    getSettings(supabase),
    getRecurring(supabase),
    supabase.from("cycles").select("start_date, end_date"),
  ]);
  if (existing.error || !recurring.some((r) => r.active)) return null;
  const proposal = proposeCycleForToday(today, settings.cycle_start_day, existing.data);
  if (!proposal) return null;

  await createCycleStarting(supabase, proposal.start_date);
  return getCycleCovering(supabase, today, true);
}

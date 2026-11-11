import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type BankCheck, type BankCheckInput, bankCheck } from "./bank-check";
import { getCycleBundle, getPreviousCycle, getReadyToAllocate, getSettings, leftoverSource } from "./data";
import type { ISODate } from "./dates";
import { summariseCycle } from "./summary";
import type { CycleRow } from "./types";

export interface BankCheckState {
  balance: number | null;
  balanceOn: ISODate | null;
  input: BankCheckInput;
  /** Only when a balance has been entered. */
  check: BankCheck | null;
}

/** Gathers what the app expects to be in the bank while `working` is the cycle in use. */
export async function getBankCheck(supabase: SupabaseClient, working: CycleRow, today: ISODate): Promise<BankCheckState> {
  const [settings, ready, bundle, reserves, later, previous] = await Promise.all([
    getSettings(supabase),
    getReadyToAllocate(supabase),
    getCycleBundle(supabase, working.id),
    supabase.from("reserves").select("balance_cents"),
    supabase.from("cycles").select("id").gt("start_date", working.end_date),
    getPreviousCycle(supabase, working.start_date),
  ]);
  if (reserves.error) throw reserves.error;
  if (later.error) throw later.error;

  const pocketLeft = bundle ? summariseCycle(bundle.cycle, bundle.items, bundle.transactions, today).left : 0;
  const [setAsideAhead, previousLeftover] = await Promise.all([
    allocatedTo(supabase, (later.data ?? []).map((c) => c.id as string)),
    previous ? uncarriedLeftover(supabase, previous, today) : Promise.resolve(0),
  ]);

  const input: BankCheckInput = {
    ready,
    pocketLeft,
    setAsideAhead,
    reserves: (reserves.data ?? []).reduce((s, r) => s + (r.balance_cents as number), 0),
    previousLeftover,
  };
  const balance = settings.bank_balance_cents;
  return {
    balance,
    balanceOn: settings.bank_balance_on,
    input,
    check: balance === null ? null : bankCheck(balance, input, working.name),
  };
}

/** Allocations made to these cycles, directly or to their items. */
async function allocatedTo(supabase: SupabaseClient, cycleIds: string[]): Promise<number> {
  if (cycleIds.length === 0) return 0;
  const items = await supabase.from("cycle_items").select("id").in("cycle_id", cycleIds);
  if (items.error) throw items.error;
  const itemIds = (items.data ?? []).map((i) => i.id as string);
  const [direct, viaItems] = await Promise.all([
    supabase.from("allocations").select("amount_cents").in("cycle_id", cycleIds),
    itemIds.length ? supabase.from("allocations").select("amount_cents").in("cycle_item_id", itemIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (direct.error) throw direct.error;
  if (viaItems.error) throw viaItems.error;
  const sum = (rows: { amount_cents: number }[] | null) => (rows ?? []).reduce((s, r) => s + r.amount_cents, 0);
  return sum(direct.data) + sum(viaItems.data);
}

/** The previous cycle's leftover while it hasn't been carried over (it stays in the bank until then). */
async function uncarriedLeftover(supabase: SupabaseClient, previous: CycleRow, today: ISODate): Promise<number> {
  const [bundle, carried] = await Promise.all([
    getCycleBundle(supabase, previous.id),
    supabase.from("income").select("id", { count: "exact", head: true }).eq("source", leftoverSource(previous.name)),
  ]);
  if (!bundle || (carried.count ?? 0) > 0) return 0;
  return summariseCycle(bundle.cycle, bundle.items, bundle.transactions, today).left;
}

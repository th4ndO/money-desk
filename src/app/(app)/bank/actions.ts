"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionResult, NETWORK_FAIL, fail, ok, parseForm, zMoney } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { FREE_MONEY, UNLOGGED_NOTE, UNRECORDED_SOURCE, checkedToday } from "@/lib/bank-check";
import { getBankCheck } from "@/lib/bank-check-data";
import { getSettings, getWorkingCycle } from "@/lib/data";
import { todayJHB } from "@/lib/dates";
import { formatZAR } from "@/lib/money";

const NO_CYCLE = "Start this cycle first, then check against your bank.";

/** Save what the banking app shows right now. */
export async function saveBankBalance(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ balance: zMoney }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const settings = await getSettings(supabase);
  const { error } = await supabase
    .from("settings")
    .update({ bank_balance_cents: parsed.data.balance, bank_balance_on: todayJHB() })
    .eq("id", settings.id);
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(`Bank balance saved: ${formatZAR(parsed.data.balance)}`);
}

/**
 * Close the gap the check found. The gap is worked out again here rather
 * than taken from the form, so a stale page can't record the wrong amount.
 *  - "ready": record the extra money as income, ready to allocate.
 *  - "free":  the same, then put it all in this cycle's Free money envelope.
 *  - "spent": the bank has less: log the difference as unplanned spending.
 */
export async function settleBankGap(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ mode: z.enum(["ready", "free", "spent"]) }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const today = todayJHB();
  const working = await getWorkingCycle(supabase, today);
  if (!working) return fail(NO_CYCLE);
  const state = await getBankCheck(supabase, working, today);
  if (!state.check || !checkedToday(state.balanceOn, today)) return fail("Enter today's bank balance first.");
  const gap = state.check.gap;
  const mode = parsed.data.mode;

  if (gap === 0) return fail("Your bank already matches. Nothing to do.");
  if (mode === "spent" ? gap > 0 : gap < 0) return fail("The numbers changed. Refresh the page and look again.");

  if (mode === "spent") {
    const date = today < working.start_date ? working.start_date : today > working.end_date ? working.end_date : today;
    const { error } = await supabase.from("transactions").insert({
      cycle_id: working.id,
      cycle_item_id: null,
      amount_cents: -gap,
      date,
      note: UNLOGGED_NOTE,
      kind: "spend",
    });
    if (error) return fail(NETWORK_FAIL);
    refresh();
    return ok(`Logged ${formatZAR(-gap)} as unplanned spending. Your bank and Money Desk now match.`);
  }

  const income = await supabase
    .from("income")
    .insert({ amount_cents: gap, date: today, source: UNRECORDED_SOURCE, notes: "Found when checking against the bank balance" });
  if (income.error) return fail(NETWORK_FAIL);

  if (mode === "ready") {
    refresh();
    return ok(`${formatZAR(gap)} is now ready to allocate`);
  }

  const envelopeId = await freeMoneyEnvelope(supabase, working.id);
  const allocated =
    envelopeId &&
    (await supabase.rpc("allocate", {
      p_date: today,
      p_note: "Bank check",
      p_rows: [{ cycle_item_id: envelopeId, amount_cents: gap }],
    }));
  refresh();
  if (!allocated || allocated.error) {
    return fail(`${formatZAR(gap)} was added to Ready to allocate, but couldn't go into ${FREE_MONEY}. Allocate it from there.`);
  }
  return ok(`${formatZAR(gap)} is in your ${FREE_MONEY} envelope`);
}

/** This cycle's Free money envelope, made the first time it's needed. */
async function freeMoneyEnvelope(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], cycleId: string) {
  const found = await supabase
    .from("cycle_items")
    .select("id")
    .eq("cycle_id", cycleId)
    .eq("kind", "envelope")
    .eq("name", FREE_MONEY)
    .limit(1)
    .maybeSingle();
  if (found.data) return found.data.id as string;
  const made = await supabase
    .from("cycle_items")
    .insert({ cycle_id: cycleId, name: FREE_MONEY, kind: "envelope", planned_cents: 0, due_date: null, sort_order: 999 })
    .select("id")
    .single();
  return made.error ? null : (made.data.id as string);
}

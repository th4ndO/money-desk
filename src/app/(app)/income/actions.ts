"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionResult, NETWORK_FAIL, fail, ok, parseForm, zDate, zId, zMoney, zOptionalText, zPositiveMoney } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { formatZAR } from "@/lib/money";

const incomeSchema = z.object({
  amount: zPositiveMoney,
  date: zDate,
  source: z.string().trim().min(1, "Say where it came from.").max(200),
  notes: zOptionalText(1000),
});

export async function logIncome(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(incomeSchema, fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("income").insert({
    amount_cents: parsed.data.amount,
    date: parsed.data.date,
    source: parsed.data.source,
    notes: parsed.data.notes,
  });
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(`Recorded ${formatZAR(parsed.data.amount)} from ${parsed.data.source}`);
}

export async function updateIncome(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(incomeSchema.extend({ id: zId }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("income")
    .update({ amount_cents: parsed.data.amount, date: parsed.data.date, source: parsed.data.source, notes: parsed.data.notes })
    .eq("id", parsed.data.id);
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok("Saved");
}

export async function deleteIncome(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: zId }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("income").delete().eq("id", parsed.data.id);
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok("Deleted");
}

export async function setBalance(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ balance: zMoney, on: zDate }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const settings = await getSettings(supabase);
  const { error } = await supabase
    .from("settings")
    .update({ bank_balance_cents: parsed.data.balance, bank_balance_on: parsed.data.on })
    .eq("id", settings.id);
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(`Balance set to ${formatZAR(parsed.data.balance)}`);
}

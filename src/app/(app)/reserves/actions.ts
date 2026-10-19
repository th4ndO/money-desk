"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionResult, NETWORK_FAIL, fail, ok, parseForm, zCheckbox, zId, zMoney, zOptionalText } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { formatZAR } from "@/lib/money";

const reserveSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Give it a name.").max(100),
  balance: zMoney,
  spendable: zCheckbox,
  notes: zOptionalText(1000),
});

export async function saveReserve(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(reserveSchema, fd);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const { supabase } = await requireUser();
  const row = { name: v.name, balance_cents: v.balance, spendable: v.spendable, notes: v.notes };

  if (v.id) {
    const id = zId.safeParse(v.id);
    if (!id.success) return fail("Something went wrong: refresh the page and try again.");
    const { error } = await supabase.from("reserves").update(row).eq("id", id.data);
    if (error) return fail(NETWORK_FAIL);
    refresh();
    return ok(`${v.name}: ${formatZAR(v.balance)}`);
  }
  const { data: last } = await supabase.from("reserves").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("reserves").insert({ ...row, sort_order: (last?.sort_order ?? -1) + 1 });
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(`Added ${v.name}`);
}

export async function deleteReserve(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: zId }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("reserves").delete().eq("id", parsed.data.id);
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok("Deleted");
}

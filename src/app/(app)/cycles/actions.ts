"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  type ActionResult,
  NETWORK_FAIL,
  fail,
  ok,
  parseForm,
  zDate,
  zId,
  zMoney,
  zOptionalDate,
  zOptionalText,
  zPositiveMoney,
} from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { generateCycleItems, newCycleBounds, plannedTotal } from "@/lib/cycles";
import { asRecurringItems, cycleIsOpen, getRecurring, getSettings } from "@/lib/data";
import { formatDate, todayJHB } from "@/lib/dates";
import { formatZAR } from "@/lib/money";

const CLOSED = "This cycle is closed. Reopen it to make changes.";

async function openOrFail(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], cycleId: string) {
  const open = await cycleIsOpen(supabase, cycleId);
  if (open === null) return fail("That cycle no longer exists. Refresh the page.");
  if (!open) return fail(CLOSED);
  return null;
}

/* Start a cycle ----------------------------------------------------------- */

export async function startCycle(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ start_date: zDate, go: z.string().optional() }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();

  const [settings, recurring, existing] = await Promise.all([
    getSettings(supabase),
    getRecurring(supabase),
    supabase.from("cycles").select("start_date, end_date"),
  ]);
  if (existing.error) return fail(NETWORK_FAIL);

  const bounds = newCycleBounds(parsed.data.start_date, settings.cycle_start_day, existing.data);
  if (!bounds) return fail("A cycle already covers that date.");

  const items = generateCycleItems(asRecurringItems(recurring), bounds.start_date, bounds.end_date);
  const { data: cycleId, error } = await supabase.rpc("create_cycle", {
    p_name: bounds.name,
    p_start: bounds.start_date,
    p_end: bounds.end_date,
    p_pocket: plannedTotal(items),
    p_items: items,
  });
  if (error) {
    return fail(error.code === "23505" || error.code === "23P01" ? "A cycle already covers those dates." : NETWORK_FAIL);
  }

  if (parsed.data.go === "detail") redirect(`/cycles/${cycleId}`);
  refresh();
  return ok(`Started ${bounds.name}`);
}

/* Bills ------------------------------------------------------------------- */

export async function setPaid(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: zId, paid: z.enum(["true", "false"]) }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();

  const { data: item } = await supabase
    .from("cycle_items")
    .select("id, cycle_id, name, kind, planned_cents, actual_cents")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!item || item.kind === "envelope") return fail("That item can't be ticked. Refresh the page.");
  const closed = await openOrFail(supabase, item.cycle_id);
  if (closed) return closed;

  const paid = parsed.data.paid === "true";
  const { error } = await supabase
    .from("cycle_items")
    .update(
      paid
        ? { paid: true, paid_on: todayJHB(), actual_cents: item.actual_cents ?? item.planned_cents }
        : { paid: false, paid_on: null, actual_cents: null },
    )
    .eq("id", item.id);
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(paid ? `${item.name} paid` : `${item.name} marked not paid`);
}

export async function updateItem(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(
    z.object({
      id: zId,
      name: z.string().trim().min(1, "Give it a name.").max(100),
      planned: zMoney,
      actual: z.string().optional(),
      due_date: zOptionalDate.optional(),
    }),
    fd,
  );
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();

  const { data: item } = await supabase.from("cycle_items").select("id, cycle_id, kind, paid").eq("id", parsed.data.id).maybeSingle();
  if (!item) return fail("That item no longer exists. Refresh the page.");
  const closed = await openOrFail(supabase, item.cycle_id);
  if (closed) return closed;

  const update: Record<string, unknown> = { name: parsed.data.name, planned_cents: parsed.data.planned };
  if (item.kind !== "envelope" && parsed.data.due_date !== undefined) update.due_date = parsed.data.due_date;
  if (item.paid && parsed.data.actual !== undefined) {
    const actual = zMoney.safeParse(parsed.data.actual);
    if (!actual.success) return fail("Enter the amount actually paid, like 229 or 113.21.");
    update.actual_cents = actual.data;
  }
  const { error } = await supabase.from("cycle_items").update(update).eq("id", item.id);
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(`Saved ${parsed.data.name}`);
}

export async function addOneOff(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(
    z.object({
      cycle_id: zId,
      name: z.string().trim().min(1, "Give it a name.").max(100),
      kind: z.enum(["bill", "envelope", "saving"]),
      amount: zMoney,
      due_date: zOptionalDate,
    }),
    fd,
  );
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const closed = await openOrFail(supabase, parsed.data.cycle_id);
  if (closed) return closed;

  const { data: cycle } = await supabase.from("cycles").select("start_date, end_date").eq("id", parsed.data.cycle_id).single();
  const due = parsed.data.kind === "envelope" ? null : parsed.data.due_date;
  if (due && cycle && (due < cycle.start_date || due > cycle.end_date)) {
    return fail(`The due date must be between ${formatDate(cycle.start_date)} and ${formatDate(cycle.end_date)}.`);
  }

  const { error } = await supabase.from("cycle_items").insert({
    cycle_id: parsed.data.cycle_id,
    name: parsed.data.name,
    kind: parsed.data.kind,
    planned_cents: parsed.data.amount,
    due_date: due,
    sort_order: 1000,
  });
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(`Added ${parsed.data.name} to this cycle`);
}

export async function deleteItem(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: zId }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const { data: item } = await supabase.from("cycle_items").select("id, cycle_id, name").eq("id", parsed.data.id).maybeSingle();
  if (!item) return fail("That item no longer exists. Refresh the page.");
  const closed = await openOrFail(supabase, item.cycle_id);
  if (closed) return closed;
  const { error } = await supabase.from("cycle_items").delete().eq("id", item.id);
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(`Removed ${item.name} from this cycle`);
}

/* Spending ---------------------------------------------------------------- */

const spendSchema = z.object({
  cycle_id: zId,
  cycle_item_id: z.string().transform((s) => (s === "" ? null : s)).pipe(zId.nullable()),
  amount: zPositiveMoney,
  date: zOptionalDate,
  note: zOptionalText(200),
});

async function checkSpend(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  data: z.infer<typeof spendSchema>,
): Promise<{ error: ActionResult } | { date: string; envelope: string }> {
  const { data: cycle } = await supabase
    .from("cycles")
    .select("start_date, end_date, closed_at")
    .eq("id", data.cycle_id)
    .maybeSingle();
  if (!cycle) return { error: fail("That cycle no longer exists. Refresh the page.") };
  if (cycle.closed_at) return { error: fail(CLOSED) };

  const today = todayJHB();
  const date = data.date ?? (today > cycle.end_date ? cycle.end_date : today < cycle.start_date ? cycle.start_date : today);
  if (date < cycle.start_date || date > cycle.end_date) {
    return { error: fail(`Pick a date between ${formatDate(cycle.start_date)} and ${formatDate(cycle.end_date)}.`) };
  }

  let envelope = "unplanned";
  if (data.cycle_item_id) {
    const { data: item } = await supabase
      .from("cycle_items")
      .select("name, kind, cycle_id")
      .eq("id", data.cycle_item_id)
      .maybeSingle();
    if (!item || item.kind !== "envelope" || item.cycle_id !== data.cycle_id) {
      return { error: fail("Pick an envelope from this cycle.") };
    }
    envelope = item.name;
  }
  return { date, envelope };
}

export async function logSpending(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(spendSchema, fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const check = await checkSpend(supabase, parsed.data);
  if ("error" in check) return check.error;

  const { error } = await supabase.from("transactions").insert({
    cycle_id: parsed.data.cycle_id,
    cycle_item_id: parsed.data.cycle_item_id,
    amount_cents: parsed.data.amount,
    date: check.date,
    note: parsed.data.note,
  });
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(`Logged ${formatZAR(parsed.data.amount)} to ${check.envelope}`);
}

export async function updateTransaction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(spendSchema.extend({ id: zId }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const check = await checkSpend(supabase, parsed.data);
  if ("error" in check) return check.error;

  const { error } = await supabase
    .from("transactions")
    .update({
      cycle_item_id: parsed.data.cycle_item_id,
      amount_cents: parsed.data.amount,
      date: check.date,
      note: parsed.data.note,
    })
    .eq("id", parsed.data.id)
    .eq("cycle_id", parsed.data.cycle_id);
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok("Saved");
}

export async function deleteTransaction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: zId }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const { data: tx } = await supabase.from("transactions").select("id, cycle_id, amount_cents").eq("id", parsed.data.id).maybeSingle();
  if (!tx) return fail("That entry no longer exists. Refresh the page.");
  const closed = await openOrFail(supabase, tx.cycle_id);
  if (closed) return closed;
  const { error } = await supabase.from("transactions").delete().eq("id", tx.id);
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(`Deleted ${formatZAR(tx.amount_cents)} spend`);
}

/* The cycle itself -------------------------------------------------------- */

export async function updateCycle(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: zId, pocket: zMoney, notes: zOptionalText(2000) }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const closed = await openOrFail(supabase, parsed.data.id);
  if (closed) return closed;
  const { error } = await supabase
    .from("cycles")
    .update({ pocket_cents: parsed.data.pocket, notes: parsed.data.notes })
    .eq("id", parsed.data.id);
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(`Pocket set to ${formatZAR(parsed.data.pocket)}`);
}

export async function closeCycle(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: zId }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("cycles").update({ closed_at: new Date().toISOString() }).eq("id", parsed.data.id);
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok("Cycle closed");
}

export async function reopenCycle(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: zId }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("cycles").update({ closed_at: null }).eq("id", parsed.data.id);
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok("Cycle reopened");
}

export async function deleteCycle(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: zId }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const closed = await openOrFail(supabase, parsed.data.id);
  if (closed) return closed;
  const { error } = await supabase.from("cycles").delete().eq("id", parsed.data.id);
  if (error) return fail(NETWORK_FAIL);
  redirect("/cycles");
}

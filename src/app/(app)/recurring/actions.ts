"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  type ActionResult,
  NETWORK_FAIL,
  fail,
  ok,
  parseForm,
  zCheckbox,
  zDate,
  zId,
  zMoney,
  zOptionalDate,
  zOptionalText,
} from "@/lib/actions";
import { requireUser } from "@/lib/auth";

const optionalInt = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : Number(s)))
    .refine((n) => n === null || (Number.isInteger(n) && n >= min && n <= max), message);

const recurringSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Give it a name.").max(100),
    kind: z.enum(["bill", "envelope", "saving"]),
    amount: zMoney,
    due_day: optionalInt(1, 31, "Due day must be 1–31."),
    frequency: z.enum(["monthly", "once", "every_n_months"]),
    interval_months: optionalInt(2, 24, "Repeat every 2–24 months."),
    starts_on: zDate,
    ends_on: zOptionalDate,
    category: zOptionalText(50),
    notes: zOptionalText(1000),
    active: zCheckbox,
  })
  .superRefine((v, ctx) => {
    if (v.kind !== "envelope" && v.frequency !== "once" && v.due_day === null)
      ctx.addIssue({ code: "custom", message: "Bills and savings need a due day (1–31)." });
    if (v.frequency === "every_n_months" && v.interval_months === null)
      ctx.addIssue({ code: "custom", message: "Say how many months between payments." });
    if (v.ends_on && v.ends_on < v.starts_on)
      ctx.addIssue({ code: "custom", message: "The end date must be on or after the start date." });
  });

export async function saveRecurring(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(recurringSchema, fd);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const { supabase } = await requireUser();

  const row = {
    name: v.name,
    kind: v.kind,
    amount_cents: v.amount,
    due_day: v.kind === "envelope" && v.frequency !== "once" ? null : v.due_day,
    frequency: v.frequency,
    interval_months: v.frequency === "every_n_months" ? v.interval_months : null,
    starts_on: v.starts_on,
    ends_on: v.ends_on,
    category: v.category,
    notes: v.notes,
    active: v.active,
  };

  if (v.id) {
    const id = zId.safeParse(v.id);
    if (!id.success) return fail("Something went wrong: refresh the page and try again.");
    const { error } = await supabase.from("recurring_items").update(row).eq("id", id.data);
    if (error) return fail(NETWORK_FAIL);
    refresh();
    return ok(`Saved ${v.name}. Applies to cycles you start from now on.`);
  }

  const { data: last } = await supabase
    .from("recurring_items")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("recurring_items").insert({ ...row, sort_order: (last?.sort_order ?? -1) + 1 });
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(`Added ${v.name}`);
}

export async function setRecurringActive(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: zId, active: z.enum(["true", "false"]) }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const active = parsed.data.active === "true";
  const { data, error } = await supabase
    .from("recurring_items")
    .update({ active })
    .eq("id", parsed.data.id)
    .select("name")
    .single();
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(active ? `${data.name} switched on` : `${data.name} switched off`);
}

export async function moveRecurring(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: zId, direction: z.enum(["up", "down"]) }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const { data: all, error } = await supabase
    .from("recurring_items")
    .select("id, kind, sort_order")
    .order("sort_order")
    .order("created_at");
  if (error || !all) return fail(NETWORK_FAIL);

  const index = all.findIndex((r) => r.id === parsed.data.id);
  if (index < 0) return fail("That item no longer exists. Refresh the page.");
  const step = parsed.data.direction === "up" ? -1 : 1;
  let other = index + step;
  while (other >= 0 && other < all.length && all[other].kind !== all[index].kind) other += step;
  if (other < 0 || other >= all.length) return ok("Already at the end");

  [all[index], all[other]] = [all[other], all[index]];
  const results = await Promise.all(
    all
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => r.sort_order !== i)
      .map(({ r, i }) => supabase.from("recurring_items").update({ sort_order: i }).eq("id", r.id)),
  );
  if (results.some((r) => r.error)) return fail(NETWORK_FAIL);
  refresh();
  return ok("Moved");
}

export async function deleteRecurring(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: zId }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("recurring_items").delete().eq("id", parsed.data.id).select("name").single();
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(`Deleted ${data.name}. Existing cycles keep their copy.`);
}

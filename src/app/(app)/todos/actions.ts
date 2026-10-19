"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionResult, NETWORK_FAIL, fail, ok, parseForm, zId, zOptionalDate } from "@/lib/actions";
import { requireUser } from "@/lib/auth";

export async function addTodo(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ text: z.string().trim().min(1, "Write something to do.").max(300), due_date: zOptionalDate }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const { data: last } = await supabase.from("todos").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase
    .from("todos")
    .insert({ text: parsed.data.text, due_date: parsed.data.due_date, sort_order: (last?.sort_order ?? -1) + 1 });
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok("Added");
}

export async function setTodoDone(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: zId, paid: z.enum(["true", "false"]) }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const done = parsed.data.paid === "true";
  const { error } = await supabase.from("todos").update({ done }).eq("id", parsed.data.id);
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(done ? "Done" : "Moved back to to-do");
}

export async function deleteTodo(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: zId }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("todos").delete().eq("id", parsed.data.id);
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok("Deleted");
}

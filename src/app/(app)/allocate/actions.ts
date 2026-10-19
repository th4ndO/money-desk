"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionResult, NETWORK_FAIL, fail, ok, parseForm, zId } from "@/lib/actions";
import { parseAllocationForm } from "@/lib/allocation";
import { requireUser } from "@/lib/auth";
import { getReadyToAllocate } from "@/lib/data";
import { isISODate, todayJHB } from "@/lib/dates";
import { formatZAR } from "@/lib/money";

function friendly(code: string | undefined) {
  if (code === "P0001") return "That's more than you have ready to allocate. Refresh and try again.";
  if (code === "P0003") return "That cycle is closed. Reopen it first.";
  if (code === "23514") return "Can't undo: the amount has since been lowered below what this allocation added.";
  if (code === "P0002") return "Something it points at no longer exists. Refresh the page.";
  return NETWORK_FAIL;
}

export async function allocateMoney(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const ready = await getReadyToAllocate(supabase);
  const parsed = parseAllocationForm(fd.entries(), ready);
  if (!parsed.ok) return fail(parsed.message);

  const note = String(fd.get("note") ?? "").trim().slice(0, 200);
  const dateRaw = String(fd.get("date") ?? "");
  const date = isISODate(dateRaw) ? dateRaw : todayJHB();

  const { error } = await supabase.rpc("allocate", { p_date: date, p_note: note, p_rows: parsed.rows });
  if (error) return fail(friendly(error.code));
  refresh();
  return ok(`Allocated ${formatZAR(parsed.total)}. ${formatZAR(ready - parsed.total)} left to allocate.`);
}

export async function undoAllocation(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(z.object({ id: zId }), fd);
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("unallocate", { p_id: parsed.data.id });
  if (error) return fail(friendly(error.code));
  refresh();
  return ok("Undone. The money is back in Ready to allocate.");
}

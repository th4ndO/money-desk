"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionResult, NETWORK_FAIL, fail, ok, parseForm } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { backupCounts, parseBackup } from "@/lib/backup";
import { getSettings } from "@/lib/data";
import { todayJHB } from "@/lib/dates";
import { buildSeedBackup } from "@/lib/seed-data";

export async function saveStartDay(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(
    z.object({ cycle_start_day: z.coerce.number().int().min(1, "Pick a day from 1 to 28.").max(28, "Pick a day from 1 to 28.") }),
    fd,
  );
  if (!parsed.ok) return parsed.result;
  const { supabase } = await requireUser();
  const settings = await getSettings(supabase);
  const { error } = await supabase.from("settings").update({ cycle_start_day: parsed.data.cycle_start_day }).eq("id", settings.id);
  if (error) return fail(NETWORK_FAIL);
  refresh();
  return ok(`New cycles will start on day ${parsed.data.cycle_start_day}`);
}

export async function loadStartingData(): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const [recurring, cycles] = await Promise.all([
    supabase.from("recurring_items").select("id", { count: "exact", head: true }),
    supabase.from("cycles").select("id", { count: "exact", head: true }),
  ]);
  if (recurring.error || cycles.error) return fail(NETWORK_FAIL);
  if ((recurring.count ?? 0) > 0 || (cycles.count ?? 0) > 0) {
    return fail("You already have data, so the starting data wasn't loaded. Nothing was changed.");
  }
  const { error } = await supabase.rpc("import_all", { p: buildSeedBackup(todayJHB()) });
  if (error) return fail(`Couldn't load the starting data: ${error.message}`);
  refresh();
  return ok("Loaded your starting data: 3 cycles, 19 recurring items, 2 reserves, 5 to-dos");
}

export async function importBackup(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const json = fd.get("backup");
  if (typeof json !== "string" || json.length === 0) return fail("Choose a backup file first.");
  if (fd.get("confirm") !== "REPLACE") return fail("Type REPLACE to confirm.");
  const parsed = parseBackup(json);
  if (!parsed.ok) return fail(parsed.error);

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("import_all", { p: parsed.backup });
  if (error) return fail(`Import failed and nothing was changed: ${error.message}`);
  refresh();
  const c = backupCounts(parsed.backup);
  return ok(`Restored ${c.cycles} cycles, ${c.transactions} spends, ${c.income} income entries`);
}

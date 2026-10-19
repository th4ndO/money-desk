import { BACKUP_TABLES, type BackupTable, toCSV } from "@/lib/backup";
import { todayJHB } from "@/lib/dates";
import { fetchBackup } from "@/lib/export";
import { routeUser } from "@/lib/route-auth";

export async function GET(_req: Request, ctx: RouteContext<"/export/csv/[table]">) {
  const { table } = await ctx.params;
  if (!(BACKUP_TABLES as readonly string[]).includes(table)) return new Response("Unknown table", { status: 404 });
  const supabase = await routeUser();
  if (!supabase) return new Response("Not signed in", { status: 401 });
  const backup = await fetchBackup(supabase);
  // A byte-order mark so Excel opens it as UTF-8.
  return new Response("﻿" + toCSV(backup[table as BackupTable] as Record<string, unknown>[]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="money-desk-${table}-${todayJHB()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

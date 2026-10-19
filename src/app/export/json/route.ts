import { todayJHB } from "@/lib/dates";
import { fetchBackup } from "@/lib/export";
import { routeUser } from "@/lib/route-auth";

export async function GET() {
  const supabase = await routeUser();
  if (!supabase) return new Response("Not signed in", { status: 401 });
  const backup = await fetchBackup(supabase);
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="money-desk-${todayJHB()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

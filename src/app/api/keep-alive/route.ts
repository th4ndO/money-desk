import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Called once a day by Vercel Cron (see vercel.json) so the free Supabase
 * database sees activity and isn't paused for being idle. It makes one
 * anonymous query, which Row Level Security refuses: no data is read or
 * returned, but the database still had to answer.
 */
export async function GET() {
  try {
    const res = await fetch(`${supabaseUrl()}/rest/v1/settings?select=id&limit=1`, {
      headers: { apikey: supabaseAnonKey(), Authorization: `Bearer ${supabaseAnonKey()}` },
      cache: "no-store",
    });
    const awake = res.status < 500;
    return Response.json({ awake }, { status: awake ? 200 : 503 });
  } catch {
    return Response.json({ awake: false }, { status: 503 });
  }
}

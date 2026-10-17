import { signOut } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { formatDate, todayJHB } from "@/lib/dates";

// Phase 1 placeholder: proves the session, the email check and RLS-backed
// reads work. Phase 2 replaces this with the dashboard.
export default async function Home() {
  const { supabase, user } = await requireUser();
  const { data: settings, error } = await supabase.from("settings").select("cycle_start_day").maybeSingle();

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Money Desk</h1>
      <div className="notice space-y-1">
        <p>Signed in as <strong className="break-all">{user.email}</strong>.</p>
        <p>Today in Johannesburg: {formatDate(todayJHB())}.</p>
        <p className="text-muted">
          {error
            ? `Database check failed: ${error.message}`
            : `Database reachable. Settings row: ${settings ? `cycle starts on day ${settings.cycle_start_day}` : "not created yet"}.`}
        </p>
      </div>
      <p className="text-muted">The dashboard arrives in Phase 2.</p>
      <form action={signOut}>
        <button type="submit" className="btn btn-quiet px-0">Sign out</button>
      </form>
    </main>
  );
}

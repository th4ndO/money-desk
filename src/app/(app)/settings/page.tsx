import { signOut } from "@/app/actions";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { BACKUP_TABLES } from "@/lib/backup";
import { getSettings } from "@/lib/data";
import { ImportForm, LoadStartingData, StartDayForm } from "./forms";

export const metadata = { title: "Settings" };

const CSV_LABELS: Record<string, string> = {
  recurring_items: "Recurring items",
  cycles: "Cycles",
  cycle_items: "Cycle items",
  transactions: "Spending",
  income: "Income",
  reserves: "Reserves",
  todos: "To-dos",
};

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  const [settings, recurring, cycles] = await Promise.all([
    getSettings(supabase),
    supabase.from("recurring_items").select("id", { count: "exact", head: true }),
    supabase.from("cycles").select("id", { count: "exact", head: true }),
  ]);
  const empty = (recurring.count ?? 0) === 0 && (cycles.count ?? 0) === 0;

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" subtitle={<>Signed in as <span className="break-all">{user.email}</span></>} />

      {empty && (
        <section className="card space-y-3" aria-labelledby="start-title">
          <h2 id="start-title" className="font-semibold">Starting data</h2>
          <p className="text-sm text-muted">
            Loads your recurring bills, envelopes and savings, the October, November and December 2026 cycles (R9 745
            each), your two reserves and five to-dos. Only works while Money Desk is empty.
          </p>
          <LoadStartingData />
        </section>
      )}

      <section className="card space-y-3" aria-labelledby="cycle-title">
        <h2 id="cycle-title" className="font-semibold">Cycles</h2>
        <StartDayForm day={settings.cycle_start_day} />
        <p className="text-sm text-muted">
          Applies to cycles you start from now on. Days 29–31 aren&apos;t offered so every monthly bill lands exactly once
          per cycle. Times and dates use Johannesburg time.
        </p>
      </section>

      <section className="card space-y-3" aria-labelledby="export-title">
        <h2 id="export-title" className="font-semibold">Back up</h2>
        <p className="text-sm text-muted">The JSON file holds everything and can be restored below. Download one now and then.</p>
        <a href="/export/json" className="btn btn-primary" download>Download full backup (JSON)</a>
        <details>
          <summary className="text-sm text-muted hover:text-text">Spreadsheet files (CSV)</summary>
          <ul className="mt-2 space-y-1">
            {BACKUP_TABLES.map((t) => (
              <li key={t}><a href={`/export/csv/${t}`} className="link" download>{CSV_LABELS[t]}</a></li>
            ))}
          </ul>
        </details>
      </section>

      <section className="card space-y-3" aria-labelledby="import-title">
        <h2 id="import-title" className="font-semibold">Restore from a backup</h2>
        <ImportForm />
      </section>

      <form action={signOut}>
        <button type="submit" className="btn btn-secondary">Sign out</button>
      </form>
    </div>
  );
}

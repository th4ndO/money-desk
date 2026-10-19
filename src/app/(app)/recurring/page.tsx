import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";
import { requireUser } from "@/lib/auth";
import { generateCycleItems, plannedTotal, proposeNextCycle } from "@/lib/cycles";
import { asRecurringItems, getCycles, getRecurring, getSettings } from "@/lib/data";
import { formatDate, todayJHB } from "@/lib/dates";
import type { RecurringItemRow } from "@/lib/types";
import { RecurringControls, RecurringForm } from "./RecurringForm";

export const metadata = { title: "Recurring" };

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function schedule(r: RecurringItemRow): string {
  const day = r.due_day ? ` on the ${ordinal(r.due_day)}` : "";
  if (r.frequency === "once") return `Once, ${formatDate(r.starts_on)}`;
  const base = r.frequency === "monthly" ? `Monthly${day}` : `Every ${r.interval_months} months${day}`;
  return r.kind === "envelope" && r.frequency === "monthly" ? "Every cycle" : base;
}

const GROUPS = [
  { kind: "bill", title: "Bills and debit orders" },
  { kind: "saving", title: "Savings" },
  { kind: "envelope", title: "Spending envelopes" },
] as const;

export default async function RecurringPage() {
  const { supabase } = await requireUser();
  const today = todayJHB();
  const [settings, rows, cycles] = await Promise.all([getSettings(supabase), getRecurring(supabase), getCycles(supabase)]);
  const next = proposeNextCycle(today, settings.cycle_start_day, cycles);
  const nextTotal = next ? plannedTotal(generateCycleItems(asRecurringItems(rows), next.start_date, next.end_date)) : 0;

  return (
    <div className="space-y-8">
      <PageHeader title="Recurring" subtitle="The template every new cycle is copied from." />
      <p className="notice text-sm">
        Changes here apply to cycles you start from now on. Cycles that already exist keep their own copy. Edit those on
        the cycle itself.
        {next && (
          <>
            {" "}The next cycle, {next.name}, would plan <Money cents={nextTotal} />.
          </>
        )}
      </p>

      {GROUPS.map((g) => {
        const items = rows.filter((r) => r.kind === g.kind);
        return (
          <section key={g.kind} aria-labelledby={`g-${g.kind}`}>
            <h2 id={`g-${g.kind}`} className="section-title mb-1">{g.title}</h2>
            {items.length === 0 ? (
              <p className="py-2 text-muted">None yet.</p>
            ) : (
              <ul>
                {items.map((r) => (
                  <li key={r.id} className="row block">
                    <details>
                      <summary className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className={`truncate font-medium ${r.active ? "" : "text-muted"}`}>{r.name}</p>
                          <p className="text-sm text-muted">
                            {schedule(r)}
                            {r.ends_on && ` · ends ${formatDate(r.ends_on)}`}
                            {r.starts_on > today && r.frequency !== "once" && ` · from ${formatDate(r.starts_on)}`}
                          </p>
                        </div>
                        {!r.active && <Pill tone="neutral">Off</Pill>}
                        <Money cents={r.amount_cents} className={r.active ? "" : "text-muted"} />
                      </summary>
                      <div className="mt-4 space-y-4">
                        <RecurringControls item={r} />
                        <RecurringForm item={r} today={today} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <section className="card" aria-labelledby="add-title">
        <h2 id="add-title" className="mb-4 font-semibold">Add a recurring item</h2>
        <RecurringForm today={today} />
      </section>
    </div>
  );
}

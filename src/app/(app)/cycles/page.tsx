import Link from "next/link";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";
import { StartCycleButton } from "@/components/StartCycleButton";
import { requireUser } from "@/lib/auth";
import { proposeNextCycle } from "@/lib/cycles";
import { getCycles, getItemsAndTransactions, getSettings } from "@/lib/data";
import { formatShortDate, todayJHB } from "@/lib/dates";
import { cycleStatus, healthTone, summariseCycle } from "@/lib/summary";

export const metadata = { title: "Cycles" };

const STATUS_LABEL = { planned: "Planned", active: "Current", ended: "Ended", closed: "Closed" } as const;

export default async function CyclesPage() {
  const { supabase } = await requireUser();
  const today = todayJHB();
  const [settings, cycles] = await Promise.all([getSettings(supabase), getCycles(supabase)]);
  const { items, transactions } = await getItemsAndTransactions(supabase, cycles.map((c) => c.id));
  const next = proposeNextCycle(today, settings.cycle_start_day, cycles);

  return (
    <div>
      <PageHeader title="Cycles" subtitle="Each cycle is funded from money you already have.">
        {next && <StartCycleButton start={next.start_date} label={`Start ${next.name.split(" ")[0]} cycle`} goToDetail />}
      </PageHeader>
      {cycles.length === 0 ? (
        <p className="text-muted">No cycles yet.</p>
      ) : (
        <ul className="space-y-3">
          {cycles.map((c) => {
            const s = summariseCycle(
              c,
              items.filter((i) => i.cycle_id === c.id),
              transactions.filter((t) => t.cycle_id === c.id),
              today,
            );
            const status = cycleStatus(c, today);
            return (
              <li key={c.id}>
                <Link href={`/cycles/${c.id}`} className="card block hover:border-accent">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-sm text-muted">{formatShortDate(c.start_date)} – {formatShortDate(c.end_date)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Pill tone={status === "active" ? "accent" : "neutral"}>{STATUS_LABEL[status]}</Pill>
                      {status !== "closed" && status !== "planned" && <Pill tone={healthTone(s.health)}>{s.health}</Pill>}
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div><dt className="text-muted">Planned</dt><dd><Money cents={s.planned} /></dd></div>
                    <div><dt className="text-muted">Spent</dt><dd><Money cents={s.spent} /></dd></div>
                    <div><dt className="text-muted">Left</dt><dd><Money cents={s.left} signed /></dd></div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

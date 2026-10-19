import Link from "next/link";
import { BillRow } from "@/components/BillRow";
import { EnvelopeBars } from "@/components/EnvelopeBars";
import { LogSpendForm } from "@/components/LogSpendForm";
import { Money } from "@/components/Money";
import { Pill } from "@/components/Pill";
import { StartCycleButton } from "@/components/StartCycleButton";
import { requireUser } from "@/lib/auth";
import { generateCycleItems, plannedTotal, proposeCycleForToday } from "@/lib/cycles";
import { asRecurringItems, getCycleBundle, getCycleCovering, getRecurring, getSettings } from "@/lib/data";
import { formatDate, formatShortDate, todayJHB } from "@/lib/dates";
import { healthTone, summariseCycle } from "@/lib/summary";

export const metadata = { title: "Today" };

export default async function Dashboard() {
  const { supabase } = await requireUser();
  const today = todayJHB();
  const current = await getCycleCovering(supabase, today);

  if (!current) return <NoCycle today={today} />;

  const bundle = await getCycleBundle(supabase, current.id);
  if (!bundle) return <NoCycle today={today} />;
  const { cycle, items, transactions } = bundle;
  const s = summariseCycle(cycle, items, transactions, today);
  const closed = cycle.closed_at !== null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{cycle.name}</h1>
          <p className="text-sm text-muted">
            {formatShortDate(cycle.start_date)} – {formatShortDate(cycle.end_date)} · {s.daysLeft} {s.daysLeft === 1 ? "day" : "days"} left
          </p>
        </div>
        {closed ? <Pill tone="neutral">Closed</Pill> : <Pill tone={healthTone(s.health)}>{s.health}</Pill>}
      </header>

      <section aria-labelledby="left-label">
        <p id="left-label" className="text-sm text-muted">Left in pocket</p>
        <p className="mt-1 text-5xl font-semibold tracking-tight">
          <Money cents={s.left} signed />
        </p>
        <p className="mt-1 text-sm text-muted">
          <Money cents={s.spent} /> spent of <Money cents={s.pocket} />
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-sm text-muted">Safe per day</p>
          <p className="mt-1 text-xl font-semibold"><Money cents={s.safePerDay} /></p>
          <p className="text-xs text-muted">from envelopes</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Bills paid</p>
          <p className="mt-1 text-xl font-semibold money">{s.billsPaidCount}/{s.billsCount}</p>
          <p className="text-xs text-muted"><Money cents={s.billsDue} /> still due</p>
        </div>
      </section>

      {!closed && (
        <section className="card" aria-labelledby="log-title">
          <h2 id="log-title" className="section-title mb-3">Log spending</h2>
          <LogSpendForm cycleId={cycle.id} envelopes={s.envelopes.map((e) => ({ id: e.id, name: e.name }))} />
        </section>
      )}

      <section aria-labelledby="next-title">
        <h2 id="next-title" className="section-title mb-1">Next bills</h2>
        {s.nextBills.length === 0 ? (
          <p className="py-3 text-muted">All bills paid. Nice.</p>
        ) : (
          <ul>
            {s.nextBills.map((b) => (
              <BillRow key={b.id} item={b} today={today} readOnly={closed} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="env-title">
        <h2 id="env-title" className="section-title mb-3">Envelopes</h2>
        <EnvelopeBars envelopes={s.envelopes} />
        {s.unplannedSpent > 0 && (
          <p className="mt-3 text-sm text-muted">
            Plus <Money cents={s.unplannedSpent} /> unplanned
          </p>
        )}
      </section>

      <Link href={`/cycles/${cycle.id}`} className="btn btn-secondary w-full">
        All bills, envelopes and spending
      </Link>
    </div>
  );
}

async function NoCycle({ today }: { today: string }) {
  const { supabase } = await requireUser();
  const [settings, recurring, existing] = await Promise.all([
    getSettings(supabase),
    getRecurring(supabase),
    supabase.from("cycles").select("start_date, end_date"),
  ]);
  const proposal = proposeCycleForToday(today, settings.cycle_start_day, existing.data ?? []);
  const items = proposal ? generateCycleItems(asRecurringItems(recurring), proposal.start_date, proposal.end_date) : [];
  const month = proposal?.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
      <div className="card space-y-4">
        <p>No cycle covers today, {formatDate(today)}.</p>
        {proposal && recurring.length > 0 && (
          <>
            <p className="text-muted">
              {proposal.name}: {formatDate(proposal.start_date)} – {formatDate(proposal.end_date)}. Plans{" "}
              <Money cents={plannedTotal(items)} /> from {items.length} recurring {items.length === 1 ? "item" : "items"}.
            </p>
            <StartCycleButton start={proposal.start_date} label={`Start ${month} cycle`} />
          </>
        )}
        {recurring.length === 0 && (
          <p className="text-muted">
            Add your bills and envelopes on <Link href="/recurring" className="link">Recurring</Link> first, or load your
            starting data in <Link href="/settings" className="link">Settings</Link>.
          </p>
        )}
      </div>
    </div>
  );
}

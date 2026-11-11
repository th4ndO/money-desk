import Link from "next/link";
import { BillRow } from "@/components/BillRow";
import { EnvelopeBars } from "@/components/EnvelopeBars";
import { OwedToYou } from "@/components/OwedToYou";
import { getCycleExtras } from "@/lib/envelope-history";
import { LogSpendForm } from "@/components/LogSpendForm";
import { Money } from "@/components/Money";
import { Pill } from "@/components/Pill";
import { StartCycleButton } from "@/components/StartCycleButton";
import { requireUser } from "@/lib/auth";
import { generateCycleItems, plannedTotal, proposeCycleForToday } from "@/lib/cycles";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LeftoverCard } from "@/components/LeftoverCard";
import { BankCheckCard } from "@/components/BankCheckCard";
import { daysSinceCheck } from "@/lib/bank-check";
import { getBankCheck } from "@/lib/bank-check-data";
import { ensureCurrentCycle } from "@/lib/cycle-start";
import { asRecurringItems, getCycleBundle, getNextOpenCycle, getPreviousCycle, getReadyToAllocate, getRecurring, getSettings, leftoverSource } from "@/lib/data";
import type { CycleRow } from "@/lib/types";
import { formatDate, formatShortDate, todayJHB } from "@/lib/dates";
import { healthTone, summariseCycle } from "@/lib/summary";

export const metadata = { title: "Today" };

export default async function Dashboard() {
  const { supabase } = await requireUser();
  const today = todayJHB();
  // Starts the cycle by itself when its first day comes.
  const [covering, ready] = await Promise.all([ensureCurrentCycle(supabase, today), getReadyToAllocate(supabase)]);

  if (!covering) return <NoCycle today={today} />;

  // Once today's cycle is closed, look ahead to the next one instead of
  // showing a read-only cycle for its last few hours.
  const ahead = covering.closed_at ? await getNextOpenCycle(supabase, covering.end_date) : null;
  const current = ahead ?? covering;

  const [bundle, extras, previous, bank] = await Promise.all([
    getCycleBundle(supabase, current.id),
    getCycleExtras(supabase, current.id),
    getPreviousCycle(supabase, current.start_date),
    getBankCheck(supabase, current, today),
  ]);
  const leftover = previous ? await previousLeftover(supabase, previous, today) : null;
  if (!bundle) return <NoCycle today={today} />;
  const { cycle, items, transactions } = bundle;
  const s = summariseCycle(cycle, items, transactions, today);
  const closed = cycle.closed_at !== null;
  const billItems = items.filter((i) => i.kind !== "envelope");
  const billsPlanned = billItems.reduce((t, i) => t + i.planned_cents, 0);
  // The envelopes used most this cycle, for one-tap logging.
  const uses = new Map<string, number>();
  for (const t of transactions) if (t.cycle_item_id) uses.set(t.cycle_item_id, (uses.get(t.cycle_item_id) ?? 0) + 1);
  const envelopeOptions = s.envelopes.map((e) => ({ id: e.id, name: e.name }));
  const quick = [...envelopeOptions]
    .sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{cycle.name}</h1>
          <p className="text-sm text-muted">
            {formatShortDate(cycle.start_date)} – {formatShortDate(cycle.end_date)} ·{" "}
            {ahead ? `starts ${formatShortDate(cycle.start_date)}` : `${s.daysLeft} ${s.daysLeft === 1 ? "day" : "days"} left`}
          </p>
        </div>
        {closed ? <Pill tone="neutral">Closed</Pill> : <Pill tone={healthTone(s.health)}>{s.health}</Pill>}
      </header>

      {ahead && (
        <p className="notice text-sm">
          {covering.name} is closed, so this is {cycle.name}, which starts {formatShortDate(cycle.start_date)}. Spending
          you log now is dated {formatShortDate(cycle.start_date)}.
        </p>
      )}

      <section aria-labelledby="left-label">
        <p id="left-label" className="text-sm text-muted">Left in pocket</p>
        <p className="mt-1 text-5xl font-semibold tracking-tight">
          <Money cents={s.left} signed />
        </p>
        <p className="mt-1 text-sm text-muted">
          <Money cents={s.spent} /> spent of <Money cents={s.pocket} />
        </p>
      </section>

      {!closed && (
        <section id="log" className="card scroll-mt-4" aria-labelledby="log-title">
          <h2 id="log-title" className="section-title mb-3">Log spending</h2>
          <LogSpendForm cycleId={cycle.id} envelopes={envelopeOptions} quick={quick} loans={extras.loanOptions} focusOnHash="log" />
        </section>
      )}

      {!closed && s.planned > s.pocket && (
        <Link href={`/allocate?cycle=${cycle.id}`} className="notice block text-sm">
          <Money cents={s.planned - s.pocket} /> of this cycle&apos;s plan isn&apos;t funded yet.{" "}
          <span className="link">Fund it from income</span>
        </Link>
      )}

      {ready !== 0 && (
        <Link href={`/allocate?cycle=${cycle.id}`} className={`card flex items-center justify-between gap-3 ${ready < 0 ? "border-bad" : "border-accent"}`}>
          <span>
            <span className="block text-sm text-muted">{ready > 0 ? "Ready to allocate" : "Allocated more than recorded income"}</span>
            <Money cents={ready} signed className="text-xl font-semibold" />
          </span>
          <span className="btn btn-primary btn-sm">{ready > 0 ? "Allocate" : "Review"}</span>
        </Link>
      )}

      {leftover && (
        <LeftoverCard cycleId={leftover.id} name={leftover.name} left={leftover.left} carried={leftover.carried} />
      )}

      {!closed && (
        <BankCheckCard
          check={bank.check}
          balance={bank.balance}
          balanceOn={bank.balanceOn}
          today={today}
          daysSince={daysSinceCheck(bank.balanceOn, today)}
        />
      )}

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

      <OwedToYou loans={extras.loans} />

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
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="env-title" className="section-title">Envelopes</h2>
          <span className="text-sm text-muted">Tap one to log or see history</span>
        </div>
        <EnvelopeBars envelopes={s.envelopes} cycleId={cycle.id} readOnly={closed} histories={extras.histories} loans={extras.loanOptions} />
        {s.unplannedSpent > 0 && (
          <p className="mt-3 text-sm text-muted">
            Plus <Money cents={s.unplannedSpent} /> unplanned
          </p>
        )}
      </section>

      <section aria-labelledby="plan-title">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 id="plan-title" className="section-title">Bills and savings</h2>
          <span className="text-sm text-muted">
            <Money cents={billsPlanned} /> allocated
          </span>
        </div>
        <ul>
          {billItems.map((b) => (
            <BillRow key={b.id} item={b} today={today} readOnly={closed} />
          ))}
        </ul>
      </section>

      <section className="card text-sm" aria-label="Plan totals">
        <dl className="grid grid-cols-2 gap-1">
          <dt className="text-muted">Bills and savings</dt>
          <dd className="text-right"><Money cents={billsPlanned} /></dd>
          <dt className="text-muted">Envelopes</dt>
          <dd className="text-right"><Money cents={s.envelopes.reduce((t, e) => t + e.planned, 0)} /></dd>
          <dt className="font-semibold">Total allocated</dt>
          <dd className="text-right font-semibold"><Money cents={s.planned} /></dd>
          <dt className="text-muted">Pocket</dt>
          <dd className="text-right"><Money cents={s.pocket} /></dd>
        </dl>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link href={`/cycles/${cycle.id}`} className="btn btn-secondary">Edit amounts</Link>
        <Link href="/history" className="btn btn-secondary">History</Link>
      </div>
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

/** What was left in the previous cycle's pocket, and whether it was carried over. */
async function previousLeftover(supabase: SupabaseClient, previous: CycleRow, today: string) {
  const [bundle, carried] = await Promise.all([
    getCycleBundle(supabase, previous.id),
    supabase.from("income").select("id", { count: "exact", head: true }).eq("source", leftoverSource(previous.name)),
  ]);
  if (!bundle) return null;
  const left = summariseCycle(bundle.cycle, bundle.items, bundle.transactions, today).left;
  return {
    id: previous.id,
    name: previous.name,
    left,
    // A cycle's leftover can only be moved once the cycle is over.
    carried: (carried.count ?? 0) > 0 || today <= previous.end_date,
  };
}

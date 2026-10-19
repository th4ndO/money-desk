import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { cycleStartFor } from "@/lib/cycles";
import { asRecurringItems, getCycleBundle, getCycleCovering, getCycles, getItemsAndTransactions, getRecurring, getSettings } from "@/lib/data";
import { addDays, formatDate, formatShortDate, monthName, parseISODate, todayJHB } from "@/lib/dates";
import { computeRunway } from "@/lib/runway";
import { summariseCycle } from "@/lib/summary";
import type { IncomeRow } from "@/lib/types";
import { BalanceForm, DeleteIncome, IncomeForm } from "./forms";

export const metadata = { title: "Income" };

export default async function IncomePage() {
  const { supabase } = await requireUser();
  const today = todayJHB();
  const [settings, recurring, cycles, current, incomeRes, reservesRes] = await Promise.all([
    getSettings(supabase),
    getRecurring(supabase),
    getCycles(supabase),
    getCycleCovering(supabase, today),
    supabase.from("income").select("id, amount_cents, date, source, notes").order("date", { ascending: false }).limit(200),
    supabase.from("reserves").select("balance_cents, spendable"),
  ]);
  const income = (incomeRes.data ?? []) as IncomeRow[];
  const spendableReserves = (reservesRes.data ?? []).filter((r) => r.spendable).reduce((s, r) => s + r.balance_cents, 0);

  // What the current cycle still needs: unpaid bills plus unspent envelope money.
  let currentCommitted = 0;
  if (current && !current.closed_at) {
    const bundle = await getCycleBundle(supabase, current.id);
    if (bundle) {
      const s = summariseCycle(bundle.cycle, bundle.items, bundle.transactions, today);
      currentCommitted = s.billsDue + s.envelopes.reduce((sum, e) => sum + Math.max(0, e.remaining), 0);
    }
  }
  const nextStart = current ? addDays(current.end_date, 1) : cycleStartFor(today, settings.cycle_start_day);
  const future = cycles.filter((c) => c.start_date >= nextStart && !c.closed_at);
  const { items: futureItems } = await getItemsAndTransactions(supabase, future.map((c) => c.id));
  const futureCycles = future
    .map((c) => ({
      name: c.name,
      start_date: c.start_date,
      end_date: c.end_date,
      planned: futureItems.filter((i) => i.cycle_id === c.id).reduce((s, i) => s + i.planned_cents, 0),
      source: "existing" as const,
    }))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const runway =
    settings.bank_balance_cents === null
      ? null
      : computeRunway({
          bankBalance: settings.bank_balance_cents,
          spendableReserves,
          currentCommitted,
          futureCycles,
          recurring: asRecurringItems(recurring),
          startDay: settings.cycle_start_day,
          nextStart,
        });

  // Income grouped by calendar month.
  const months = new Map<string, IncomeRow[]>();
  for (const row of income) {
    const key = row.date.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), row]);
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Income" subtitle="What came in, and how long it lasts." />

      <section className="card space-y-4" aria-labelledby="runway-title">
        <h2 id="runway-title" className="section-title">Runway</h2>
        {runway ? (
          <>
            <div>
              <p className="text-4xl font-semibold tracking-tight money">
                {runway.cyclesCovered} <span className="text-lg font-normal text-muted">cycles</span>
              </p>
              <p className="mt-1">
                {runway.runsOutOn
                  ? <>Money runs out around <strong>{formatDate(runway.runsOutOn)}</strong> at the current plan.</>
                  : "Covers more than two years at the current plan."}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted">Bank balance</dt><dd className="text-right"><Money cents={settings.bank_balance_cents ?? 0} /></dd>
              <dt className="text-muted">+ Spendable reserves</dt><dd className="text-right"><Money cents={spendableReserves} /></dd>
              <dt className="text-muted">− Still needed this cycle</dt><dd className="text-right"><Money cents={currentCommitted} /></dd>
              <dt className="font-semibold">Available for future cycles</dt><dd className="text-right font-semibold"><Money cents={runway.available} signed /></dd>
              <dt className="text-muted">Average cycle cost</dt><dd className="text-right"><Money cents={runway.averageCycleCost} /></dd>
            </dl>
            <details>
              <summary className="text-sm text-muted hover:text-text">Cycle by cycle</summary>
              <ul className="mt-2">
                {runway.schedule.slice(0, 8).map((c) => (
                  <li key={c.start_date} className="row text-sm">
                    <span className="flex-1">
                      {c.name} <span className="text-muted">({formatShortDate(c.start_date)}){c.source === "existing" ? " · created" : ""}</span>
                    </span>
                    <Money cents={c.planned} />
                    <span className={`w-16 text-right ${c.covered === "full" ? "text-good" : c.covered === "part" ? "text-warn" : "text-bad"}`}>
                      {c.covered === "full" ? "covered" : c.covered === "part" ? "part" : "short"}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
            <p className="text-xs text-muted">
              Assumes your bank balance includes this cycle&apos;s pocket. Future cycles are worked out from Recurring, so
              changes like the gym ending or rent starting are counted. Mark reserves as spendable on the Reserves page.
            </p>
          </>
        ) : (
          <p className="text-muted">Enter your bank balance below to see how many cycles you can cover.</p>
        )}
        <BalanceForm balance={settings.bank_balance_cents} on={settings.bank_balance_on} today={today} />
        {settings.bank_balance_on && (
          <p className="text-xs text-muted">Balance last updated {formatDate(settings.bank_balance_on)}.</p>
        )}
      </section>

      <section className="card" aria-labelledby="log-income-title">
        <h2 id="log-income-title" className="section-title mb-3">Record income</h2>
        <IncomeForm today={today} />
      </section>

      <section aria-labelledby="history-title">
        <h2 id="history-title" className="section-title mb-2">History</h2>
        {income.length === 0 && <p className="text-muted">No income recorded yet.</p>}
        {[...months.entries()].map(([key, rows]) => {
          const { y, m } = parseISODate(`${key}-01`);
          return (
            <div key={key} className="mb-4">
              <div className="flex items-baseline justify-between border-b border-border pb-1">
                <h3 className="font-medium">{monthName(m)} {y}</h3>
                <Money cents={rows.reduce((s, r) => s + r.amount_cents, 0)} className="text-sm" />
              </div>
              <ul>
                {rows.map((r) => (
                  <li key={r.id} className="row block">
                    <details>
                      <summary className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{r.source}</p>
                          <p className="text-sm text-muted">{formatShortDate(r.date)}{r.notes ? ` · ${r.notes}` : ""}</p>
                        </div>
                        <Money cents={r.amount_cents} />
                      </summary>
                      <div className="mt-3 space-y-2">
                        <IncomeForm income={r} today={today} />
                        <DeleteIncome id={r.id} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { BillRow } from "@/components/BillRow";
import { EnvelopeBars } from "@/components/EnvelopeBars";
import { LogSpendForm } from "@/components/LogSpendForm";
import { Money } from "@/components/Money";
import { Pill } from "@/components/Pill";
import { ReviewTable } from "@/components/ReviewTable";
import { requireUser } from "@/lib/auth";
import { getCycleBundle } from "@/lib/data";
import { formatDate, formatShortDate, todayJHB } from "@/lib/dates";
import { reviewCycle } from "@/lib/review";
import { cycleStatus, healthTone, summariseCycle } from "@/lib/summary";
import { AddOneOffForm, CycleLifecycle, ItemEditor, PocketEditor, TransactionEditor } from "./editors";

const STATUS_LABEL = { planned: "Planned", active: "Current", ended: "Ended", closed: "Closed" } as const;

export default async function CycleDetail({ params }: PageProps<"/cycles/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireUser();
  const bundle = await getCycleBundle(supabase, id);
  if (!bundle) notFound();

  const { cycle, items, transactions } = bundle;
  const today = todayJHB();
  const status = cycleStatus(cycle, today);
  const closed = status === "closed";
  const s = summariseCycle(cycle, items, transactions, today);
  const bills = items.filter((i) => i.kind !== "envelope");
  const envelopeItems = items.filter((i) => i.kind === "envelope");
  const envelopeOptions = envelopeItems.map((e) => ({ id: e.id, name: e.name }));
  const envelopeName = new Map(envelopeItems.map((e) => [e.id, e.name]));
  const defaultDate = today < cycle.start_date ? cycle.start_date : today > cycle.end_date ? cycle.end_date : today;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/cycles" className="text-sm text-muted hover:text-text">← All cycles</Link>
        <header className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{cycle.name}</h1>
            <p className="text-muted">{formatDate(cycle.start_date)} – {formatDate(cycle.end_date)}</p>
          </div>
          <div className="flex gap-2">
            <Pill tone={status === "active" ? "accent" : "neutral"}>{STATUS_LABEL[status]}</Pill>
            {!closed && <Pill tone={healthTone(s.health)}>{s.health}</Pill>}
          </div>
        </header>
        <p className="notice mt-4 text-sm">
          {closed
            ? "This cycle is closed and read-only. Reopen it at the bottom of the page to change anything."
            : <>Changes here affect <strong>{cycle.name}</strong> only. To change future cycles, edit <Link href="/recurring" className="link">Recurring</Link>.</>}
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Pocket", s.pocket],
          ["Planned", s.planned],
          ["Spent", s.spent],
          ["Left", s.left],
        ].map(([label, value]) => (
          <div key={label} className="card">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-lg font-semibold"><Money cents={value as number} signed={label === "Left"} /></p>
          </div>
        ))}
      </section>

      {!closed && <PocketEditor cycleId={cycle.id} pocket={cycle.pocket_cents} notes={cycle.notes} />}
      {closed && cycle.notes && <p className="text-muted">Notes: {cycle.notes}</p>}

      <section aria-labelledby="bills-title">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 id="bills-title" className="section-title">Bills and savings</h2>
          <span className="text-sm text-muted">{s.billsPaidCount}/{s.billsCount} paid · <Money cents={s.billsDue} /> due</span>
        </div>
        {bills.length === 0 ? (
          <p className="py-3 text-muted">No bills in this cycle.</p>
        ) : (
          <ul>
            {bills.map((b) => (
              <div key={b.id}>
                <BillRow item={b} today={today} readOnly={closed} />
                {!closed && (
                  <details className="-mt-1 pl-10">
                    <summary className="pb-2 text-sm text-muted hover:text-text">Edit {b.name}</summary>
                    <ItemEditor item={b} minDate={cycle.start_date} maxDate={cycle.end_date} />
                  </details>
                )}
              </div>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="env-title">
        <h2 id="env-title" className="section-title mb-3">Envelopes</h2>
        <EnvelopeBars envelopes={s.envelopes} />
        {!closed && envelopeItems.length > 0 && (
          <details className="mt-3">
            <summary className="text-sm text-muted hover:text-text">Edit envelope amounts</summary>
            <div className="mt-3 space-y-4">
              {envelopeItems.map((e) => (
                <div key={e.id} className="card">
                  <ItemEditor item={e} minDate={cycle.start_date} maxDate={cycle.end_date} />
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="spend-title" className="space-y-4">
        <h2 id="spend-title" className="section-title">Spending</h2>
        {!closed && (
          <div className="card">
            <LogSpendForm
              cycleId={cycle.id}
              envelopes={envelopeOptions}
              showDate
              minDate={cycle.start_date}
              maxDate={cycle.end_date}
              defaultDate={defaultDate}
              idPrefix="detail-log"
            />
          </div>
        )}
        {transactions.length === 0 ? (
          <p className="text-muted">Nothing logged yet.</p>
        ) : (
          <ul>
            {transactions.map((t) => (
              <li key={t.id} className="row block">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.note || (t.cycle_item_id ? envelopeName.get(t.cycle_item_id) : "Unplanned")}</p>
                    <p className="text-sm text-muted">
                      {formatShortDate(t.date)} · {t.cycle_item_id ? envelopeName.get(t.cycle_item_id) : "Unplanned"}
                    </p>
                  </div>
                  <Money cents={t.amount_cents} />
                </div>
                {!closed && (
                  <details className="mt-1">
                    <summary className="text-sm text-muted hover:text-text">Edit</summary>
                    <div className="mt-2">
                      <TransactionEditor tx={t} envelopes={envelopeOptions} minDate={cycle.start_date} maxDate={cycle.end_date} />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!closed && (
        <section aria-labelledby="oneoff-title">
          <details className="card">
            <summary id="oneoff-title" className="font-medium">Add a one-off item to this cycle</summary>
            <div className="mt-4">
              <AddOneOffForm cycleId={cycle.id} minDate={cycle.start_date} maxDate={cycle.end_date} />
            </div>
          </details>
        </section>
      )}

      {(status === "ended" || status === "closed") && (
        <section aria-labelledby="review-title">
          <h2 id="review-title" className="section-title mb-1">Review: planned vs actual</h2>
          <ReviewTable review={reviewCycle(cycle.pocket_cents, items, transactions)} />
        </section>
      )}

      <section aria-label="Close or delete">
        <CycleLifecycle cycleId={cycle.id} closed={closed} name={cycle.name} />
      </section>
    </div>
  );
}

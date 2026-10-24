import Link from "next/link";
import type { HistoryEntry } from "@/lib/history";
import type { EnvelopeSummary } from "@/lib/summary";
import type { OpenLoanOption } from "./EntryKind";
import { HistoryList } from "./HistoryList";
import { Money } from "./Money";
import { SpendFromForm } from "./SpendFromForm";

/**
 * One card per envelope: allocated, spent, lent, left. Tap to log an entry,
 * add money, or see everything that went in and out of it.
 */
export function EnvelopeBars({
  envelopes,
  cycleId,
  readOnly = false,
  histories,
  loans = [],
}: {
  envelopes: EnvelopeSummary[];
  cycleId?: string;
  readOnly?: boolean;
  histories?: Map<string, HistoryEntry[]>;
  loans?: OpenLoanOption[];
}) {
  if (envelopes.length === 0) return <p className="text-muted">No envelopes in this cycle.</p>;
  return (
    <ul className="space-y-3">
      {envelopes.map((e) => {
        const out = e.spent + e.lent - e.repaidFromEarlier;
        const used = e.planned > 0 ? Math.min(100, Math.max(0, Math.round((out / e.planned) * 100))) : out > 0 ? 100 : 0;
        const over = e.remaining < 0;
        const history = histories?.get(e.id) ?? [];
        const added = history.filter((h) => h.type === "allocation").reduce((t, h) => t + h.amount, 0);
        const summary = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{e.name}</span>
              <Money cents={e.remaining} signed className="text-lg font-semibold" />
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-3 text-sm text-muted">
              <span>
                {added > 0 ? (
                  <>
                    <Money cents={e.planned - added} /> planned + <Money cents={added} /> added
                  </>
                ) : (
                  <>
                    <Money cents={e.planned} /> allocated
                  </>
                )}{" "}
                · <Money cents={e.spent} /> spent
                {e.lent > 0 && <> · <span className="text-warn"><Money cents={e.lent} /> lent</span></>}
                {e.repaidFromEarlier > 0 && <> · <span className="text-good">+<Money cents={e.repaidFromEarlier} /> paid back</span></>}
              </span>
              <span>{over ? "over" : "left"}</span>
            </div>
            <div
              className={`bar mt-2 ${over ? "bar-over" : ""}`}
              role="meter"
              aria-label={`${e.name}: ${used}% used`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={used}
            >
              <span style={{ width: `${used}%` }} />
            </div>
          </>
        );
        return (
          <li key={e.id} className="card p-0">
            {!cycleId ? (
              <div className="p-4">{summary}</div>
            ) : (
              <details className="group">
                <summary className="block p-4" aria-label={`${e.name}: log, add money or see history`}>
                  {summary}
                </summary>
                <div className="space-y-4 border-t border-border p-4">
                  {!readOnly && <SpendFromForm cycleId={cycleId} itemId={e.id} name={e.name} loans={loans} />}
                  {!readOnly && (
                    <Link href={`/allocate?cycle=${cycleId}#${e.id}`} className="btn btn-secondary btn-sm w-full">
                      Add money to {e.name}
                    </Link>
                  )}
                  {histories && (
                    <div>
                      <p className="section-title">{e.name} history</p>
                      <HistoryList entries={history} empty="Nothing in or out yet." />
                    </div>
                  )}
                </div>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}

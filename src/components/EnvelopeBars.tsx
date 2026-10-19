import Link from "next/link";
import type { EnvelopeSummary } from "@/lib/summary";
import { Money } from "./Money";
import { SpendFromForm } from "./SpendFromForm";

/**
 * One card per envelope: allocated, spent, left. Tap to spend from it or to
 * add money to it.
 */
export function EnvelopeBars({
  envelopes,
  cycleId,
  readOnly = false,
}: {
  envelopes: EnvelopeSummary[];
  cycleId?: string;
  readOnly?: boolean;
}) {
  if (envelopes.length === 0) return <p className="text-muted">No envelopes in this cycle.</p>;
  return (
    <ul className="space-y-3">
      {envelopes.map((e) => {
        const used = e.planned > 0 ? Math.min(100, Math.round((e.spent / e.planned) * 100)) : e.spent > 0 ? 100 : 0;
        const over = e.remaining < 0;
        const summary = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{e.name}</span>
              <Money cents={e.remaining} signed className="text-lg font-semibold" />
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-3 text-sm text-muted">
              <span>
                <Money cents={e.planned} /> allocated · <Money cents={e.spent} /> spent
              </span>
              <span>{over ? "over" : "left"}</span>
            </div>
            <div
              className={`bar mt-2 ${over ? "bar-over" : ""}`}
              role="meter"
              aria-label={`${e.name}: ${used}% spent`}
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
            {readOnly || !cycleId ? (
              <div className="p-4">{summary}</div>
            ) : (
              <details className="group">
                <summary className="block p-4" aria-label={`${e.name}: spend or add money`}>
                  {summary}
                </summary>
                <div className="space-y-3 border-t border-border p-4">
                  <SpendFromForm cycleId={cycleId} itemId={e.id} name={e.name} />
                  <Link href={`/allocate?cycle=${cycleId}#${e.id}`} className="btn btn-secondary btn-sm w-full">
                    Add money to {e.name}
                  </Link>
                </div>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}

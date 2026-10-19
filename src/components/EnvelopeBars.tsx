import type { EnvelopeSummary } from "@/lib/summary";
import { Money } from "./Money";

export function EnvelopeBars({ envelopes }: { envelopes: EnvelopeSummary[] }) {
  if (envelopes.length === 0) return <p className="text-muted">No envelopes in this cycle.</p>;
  return (
    <ul className="space-y-4">
      {envelopes.map((e) => {
        const used = e.planned > 0 ? Math.min(100, Math.round((e.spent / e.planned) * 100)) : e.spent > 0 ? 100 : 0;
        const over = e.remaining < 0;
        return (
          <li key={e.id}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{e.name}</span>
              <span className="text-sm">
                <Money cents={e.remaining} signed className="font-semibold" />
                <span className="text-muted"> left of <Money cents={e.planned} /></span>
              </span>
            </div>
            <div
              className={`bar mt-1.5 ${over ? "bar-over" : ""}`}
              role="meter"
              aria-label={`${e.name} spent`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={used}
            >
              <span style={{ width: `${used}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import { markRepaid } from "@/app/(app)/cycles/actions";
import { formatShortDate } from "@/lib/dates";
import type { Loan } from "@/lib/loans";
import { ActionForm } from "./ActionForm";
import { Money } from "./Money";
import { SubmitButton } from "./SubmitButton";

/** Open loans, each with one tap for "paid back in full" and a part-payment option. */
export function OwedToYou({ loans }: { loans: Loan[] }) {
  if (loans.length === 0) return null;
  const total = loans.reduce((t, l) => t + l.outstanding, 0);
  return (
    <section className="card space-y-1" aria-labelledby="owed-title">
      <div className="flex items-baseline justify-between">
        <h2 id="owed-title" className="section-title">Owed to you</h2>
        <Money cents={total} className="font-semibold" />
      </div>
      <ul>
        {loans.map((l) => (
          <li key={l.id} className="row block">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.counterparty}</p>
                <p className="text-sm text-muted">
                  Lent {formatShortDate(l.date)}
                  {l.repaid > 0 && <> · <Money cents={l.repaid} /> paid back so far</>}
                </p>
              </div>
              <Money cents={l.outstanding} />
              <ActionForm action={markRepaid}>
                <input type="hidden" name="loan_id" value={l.id} />
                <SubmitButton className="btn btn-secondary btn-sm" pending="…">Paid back</SubmitButton>
              </ActionForm>
            </div>
            <details className="mt-1">
              <summary className="text-sm text-muted hover:text-text">Paid back only part</summary>
              <ActionForm action={markRepaid} className="mt-2 flex items-end gap-2">
                <input type="hidden" name="loan_id" value={l.id} />
                <div className="flex-1 space-y-1.5">
                  <label htmlFor={`part-${l.id}`} className="label">Amount paid back (R)</label>
                  <input id={`part-${l.id}`} name="amount" inputMode="decimal" required className="input money" />
                </div>
                <SubmitButton className="btn btn-primary" pending="…">Save</SubmitButton>
              </ActionForm>
            </details>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">Money paid back goes into the same envelope in the cycle you&apos;re in now. It isn&apos;t income.</p>
    </section>
  );
}

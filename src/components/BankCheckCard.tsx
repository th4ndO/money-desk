import { saveBankBalance, settleBankGap } from "@/app/(app)/bank/actions";
import { type BankCheck, FREE_MONEY } from "@/lib/bank-check";
import { formatDate } from "@/lib/dates";
import { ActionForm } from "./ActionForm";
import { Money } from "./Money";
import { SubmitButton } from "./SubmitButton";

/**
 * Compares the real bank balance with what Money Desk can account for, so
 * money with no job (or spending that was never logged) shows up.
 */
export function BankCheckCard({
  check,
  balance,
  balanceOn,
  today,
  daysSince,
}: {
  check: BankCheck | null;
  balance: number | null;
  balanceOn: string | null;
  today: string;
  daysSince: number | null;
}) {
  const fresh = check !== null && balanceOn === today;
  const overdue = daysSince === null || daysSince > 7;

  return (
    <section className={`card space-y-3 ${!fresh && overdue ? "border-accent" : ""}`} aria-labelledby="bank-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="bank-title" className="section-title">Check against bank</h2>
        {!fresh && (
          <span className={`text-xs ${overdue ? "text-warn" : "text-muted"}`}>
            {daysSince === null ? "Never checked" : `Last checked ${daysSince === 1 ? "yesterday" : `${daysSince} days ago`}`}
          </span>
        )}
      </div>

      {fresh && check && <Result check={check} balance={balance ?? 0} />}

      {!fresh && (
        <p className="text-sm text-muted">
          Type in what your banking app shows right now. Money Desk will tell you if there&apos;s money it doesn&apos;t know
          about, or spending you didn&apos;t log.
        </p>
      )}

      <ActionForm action={saveBankBalance} resetOnSuccess className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="bank-balance" className="label">{fresh ? "Update balance (R)" : "In my bank now (R)"}</label>
          <input id="bank-balance" name="balance" inputMode="decimal" autoComplete="off" required placeholder="5 400" className="input money" />
        </div>
        <SubmitButton className={`btn ${fresh ? "btn-secondary" : "btn-primary"}`} pending="Checking…">Check</SubmitButton>
      </ActionForm>
      {!fresh && balanceOn && balance !== null && (
        <p className="text-xs text-muted">Last balance: <Money cents={balance} /> on {formatDate(balanceOn)}</p>
      )}
    </section>
  );
}

function Result({ check, balance }: { check: BankCheck; balance: number }) {
  const { gap } = check;
  return (
    <div className="space-y-3">
      {gap === 0 ? (
        <p className="font-medium text-good">Matches your bank. Every rand has a job.</p>
      ) : gap > 0 ? (
        <div className="space-y-1">
          <p>
            <Money cents={gap} className="text-xl font-semibold" />{" "}
            <span>in your bank that Money Desk doesn&apos;t know about.</span>
          </p>
          <p className="text-sm text-muted">
            Give it a job: put it in a {FREE_MONEY} envelope to spend and track, or add it to Ready to allocate and split
            it across envelopes yourself.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <p>
            <Money cents={-gap} className="text-xl font-semibold text-bad" /> <span>less than Money Desk expects.</span>
          </p>
          <p className="text-sm text-muted">
            Usually that&apos;s spending that wasn&apos;t logged. Log it below against the right envelope and check again,
            or record it all as unplanned spending.
          </p>
        </div>
      )}

      {gap > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <ActionForm action={settleBankGap}>
            <input type="hidden" name="mode" value="free" />
            <SubmitButton className="btn btn-primary w-full" pending="Saving…">Put in {FREE_MONEY}</SubmitButton>
          </ActionForm>
          <ActionForm action={settleBankGap}>
            <input type="hidden" name="mode" value="ready" />
            <SubmitButton className="btn btn-secondary w-full" pending="Saving…">Ready to allocate</SubmitButton>
          </ActionForm>
        </div>
      )}
      {gap < 0 && (
        <ActionForm action={settleBankGap}>
          <input type="hidden" name="mode" value="spent" />
          <SubmitButton className="btn btn-secondary w-full" pending="Saving…">Log as unplanned spending</SubmitButton>
        </ActionForm>
      )}

      <details>
        <summary className="text-sm text-muted hover:text-text">How this is worked out</summary>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-1 text-sm">
          <dt className="font-semibold">In your bank</dt>
          <dd className="text-right font-semibold"><Money cents={balance} /></dd>
          {check.lines.map((l) => (
            <div key={l.label} className="contents">
              <dt className="text-muted">− {l.label}</dt>
              <dd className="text-right"><Money cents={l.cents} signed /></dd>
            </div>
          ))}
          <dt className="font-semibold">{gap >= 0 ? "Unknown to Money Desk" : "Missing"}</dt>
          <dd className="text-right font-semibold"><Money cents={gap} signed /></dd>
        </dl>
        <p className="mt-2 text-xs text-muted">
          Reserves count as being in this account. If your savings sit in a separate account, the difference will show up
          here.
        </p>
      </details>
    </div>
  );
}

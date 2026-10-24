"use client";

import Link from "next/link";
import { deleteTransaction } from "@/app/(app)/cycles/actions";
import { undoAllocation } from "@/app/(app)/allocate/actions";
import { deleteIncome } from "@/app/(app)/income/actions";
import { formatShortDate } from "@/lib/dates";
import { type HistoryEntry, signedAmount } from "@/lib/history";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";

const UNDO = {
  allocation: { action: undoAllocation, label: "Undo", confirm: "Undo this allocation? The money goes back to Ready to allocate." },
  transaction: { action: deleteTransaction, label: "Delete", confirm: "Delete this entry?" },
  income: { action: deleteIncome, label: "Delete", confirm: "Delete this income? Anything allocated from it stays allocated." },
} as const;

const TONE: Record<HistoryEntry["type"], string> = {
  income: "text-good",
  refund: "text-good",
  allocation: "text-accent",
  spend: "",
  lend: "text-warn",
  bill: "",
};

/** A list of money movements, each with Undo/Delete where that makes sense. */
export function HistoryList({ entries, empty = "Nothing yet." }: { entries: HistoryEntry[]; empty?: string }) {
  if (entries.length === 0) return <p className="text-muted">{empty}</p>;
  return (
    <ul>
      {entries.map((e, i) => {
        const header = i === 0 || entries[i - 1].date !== e.date ? formatShortDate(e.date) : null;
        const undo = e.undo ? UNDO[e.undo] : null;
        return (
          <li key={e.key}>
            {header && <p className="section-title mt-4 mb-1">{header}</p>}
            <div className="row">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{e.title}</p>
                <p className="truncate text-sm text-muted">
                  {e.detail}
                  {e.cycleId && e.type !== "income" && (
                    <>
                      {" · "}
                      <Link href={`/cycles/${e.cycleId}`} className="underline underline-offset-2">open</Link>
                    </>
                  )}
                </p>
              </div>
              <span className={`money whitespace-nowrap ${TONE[e.type]}`}>{signedAmount(e)}</span>
              {undo && (
                <ActionForm action={undo.action} confirm={undo.confirm}>
                  <input type="hidden" name="id" value={e.id} />
                  <SubmitButton className="btn btn-quiet btn-sm" aria-label={`${undo.label}: ${e.title}`}>{undo.label}</SubmitButton>
                </ActionForm>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

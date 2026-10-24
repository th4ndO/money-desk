"use client";

import { useState } from "react";
import { logSpending } from "@/app/(app)/cycles/actions";
import type { EntryKind } from "@/lib/types";
import { ActionForm } from "./ActionForm";
import { EntryKindPicker, KindFields, type OpenLoanOption } from "./EntryKind";
import { SubmitButton } from "./SubmitButton";

const BUTTON: Record<EntryKind, (n: string) => string> = {
  spend: (n) => `Take from ${n}`,
  lend: (n) => `Lend from ${n}`,
  refund: (n) => `Put back into ${n}`,
};

/** Log a spend, a loan or money back straight from one envelope. */
export function SpendFromForm({
  cycleId,
  itemId,
  name,
  loans = [],
}: {
  cycleId: string;
  itemId: string;
  name: string;
  loans?: OpenLoanOption[];
}) {
  const [kind, setKind] = useState<EntryKind>("spend");
  const p = `spend-${itemId}`;
  return (
    <ActionForm action={logSpending} resetOnSuccess onSuccess={() => setKind("spend")} className="grid grid-cols-[1fr_1.4fr] gap-3">
      <input type="hidden" name="cycle_id" value={cycleId} />
      <input type="hidden" name="cycle_item_id" value={itemId} />
      <EntryKindPicker name="kind" value={kind} onChange={setKind} />
      <div className="space-y-1.5">
        <label htmlFor={`${p}-amount`} className="label">{kind === "spend" ? "Spent (R)" : kind === "lend" ? "Lent (R)" : "Got back (R)"}</label>
        <input id={`${p}-amount`} name="amount" inputMode="decimal" autoComplete="off" required className="input money" placeholder="150" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${p}-note`} className="label">{kind === "spend" ? "On what" : "Note"} <span className="font-normal text-muted">(optional)</span></label>
        <input id={`${p}-note`} name="note" maxLength={200} autoComplete="off" className="input" />
      </div>
      <KindFields kind={kind} idPrefix={p} loans={loans} />
      <SubmitButton className="btn btn-primary col-span-2" pending="Saving…">{BUTTON[kind](name)}</SubmitButton>
    </ActionForm>
  );
}

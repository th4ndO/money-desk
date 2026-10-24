"use client";

import { useState } from "react";
import { logSpending } from "@/app/(app)/cycles/actions";
import type { EntryKind } from "@/lib/types";
import { ActionForm } from "./ActionForm";
import { EntryKindPicker, KIND_BUTTON, KindFields, type OpenLoanOption } from "./EntryKind";
import { SubmitButton } from "./SubmitButton";

/** Amount, envelope, note, one tap to save. Also logs loans and money back. */
export function LogSpendForm({
  cycleId,
  envelopes,
  loans = [],
  showDate,
  minDate,
  maxDate,
  defaultDate,
  idPrefix = "log",
}: {
  cycleId: string;
  envelopes: { id: string; name: string }[];
  loans?: OpenLoanOption[];
  showDate?: boolean;
  minDate?: string;
  maxDate?: string;
  defaultDate?: string;
  idPrefix?: string;
}) {
  const [kind, setKind] = useState<EntryKind>("spend");
  return (
    <ActionForm action={logSpending} resetOnSuccess onSuccess={() => setKind("spend")} className="grid grid-cols-2 gap-3">
      <input type="hidden" name="cycle_id" value={cycleId} />
      <EntryKindPicker name="kind" value={kind} onChange={setKind} />
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-amount`} className="label">Amount (R)</label>
        <input id={`${idPrefix}-amount`} name="amount" inputMode="decimal" autoComplete="off" required placeholder="150" className="input money" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-envelope`} className="label">{kind === "refund" ? "Back into" : "From"}</label>
        <select id={`${idPrefix}-envelope`} name="cycle_item_id" className="input select" defaultValue={envelopes[0]?.id ?? ""}>
          {envelopes.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
          <option value="">Unplanned</option>
        </select>
      </div>
      <KindFields kind={kind} idPrefix={idPrefix} loans={loans} />
      <div className={`space-y-1.5 ${showDate ? "" : "col-span-2"}`}>
        <label htmlFor={`${idPrefix}-note`} className="label">Note <span className="font-normal text-muted">(optional)</span></label>
        <input id={`${idPrefix}-note`} name="note" maxLength={200} autoComplete="off" className="input" placeholder={kind === "spend" ? "Checkers" : ""} />
      </div>
      {showDate && (
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}-date`} className="label">Date</label>
          <input id={`${idPrefix}-date`} name="date" type="date" min={minDate} max={maxDate} defaultValue={defaultDate} className="input" />
        </div>
      )}
      <SubmitButton className="btn btn-primary col-span-2" pending="Saving…">{KIND_BUTTON[kind]}</SubmitButton>
    </ActionForm>
  );
}

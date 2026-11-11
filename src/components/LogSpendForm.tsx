"use client";

import { useEffect, useRef, useState } from "react";
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
  quick = [],
  focusOnHash,
}: {
  cycleId: string;
  envelopes: { id: string; name: string }[];
  loans?: OpenLoanOption[];
  showDate?: boolean;
  minDate?: string;
  maxDate?: string;
  defaultDate?: string;
  idPrefix?: string;
  /** Envelopes offered as one-tap buttons above the form (most used first). */
  quick?: { id: string; name: string }[];
  /** Focus the amount when the page is opened at this #hash (the home-screen shortcut). */
  focusOnHash?: string;
}) {
  const [kind, setKind] = useState<EntryKind>("spend");
  const [envelope, setEnvelope] = useState(quick[0]?.id ?? envelopes[0]?.id ?? "");
  const amountRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusOnHash && window.location.hash === `#${focusOnHash}`) {
      amountRef.current?.focus();
      amountRef.current?.scrollIntoView({ block: "center" });
    }
  }, [focusOnHash]);
  return (
    <ActionForm action={logSpending} resetOnSuccess onSuccess={() => setKind("spend")} className="grid grid-cols-2 gap-3">
      <input type="hidden" name="cycle_id" value={cycleId} />
      <EntryKindPicker name="kind" value={kind} onChange={setKind} />
      {quick.length > 1 && (
        <div className="col-span-2 flex flex-wrap gap-2" role="group" aria-label="Quick envelope">
          {quick.map((e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={envelope === e.id}
              onClick={() => {
                setEnvelope(e.id);
                amountRef.current?.focus();
              }}
              className={`btn btn-sm ${envelope === e.id ? "btn-primary" : "btn-secondary"}`}
            >
              {e.name}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-amount`} className="label">Amount (R)</label>
        <input ref={amountRef} id={`${idPrefix}-amount`} name="amount" inputMode="decimal" autoComplete="off" required placeholder="150" className="input money" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-envelope`} className="label">{kind === "refund" ? "Back into" : "From"}</label>
        <select id={`${idPrefix}-envelope`} name="cycle_item_id" className="input select" value={envelope} onChange={(e) => setEnvelope(e.target.value)}>
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

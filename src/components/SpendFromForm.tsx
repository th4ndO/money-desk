"use client";

import { logSpending } from "@/app/(app)/cycles/actions";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";

/** Log a spend straight from one envelope. */
export function SpendFromForm({ cycleId, itemId, name }: { cycleId: string; itemId: string; name: string }) {
  const p = `spend-${itemId}`;
  return (
    <ActionForm action={logSpending} resetOnSuccess className="grid grid-cols-[1fr_1.4fr] gap-3">
      <input type="hidden" name="cycle_id" value={cycleId} />
      <input type="hidden" name="cycle_item_id" value={itemId} />
      <div className="space-y-1.5">
        <label htmlFor={`${p}-amount`} className="label">Spent (R)</label>
        <input id={`${p}-amount`} name="amount" inputMode="decimal" autoComplete="off" required className="input money" placeholder="150" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${p}-note`} className="label">On what <span className="font-normal text-muted">(optional)</span></label>
        <input id={`${p}-note`} name="note" maxLength={200} autoComplete="off" className="input" />
      </div>
      <SubmitButton className="btn btn-primary col-span-2" pending="Saving…">Take from {name}</SubmitButton>
    </ActionForm>
  );
}

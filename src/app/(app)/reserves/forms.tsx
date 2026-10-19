"use client";

import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { centsToInput } from "@/lib/money";
import type { ReserveRow } from "@/lib/types";
import { deleteReserve, saveReserve } from "./actions";

export function ReserveForm({ reserve }: { reserve?: ReserveRow }) {
  const p = reserve ? `res-${reserve.id}` : "res-new";
  return (
    <ActionForm action={saveReserve} resetOnSuccess={!reserve} className="grid grid-cols-2 gap-3">
      {reserve && <input type="hidden" name="id" value={reserve.id} />}
      <div className="space-y-1.5">
        <label htmlFor={`${p}-name`} className="label">Name</label>
        <input id={`${p}-name`} name="name" defaultValue={reserve?.name} maxLength={100} required className="input" placeholder="Emergency fund" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${p}-balance`} className="label">Balance (R)</label>
        <input id={`${p}-balance`} name="balance" inputMode="decimal" defaultValue={reserve ? centsToInput(reserve.balance_cents) : ""} required className="input money" />
      </div>
      <div className="col-span-2 space-y-1.5">
        <label htmlFor={`${p}-notes`} className="label">Notes <span className="font-normal text-muted">(optional)</span></label>
        <input id={`${p}-notes`} name="notes" defaultValue={reserve?.notes ?? ""} maxLength={1000} className="input" />
      </div>
      <label className="col-span-2 flex items-center gap-2">
        <input type="checkbox" name="spendable" defaultChecked={reserve?.spendable ?? false} className="h-5 w-5" />
        <span>Spendable: count it towards runway</span>
      </label>
      <SubmitButton className="btn btn-primary col-span-2" pending="Saving…">{reserve ? "Save" : "Add pot"}</SubmitButton>
    </ActionForm>
  );
}

export function DeleteReserve({ id, name }: { id: string; name: string }) {
  return (
    <ActionForm action={deleteReserve} confirm={`Delete ${name}?`}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="btn btn-danger btn-sm px-0">Delete</SubmitButton>
    </ActionForm>
  );
}

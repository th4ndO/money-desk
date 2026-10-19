"use client";

import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { centsToInput } from "@/lib/money";
import type { IncomeRow } from "@/lib/types";
import { deleteIncome, logIncome, setBalance, updateIncome } from "./actions";

export function BalanceForm({ balance, on, today }: { balance: number | null; on: string | null; today: string }) {
  return (
    <ActionForm action={setBalance} className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <label htmlFor="balance" className="label">Bank balance now (R)</label>
        <input id="balance" name="balance" inputMode="decimal" defaultValue={balance === null ? "" : centsToInput(balance)} required className="input money" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="balance-on" className="label">As of</label>
        <input id="balance-on" name="on" type="date" defaultValue={on ?? today} max={today} required className="input" />
      </div>
      <SubmitButton className="btn btn-secondary col-span-2" pending="Saving…">Update balance</SubmitButton>
    </ActionForm>
  );
}

export function IncomeForm({ income, today }: { income?: IncomeRow; today: string }) {
  const p = income ? `inc-${income.id}` : "inc-new";
  return (
    <ActionForm action={income ? updateIncome : logIncome} resetOnSuccess={!income} className="grid grid-cols-2 gap-3">
      {income && <input type="hidden" name="id" value={income.id} />}
      <div className="space-y-1.5">
        <label htmlFor={`${p}-amount`} className="label">Amount (R)</label>
        <input id={`${p}-amount`} name="amount" inputMode="decimal" defaultValue={income ? centsToInput(income.amount_cents) : ""} required className="input money" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${p}-date`} className="label">Date</label>
        <input id={`${p}-date`} name="date" type="date" defaultValue={income?.date ?? today} required className="input" />
      </div>
      <div className="col-span-2 space-y-1.5">
        <label htmlFor={`${p}-source`} className="label">Source</label>
        <input id={`${p}-source`} name="source" defaultValue={income?.source} maxLength={200} required placeholder="Client invoice PP-INV-0005" className="input" />
      </div>
      <div className="col-span-2 space-y-1.5">
        <label htmlFor={`${p}-notes`} className="label">Notes <span className="font-normal text-muted">(optional)</span></label>
        <input id={`${p}-notes`} name="notes" defaultValue={income?.notes ?? ""} maxLength={1000} className="input" />
      </div>
      <SubmitButton className="btn btn-primary col-span-2" pending="Saving…">{income ? "Save" : "Record income"}</SubmitButton>
    </ActionForm>
  );
}

export function DeleteIncome({ id }: { id: string }) {
  return (
    <ActionForm action={deleteIncome} confirm="Delete this income entry?">
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="btn btn-danger btn-sm px-0">Delete</SubmitButton>
    </ActionForm>
  );
}

"use client";

import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { centsToInput } from "@/lib/money";
import type { CycleItemRow, TransactionRow } from "@/lib/types";
import {
  addOneOff,
  closeCycle,
  deleteCycle,
  deleteItem,
  deleteTransaction,
  reopenCycle,
  updateCycle,
  updateItem,
  updateTransaction,
} from "../actions";

export function ItemEditor({ item, minDate, maxDate }: { item: CycleItemRow; minDate: string; maxDate: string }) {
  const p = `item-${item.id}`;
  return (
    <div className="space-y-3 pb-3">
      <ActionForm action={updateItem} className="grid grid-cols-2 gap-3">
        <input type="hidden" name="id" value={item.id} />
        <div className="col-span-2 space-y-1.5">
          <label htmlFor={`${p}-name`} className="label">Name</label>
          <input id={`${p}-name`} name="name" defaultValue={item.name} maxLength={100} required className="input" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${p}-planned`} className="label">Planned (R)</label>
          <input id={`${p}-planned`} name="planned" inputMode="decimal" defaultValue={centsToInput(item.planned_cents)} required className="input money" />
        </div>
        {item.paid ? (
          <div className="space-y-1.5">
            <label htmlFor={`${p}-actual`} className="label">Actually paid (R)</label>
            <input id={`${p}-actual`} name="actual" inputMode="decimal" defaultValue={centsToInput(item.actual_cents ?? item.planned_cents)} required className="input money" />
          </div>
        ) : item.kind !== "envelope" ? (
          <div className="space-y-1.5">
            <label htmlFor={`${p}-due`} className="label">Due date</label>
            <input id={`${p}-due`} name="due_date" type="date" min={minDate} max={maxDate} defaultValue={item.due_date ?? ""} className="input" />
          </div>
        ) : (
          <div />
        )}
        <SubmitButton className="btn btn-primary btn-sm col-span-2" pending="Saving…">Save</SubmitButton>
      </ActionForm>
      <ActionForm action={deleteItem} confirm={`Remove ${item.name} from this cycle only?`}>
        <input type="hidden" name="id" value={item.id} />
        <SubmitButton className="btn btn-danger btn-sm px-0">Remove from this cycle</SubmitButton>
      </ActionForm>
    </div>
  );
}

export function TransactionEditor({
  tx,
  envelopes,
  minDate,
  maxDate,
}: {
  tx: TransactionRow;
  envelopes: { id: string; name: string }[];
  minDate: string;
  maxDate: string;
}) {
  const p = `tx-${tx.id}`;
  return (
    <div className="space-y-3 pb-3">
      <ActionForm action={updateTransaction} className="grid grid-cols-2 gap-3">
        <input type="hidden" name="id" value={tx.id} />
        <input type="hidden" name="cycle_id" value={tx.cycle_id} />
        <div className="space-y-1.5">
          <label htmlFor={`${p}-amount`} className="label">Amount (R)</label>
          <input id={`${p}-amount`} name="amount" inputMode="decimal" defaultValue={centsToInput(tx.amount_cents)} required className="input money" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${p}-env`} className="label">Envelope</label>
          <select id={`${p}-env`} name="cycle_item_id" defaultValue={tx.cycle_item_id ?? ""} className="input select">
            {envelopes.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
            <option value="">Unplanned</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${p}-date`} className="label">Date</label>
          <input id={`${p}-date`} name="date" type="date" min={minDate} max={maxDate} defaultValue={tx.date} required className="input" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${p}-note`} className="label">Note</label>
          <input id={`${p}-note`} name="note" defaultValue={tx.note ?? ""} maxLength={200} className="input" />
        </div>
        <SubmitButton className="btn btn-primary btn-sm col-span-2" pending="Saving…">Save</SubmitButton>
      </ActionForm>
      <ActionForm action={deleteTransaction} confirm="Delete this spend?">
        <input type="hidden" name="id" value={tx.id} />
        <SubmitButton className="btn btn-danger btn-sm px-0">Delete</SubmitButton>
      </ActionForm>
    </div>
  );
}

export function PocketEditor({ cycleId, pocket, notes }: { cycleId: string; pocket: number; notes: string | null }) {
  return (
    <ActionForm action={updateCycle} className="grid grid-cols-2 gap-3">
      <input type="hidden" name="id" value={cycleId} />
      <div className="space-y-1.5">
        <label htmlFor="pocket" className="label">Pocket (R)</label>
        <input id="pocket" name="pocket" inputMode="decimal" defaultValue={centsToInput(pocket)} required className="input money" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="cycle-notes" className="label">Notes</label>
        <input id="cycle-notes" name="notes" defaultValue={notes ?? ""} maxLength={2000} className="input" />
      </div>
      <SubmitButton className="btn btn-secondary btn-sm col-span-2" pending="Saving…">Save pocket and notes</SubmitButton>
    </ActionForm>
  );
}

export function AddOneOffForm({ cycleId, minDate, maxDate }: { cycleId: string; minDate: string; maxDate: string }) {
  return (
    <ActionForm action={addOneOff} resetOnSuccess className="grid grid-cols-2 gap-3">
      <input type="hidden" name="cycle_id" value={cycleId} />
      <div className="col-span-2 space-y-1.5">
        <label htmlFor="oneoff-name" className="label">Name</label>
        <input id="oneoff-name" name="name" maxLength={100} required className="input" placeholder="Car service" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="oneoff-kind" className="label">Type</label>
        <select id="oneoff-kind" name="kind" className="input select" defaultValue="bill">
          <option value="bill">Bill</option>
          <option value="envelope">Envelope</option>
          <option value="saving">Saving</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="oneoff-amount" className="label">Amount (R)</label>
        <input id="oneoff-amount" name="amount" inputMode="decimal" required className="input money" />
      </div>
      <div className="col-span-2 space-y-1.5">
        <label htmlFor="oneoff-due" className="label">Due date <span className="font-normal text-muted">(bills and savings)</span></label>
        <input id="oneoff-due" name="due_date" type="date" min={minDate} max={maxDate} className="input" />
      </div>
      <SubmitButton className="btn btn-secondary col-span-2" pending="Adding…">Add to this cycle</SubmitButton>
    </ActionForm>
  );
}

export function CycleLifecycle({ cycleId, closed, name }: { cycleId: string; closed: boolean; name: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      {closed ? (
        <ActionForm action={reopenCycle}>
          <input type="hidden" name="id" value={cycleId} />
          <SubmitButton className="btn btn-secondary">Reopen cycle</SubmitButton>
        </ActionForm>
      ) : (
        <>
          <ActionForm action={closeCycle} confirm={`Close ${name}? It becomes read-only until you reopen it.`}>
            <input type="hidden" name="id" value={cycleId} />
            <SubmitButton className="btn btn-primary">Close cycle</SubmitButton>
          </ActionForm>
          <ActionForm action={deleteCycle} confirm={`Delete ${name} and everything logged in it? This can't be undone.`}>
            <input type="hidden" name="id" value={cycleId} />
            <SubmitButton className="btn btn-danger">Delete cycle</SubmitButton>
          </ActionForm>
        </>
      )}
    </div>
  );
}

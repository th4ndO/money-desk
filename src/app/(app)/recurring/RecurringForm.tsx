"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { centsToInput } from "@/lib/money";
import type { RecurringItemRow } from "@/lib/types";
import { deleteRecurring, moveRecurring, saveRecurring, setRecurringActive } from "./actions";

export function RecurringForm({ item, today }: { item?: RecurringItemRow; today: string }) {
  const [kind, setKind] = useState(item?.kind ?? "bill");
  const [frequency, setFrequency] = useState(item?.frequency ?? "monthly");
  const p = item ? `r-${item.id}` : "r-new";
  const needsDay = frequency !== "once" && kind !== "envelope";

  return (
    <ActionForm action={saveRecurring} resetOnSuccess={!item} className="grid grid-cols-2 gap-3">
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="col-span-2 space-y-1.5">
        <label htmlFor={`${p}-name`} className="label">Name</label>
        <input id={`${p}-name`} name="name" defaultValue={item?.name} maxLength={100} required className="input" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${p}-kind`} className="label">Type</label>
        <select id={`${p}-kind`} name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="input select">
          <option value="bill">Bill / debit order</option>
          <option value="envelope">Spending envelope</option>
          <option value="saving">Saving</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${p}-amount`} className="label">Amount (R)</label>
        <input id={`${p}-amount`} name="amount" inputMode="decimal" defaultValue={item ? centsToInput(item.amount_cents) : ""} required className="input money" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${p}-freq`} className="label">How often</label>
        <select id={`${p}-freq`} name="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)} className="input select">
          <option value="monthly">Every month</option>
          <option value="every_n_months">Every few months</option>
          <option value="once">Once</option>
        </select>
      </div>
      {frequency === "every_n_months" ? (
        <div className="space-y-1.5">
          <label htmlFor={`${p}-interval`} className="label">Every how many months</label>
          <input id={`${p}-interval`} name="interval_months" type="number" min={2} max={24} defaultValue={item?.interval_months ?? 3} required className="input" />
        </div>
      ) : (
        <input type="hidden" name="interval_months" value="" />
      )}
      {needsDay ? (
        <div className="space-y-1.5">
          <label htmlFor={`${p}-day`} className="label">Due day (1–31)</label>
          <input id={`${p}-day`} name="due_day" type="number" min={1} max={31} defaultValue={item?.due_day ?? ""} required className="input" />
        </div>
      ) : (
        <input type="hidden" name="due_day" value="" />
      )}
      <div className="space-y-1.5">
        <label htmlFor={`${p}-starts`} className="label">{frequency === "once" ? "Date" : "Starts on"}</label>
        <input id={`${p}-starts`} name="starts_on" type="date" defaultValue={item?.starts_on ?? today} required className="input" />
      </div>
      {frequency !== "once" ? (
        <div className="space-y-1.5">
          <label htmlFor={`${p}-ends`} className="label">Ends on <span className="font-normal text-muted">(optional)</span></label>
          <input id={`${p}-ends`} name="ends_on" type="date" defaultValue={item?.ends_on ?? ""} className="input" />
        </div>
      ) : (
        <input type="hidden" name="ends_on" value="" />
      )}
      <div className="space-y-1.5">
        <label htmlFor={`${p}-cat`} className="label">Category <span className="font-normal text-muted">(optional)</span></label>
        <input id={`${p}-cat`} name="category" defaultValue={item?.category ?? ""} maxLength={50} className="input" />
      </div>
      <div className="col-span-2 space-y-1.5">
        <label htmlFor={`${p}-notes`} className="label">Notes <span className="font-normal text-muted">(optional)</span></label>
        <input id={`${p}-notes`} name="notes" defaultValue={item?.notes ?? ""} maxLength={1000} className="input" />
      </div>
      <label className="col-span-2 flex items-center gap-2">
        <input type="checkbox" name="active" defaultChecked={item?.active ?? true} className="h-5 w-5" />
        <span>Active: include in new cycles</span>
      </label>
      {frequency === "every_n_months" && (
        <p className="col-span-2 text-sm text-muted">Repeats from the month of the start date.</p>
      )}
      <SubmitButton className="btn btn-primary col-span-2" pending="Saving…">{item ? "Save changes" : "Add item"}</SubmitButton>
    </ActionForm>
  );
}

export function RecurringControls({ item }: { item: RecurringItemRow }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionForm action={moveRecurring}>
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="direction" value="up" />
        <SubmitButton className="btn btn-secondary btn-sm" aria-label={`Move ${item.name} up`}>↑</SubmitButton>
      </ActionForm>
      <ActionForm action={moveRecurring}>
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="direction" value="down" />
        <SubmitButton className="btn btn-secondary btn-sm" aria-label={`Move ${item.name} down`}>↓</SubmitButton>
      </ActionForm>
      <ActionForm action={setRecurringActive}>
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="active" value={String(!item.active)} />
        <SubmitButton className="btn btn-secondary btn-sm">{item.active ? "Switch off" : "Switch on"}</SubmitButton>
      </ActionForm>
      <ActionForm action={deleteRecurring} confirm={`Delete ${item.name}? Existing cycles keep their copy. Switching it off is usually better.`}>
        <input type="hidden" name="id" value={item.id} />
        <SubmitButton className="btn btn-danger btn-sm">Delete</SubmitButton>
      </ActionForm>
    </div>
  );
}

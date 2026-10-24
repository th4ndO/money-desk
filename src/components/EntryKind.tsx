"use client";

import type { EntryKind } from "@/lib/types";

export interface OpenLoanOption {
  id: string;
  label: string; // "Thabo · R300 owed"
}

const KINDS: { value: EntryKind; label: string }[] = [
  { value: "spend", label: "Spent" },
  { value: "lend", label: "Lent" },
  { value: "refund", label: "Got back" },
];

/** Spent / Lent / Got back, as a row of radio buttons. */
export function EntryKindPicker({ name, value, onChange }: { name: string; value: EntryKind; onChange: (k: EntryKind) => void }) {
  return (
    <fieldset className="col-span-2">
      <legend className="sr-only">What happened</legend>
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-bg p-1">
        {KINDS.map((k) => (
          <label
            key={k.value}
            className={`flex min-h-10 cursor-pointer items-center justify-center rounded-md text-sm font-medium ${
              value === k.value ? "bg-surface text-text shadow-sm" : "text-muted"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={k.value}
              checked={value === k.value}
              onChange={() => onChange(k.value)}
              className="sr-only"
            />
            {k.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The extra fields Lent and Got back need. */
export function KindFields({ kind, idPrefix, loans }: { kind: EntryKind; idPrefix: string; loans: OpenLoanOption[] }) {
  if (kind === "lend") {
    return (
      <div className="col-span-2 space-y-1.5">
        <label htmlFor={`${idPrefix}-who`} className="label">Lent to</label>
        <input id={`${idPrefix}-who`} name="counterparty" maxLength={100} required autoComplete="off" className="input" placeholder="Name" />
      </div>
    );
  }
  if (kind === "refund") {
    return (
      <>
        {loans.length > 0 && (
          <div className="col-span-2 space-y-1.5">
            <label htmlFor={`${idPrefix}-loan`} className="label">Pays back a loan?</label>
            <select id={`${idPrefix}-loan`} name="repays_id" defaultValue="" className="input select">
              <option value="">No: a refund or other money back</option>
              {loans.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
        )}
        <div className="col-span-2 space-y-1.5">
          <label htmlFor={`${idPrefix}-who`} className="label">From <span className="font-normal text-muted">(optional)</span></label>
          <input id={`${idPrefix}-who`} name="counterparty" maxLength={100} autoComplete="off" className="input" placeholder="Who or which shop" />
        </div>
      </>
    );
  }
  return null;
}

export const KIND_BUTTON: Record<EntryKind, string> = { spend: "Log spending", lend: "Log loan", refund: "Log money back" };

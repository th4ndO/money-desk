"use client";

import { useState, useTransition } from "react";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { useToast } from "@/components/Toast";
import { type Backup, backupCounts, parseBackup } from "@/lib/backup";
import { changePin, importBackup, loadStartingData, saveStartDay } from "./actions";

export function StartDayForm({ day }: { day: number }) {
  return (
    <ActionForm action={saveStartDay} className="flex items-end gap-3">
      <div className="space-y-1.5">
        <label htmlFor="start-day" className="label">Cycle start day (1–28)</label>
        <input id="start-day" name="cycle_start_day" type="number" min={1} max={28} defaultValue={day} required className="input w-28" />
      </div>
      <SubmitButton className="btn btn-secondary" pending="Saving…">Save</SubmitButton>
    </ActionForm>
  );
}

export function LoadStartingData() {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button
      type="button"
      className="btn btn-primary"
      disabled={pending}
      onClick={() => start(async () => toast(await loadStartingData()))}
    >
      {pending ? "Loading…" : "Load my starting data"}
    </button>
  );
}

const LABELS: Record<string, string> = {
  recurring_items: "recurring items",
  cycles: "cycles",
  cycle_items: "cycle items",
  transactions: "spends",
  income: "income entries",
  reserves: "reserves",
  todos: "to-dos",
};

export function ImportForm() {
  const [json, setJson] = useState("");
  const [preview, setPreview] = useState<{ ok: true; backup: Backup } | { ok: false; error: string } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setJson(text);
    setPreview(parseBackup(text));
  }

  return (
    <ActionForm
      action={importBackup}
      className="space-y-3"
      onSuccess={() => {
        setJson("");
        setPreview(null);
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor="backup-file" className="label">Backup file (.json)</label>
        <input id="backup-file" type="file" accept="application/json,.json" onChange={onFile} className="block w-full text-sm" />
      </div>
      <input type="hidden" name="backup" value={json} />
      {preview && !preview.ok && <p className="notice notice-bad" role="alert">{preview.error}</p>}
      {preview?.ok && (
        <>
          <div className="notice text-sm">
            <p>
              Backup from {new Date(preview.backup.exported_at).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })} contains:
            </p>
            <ul className="mt-1 list-inside list-disc">
              {Object.entries(backupCounts(preview.backup)).map(([k, n]) => (
                <li key={k}>{n} {LABELS[k]}</li>
              ))}
            </ul>
            <p className="mt-2 font-semibold text-bad">Importing replaces everything currently in Money Desk.</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm" className="label">Type REPLACE to confirm</label>
            <input id="confirm" name="confirm" autoComplete="off" autoCapitalize="characters" required className="input" />
          </div>
          <SubmitButton className="btn btn-primary" pending="Importing…">Replace my data with this backup</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ChangePinForm() {
  return (
    <ActionForm action={changePin} resetOnSuccess className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <label htmlFor="new-pin" className="label">New PIN</label>
        <input id="new-pin" name="pin" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password" minLength={4} maxLength={8} required className="input money" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="new-pin-again" className="label">Same again</label>
        <input id="new-pin-again" name="pin_again" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password" minLength={4} maxLength={8} required className="input money" />
      </div>
      <SubmitButton className="btn btn-secondary col-span-2" pending="Saving…">Change PIN</SubmitButton>
    </ActionForm>
  );
}

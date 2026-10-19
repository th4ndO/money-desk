"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { formatZAR, parseRandToCents } from "@/lib/money";
import { allocateMoney } from "./actions";

export interface Target {
  key: string; // "item:<id>" or "pot:<id>"
  name: string;
  /** What it has now, e.g. "R1 000 allocated · R750 left". */
  detail: string;
}

export interface TargetGroup {
  title: string;
  targets: Target[];
  /** Start folded away (e.g. bills, which rarely need more money). */
  folded?: boolean;
}

/** Type an amount next to anything; the running total shows what's left. */
export function AllocateForm({ ready, groups, today }: { ready: number; groups: TargetGroup[]; today: string }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const total = Object.values(values).reduce((s, v) => s + (parseRandToCents(v) ?? 0), 0);
  const left = ready - total;
  const invalid = Object.values(values).some((v) => v.trim() !== "" && parseRandToCents(v) === null);

  return (
    <ActionForm action={allocateMoney} onSuccess={() => setValues({})} className="space-y-6">
      {groups.map((g) => {
        if (g.targets.length === 0) return null;
        const list = (
          <ul>
            {g.targets.map((t) => (
              <li key={t.key} id={t.key.split(":")[1]} className="row scroll-mt-24">
                <div className="min-w-0 flex-1">
                  <label htmlFor={t.key} className="block truncate font-medium">{t.name}</label>
                  <p className="text-sm text-muted">{t.detail}</p>
                </div>
                <div className="flex w-32 items-center gap-1">
                  <span aria-hidden="true" className="text-muted">+R</span>
                  <input
                    id={t.key}
                    name={t.key}
                    inputMode="decimal"
                    autoComplete="off"
                    value={values[t.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [t.key]: e.target.value }))}
                    className="input money text-right"
                    placeholder="0"
                  />
                </div>
              </li>
            ))}
          </ul>
        );
        return g.folded ? (
          <details key={g.title}>
            <summary className="section-title">{g.title} ({g.targets.length})</summary>
            <div className="mt-1">{list}</div>
          </details>
        ) : (
          <section key={g.title}>
            <h2 className="section-title mb-1">{g.title}</h2>
            {list}
          </section>
        );
      })}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="alloc-note" className="label">Note <span className="font-normal text-muted">(optional)</span></label>
          <input id="alloc-note" name="note" maxLength={200} className="input" placeholder="From invoice 0005" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="alloc-date" className="label">Date</label>
          <input id="alloc-date" name="date" type="date" defaultValue={today} className="input" />
        </div>
      </div>

      <div className="sticky bottom-20 z-10 md:bottom-4">
        <div className="card flex items-center justify-between gap-3 shadow-lg">
          <p aria-live="polite">
            <span className="text-sm text-muted">Left to allocate</span>
            <br />
            <span className={`money text-lg font-semibold ${left < 0 ? "text-bad" : ""}`}>{formatZAR(left)}</span>
          </p>
          <SubmitButton pending="Saving…" disabled={total <= 0 || left < 0 || invalid}>
            Allocate {total > 0 ? formatZAR(total) : ""}
          </SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}

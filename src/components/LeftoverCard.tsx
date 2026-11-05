"use client";

import { carryOverLeftover } from "@/app/(app)/cycles/actions";
import { ActionForm } from "./ActionForm";
import { Money } from "./Money";
import { SubmitButton } from "./SubmitButton";

/** What was left in the previous cycle's pocket, and a one-time carry-over. */
export function LeftoverCard({
  cycleId,
  name,
  left,
  carried,
}: {
  cycleId: string;
  name: string;
  left: number;
  carried: boolean;
}) {
  const month = name.split(" ")[0];
  return (
    <section className="card space-y-2" aria-labelledby="leftover-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="leftover-title" className="text-sm text-muted">
          {left >= 0 ? `Left over from ${month}` : `${month} went over`}
        </h2>
        <Money cents={Math.abs(left)} className={`text-xl font-semibold ${left < 0 ? "text-bad" : ""}`} />
      </div>
      {left > 0 && !carried && (
        <ActionForm action={carryOverLeftover} className="flex items-center justify-between gap-3">
          <input type="hidden" name="cycle_id" value={cycleId} />
          <p className="text-sm text-muted">Still in your account. Give it a new job?</p>
          <SubmitButton className="btn btn-secondary btn-sm" pending="Moving…">Add to Ready to allocate</SubmitButton>
        </ActionForm>
      )}
      {left > 0 && carried && <p className="text-sm text-muted">Already added to Ready to allocate.</p>}
      {left < 0 && <p className="text-sm text-muted">{month} spent more than its pocket.</p>}
      {left === 0 && <p className="text-sm text-muted">Every rand was used.</p>}
    </section>
  );
}

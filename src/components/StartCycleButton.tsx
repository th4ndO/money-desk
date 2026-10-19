"use client";

import { startCycle } from "@/app/(app)/cycles/actions";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";

export function StartCycleButton({ start, label, goToDetail, className }: { start: string; label: string; goToDetail?: boolean; className?: string }) {
  return (
    <ActionForm action={startCycle} className={className}>
      <input type="hidden" name="start_date" value={start} />
      {goToDetail && <input type="hidden" name="go" value="detail" />}
      <SubmitButton pending="Starting…">{label}</SubmitButton>
    </ActionForm>
  );
}

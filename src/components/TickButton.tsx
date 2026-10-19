"use client";

import { useOptimistic, useTransition } from "react";
import type { ActionResult } from "@/lib/actions";
import { useToast } from "./Toast";

/**
 * Paid / not paid checkbox. Flips immediately and rolls back if the save
 * fails (the optimistic value falls back to the server's `paid`).
 */
export function TickButton({
  itemId,
  paid,
  label,
  action,
  disabled,
  states = ["paid", "not paid"],
}: {
  itemId: string;
  paid: boolean;
  label: string;
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  disabled?: boolean;
  /** Words for the screen-reader label: [checked, unchecked]. */
  states?: [string, string];
}) {
  const [optimistic, setOptimistic] = useOptimistic(paid);
  const [, startTransition] = useTransition();
  const toast = useToast();

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimistic}
      aria-label={`${label}: ${optimistic ? states[0] : states[1]}`}
      disabled={disabled}
      className={`tick ${optimistic ? "tick-on" : ""}`}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          const fd = new FormData();
          fd.set("id", itemId);
          fd.set("paid", String(!optimistic));
          toast(await action(null, fd));
        })
      }
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4">
        {optimistic && <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    </button>
  );
}

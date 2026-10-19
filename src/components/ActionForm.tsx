"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionResult } from "@/lib/actions";
import { useToast } from "./Toast";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/**
 * A form wired to a Server Action: shows the result as a toast, and clears
 * itself after a successful save when `resetOnSuccess` is set.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirm,
  onSuccess,
  ...rest
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  /** Ask before submitting, e.g. for deletes. */
  confirm?: string;
  onSuccess?: () => void;
} & Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit">) {
  const toast = useToast();
  // Show the result as soon as the server answers. Doing it in an effect
  // would miss it when a successful delete removes this very form.
  const [state, formAction] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const result = await action(prev, fd);
    toast(result);
    return result;
  }, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
    // Only react to a new result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
      {...rest}
    >
      {children}
    </form>
  );
}

"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import { type ActionResult, UNREACHABLE } from "@/lib/actions";
import { useToast } from "./Toast";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

const PendingContext = createContext(false);

/** True while the surrounding ActionForm is saving. */
export function useActionPending() {
  return useContext(PendingContext);
}

/**
 * A form wired to a Server Action: shows the result as a toast, and clears
 * itself after a successful save when `resetOnSuccess` is set. A failed save
 * keeps what was typed, so it can be fixed and sent again. (Passing the
 * action to <form action> would make React clear the form after every
 * submit, failed or not, so it is submitted by hand instead.)
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
  const [state, formAction, pending] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    let result: ActionResult;
    try {
      result = await action(prev, fd);
    } catch (e) {
      // A redirect (e.g. back to the PIN screen) must still happen.
      if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
      result = { ok: false, message: UNREACHABLE, at: Date.now() };
    }
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
    <PendingContext.Provider value={pending}>
      <form
        ref={ref}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          if (confirm && !window.confirm(confirm)) return;
          const fd = new FormData(e.currentTarget);
          startTransition(() => formAction(fd));
        }}
        {...rest}
      >
        {children}
      </form>
    </PendingContext.Provider>
  );
}

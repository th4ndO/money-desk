"use client";

import { useFormStatus } from "react-dom";
import { useActionPending } from "./ActionForm";

export function SubmitButton({
  children,
  pending,
  className = "btn btn-primary",
  ...rest
}: { children: React.ReactNode; pending?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const status = useFormStatus();
  const actionPending = useActionPending();
  const busy = status.pending || actionPending;
  return (
    <button type="submit" className={className} disabled={busy || rest.disabled} {...rest}>
      {busy && pending ? pending : children}
    </button>
  );
}

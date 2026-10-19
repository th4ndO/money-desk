"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pending,
  className = "btn btn-primary",
  ...rest
}: { children: React.ReactNode; pending?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const status = useFormStatus();
  return (
    <button type="submit" className={className} disabled={status.pending || rest.disabled} {...rest}>
      {status.pending && pending ? pending : children}
    </button>
  );
}

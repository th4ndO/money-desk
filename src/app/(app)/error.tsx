"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";

/** Shown instead of a crash if a page couldn't load its figures. */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="card space-y-3" role="alert">
      <h1 className="text-lg font-semibold">Couldn&apos;t load this page</h1>
      <p className="text-muted">
        Your saved data is safe. This is usually a brief connection hiccup. Try again, and if it keeps happening, check
        your internet connection.
      </p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      >
        Try again
      </button>
    </div>
  );
}

"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/lib/actions";

type Toast = { id: number; ok: boolean; message: string };
const ToastContext = createContext<(r: ActionResult) => void>(() => {});

/** One polite live region for every "Saved" / "Couldn't save" message. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((r: ActionResult) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), ok: r.ok, message: r.message });
    timer.current = setTimeout(() => setToast(null), r.ok ? 2500 : 6000);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6" aria-live="polite" role="status">
        {toast && (
          <p key={toast.id} className={`toast pointer-events-auto ${toast.ok ? "" : "toast-bad"}`}>
            {toast.message}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

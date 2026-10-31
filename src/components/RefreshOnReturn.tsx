"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Phones freeze a home-screen app in the background and show the frozen
 * page when you come back. Fetch fresh figures whenever the app becomes
 * visible again, so what you see is always what's saved.
 */
export function RefreshOnReturn() {
  const router = useRouter();
  const last = useRef(0);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - last.current < 5000) return;
      last.current = now;
      router.refresh();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) refresh();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", refresh);
    };
  }, [router]);

  return null;
}

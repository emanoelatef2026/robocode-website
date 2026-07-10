/**
 * Reduced-motion helpers — DSA §13 "Reduced Motion". Every Motion-category
 * transition needs a `prefers-reduced-motion`-respecting fallback, defined
 * once per motion tier, not per animation.
 */
"use client";

import { useEffect, useState } from "react";

export function getPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** React hook — re-evaluates if the user changes their OS preference mid-session. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(getPrefersReducedMotion);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return reduced;
}

/**
 * ARIA helpers — DSA §13 "Screen Readers". Every icon-only control carries
 * an accessible label at the Primitive layer; dynamic content (toasts,
 * live counts) uses `aria-live`.
 */
import type { CSSProperties } from "react";

export const ARIA_LIVE_POLITENESS = ["off", "polite", "assertive"] as const;
export type AriaLivePoliteness = (typeof ARIA_LIVE_POLITENESS)[number];

/** Props for a visually-hidden-but-announced live region (toasts, badge counts). */
export function liveRegionProps(politeness: AriaLivePoliteness = "polite") {
  return {
    "aria-live": politeness,
    "aria-atomic": true,
  } as const;
}

/** Visually hides content while keeping it in the accessibility tree — CSS-only, no JS toggle. */
export const visuallyHiddenStyle: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

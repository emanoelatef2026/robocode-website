/**
 * Focus helpers — DSA §7.2 "Focus": always visually distinct from hover,
 * never `outline: none` without a replacement (blueprint §17).
 */
import type { CSSProperties } from "react";
import { PRIMITIVE_COLOR } from "../tokens/primitive/color";

/** The one focus-ring style every focusable Primitive must render — never omitted, never replaced ad hoc. */
export const focusRingStyle: CSSProperties = {
  outline: `2px solid ${PRIMITIVE_COLOR.orange}`,
  outlineOffset: "2px",
};

export const focusRingClassName = "rc-focus-ring";

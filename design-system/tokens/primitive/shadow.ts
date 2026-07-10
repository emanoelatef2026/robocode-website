/**
 * Primitive Tokens — Shadow (Elevation values). Fills the Foundation
 * Elevation schema (`foundation/elevation.ts`). Admin shadows are the flat,
 * navy-tinted values from `DESIGN.md` §4; marketing shadows are colored
 * glows that vary per element and are therefore Component-Token-layer
 * concerns, not primitives — this file only supplies marketing's neutral
 * baseline.
 */
import type { ElevationScale } from "../../foundation/elevation";

export const PRIMITIVE_SHADOW: ElevationScale = {
  admin: {
    none: "none",
    sm: "0 1px 3px rgba(11,31,58,.08)",
    card: "0 1px 4px rgba(11,31,58,.06), 0 0 0 1px rgba(11,31,58,.04)",
    md: "0 4px 16px rgba(11,31,58,.10)",
    lg: "0 18px 50px rgba(11,31,58,.16)",
  },
  marketing: {
    none: "none",
    sm: "0 1px 3px rgba(11,31,58,.08)",
    card: "0 4px 16px rgba(11,31,58,.10)",
    md: "0 8px 24px rgba(11,31,58,.14)",
    lg: "0 20px 60px rgba(11,31,58,.20)",
  },
};

/**
 * Primitive Tokens — Sizing. Fills the Foundation Sizing schema
 * (`foundation/sizing.ts`). `target.touch` is pinned to the 44px minimum
 * (blueprint §16.6) — never lowered by any Theme or Application override.
 */
import type { SizingScale } from "../../foundation/sizing";
import { MIN_TOUCH_TARGET_PX } from "../../foundation/sizing";

export const PRIMITIVE_SIZING: SizingScale = {
  target: {
    dense: "28px",
    comfortable: "36px",
    compact: "40px",
    touch: `${MIN_TOUCH_TARGET_PX}px`,
  },
  icon: {
    xs: "12px",
    sm: "16px",
    md: "20px",
    lg: "24px",
    xl: "32px",
  },
  container: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    full: "100%",
  },
};

/**
 * Primitive Tokens — Motion. Fills the Foundation Motion schema
 * (`foundation/motion.ts`). Durations/easings only — tier gating (DSA
 * §14.3, quiet vs. celebratory) lives at the Semantic layer.
 */
import type { MotionScale } from "../../foundation/motion";

export const PRIMITIVE_MOTION: MotionScale = {
  duration: {
    instant: "0ms",
    fast: "150ms",
    base: "220ms",
    slow: "300ms",
    slower: "600ms",
  },
  easing: {
    linear: "linear",
    standard: "cubic-bezier(0.4, 0, 0.2, 1)",
    decelerate: "cubic-bezier(0.22, 1, 0.36, 1)",
    accelerate: "cubic-bezier(0.4, 0, 1, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
};

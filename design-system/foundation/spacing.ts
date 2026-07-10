/**
 * Foundation — Spacing category.
 *
 * Answers: "how much room separates two elements?" Scale only — values are
 * assigned by `tokens/primitive/spacing.ts`. Independent of every other
 * category so density (§9) can vary without touching typography or color.
 * See DSA §4 "Spacing".
 */
import type { KeyOf, Scale } from "./types";

export const SPACING_SCALE_KEYS = [
  "none", "px", "0.5", "1", "1.5", "2", "2.5", "3", "4",
  "5", "6", "8", "10", "12", "16", "20", "24", "32", "40", "48", "64",
] as const;

export type SpacingScaleKey = KeyOf<typeof SPACING_SCALE_KEYS>;
export type SpacingScale = Scale<SpacingScaleKey>;

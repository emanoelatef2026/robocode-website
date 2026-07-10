/**
 * Foundation — Opacity category.
 *
 * Answers: "how is disabled, scrim, or overlay state visually expressed?"
 * Numeric scale only — a disabled state must always pair opacity with an
 * explicit reason (blueprint §6.1 rule 3); that pairing is a Semantic/
 * Component-layer responsibility, not this category's job. See DSA §4
 * "Opacity".
 */
import type { KeyOf, Scale } from "./types";

export const OPACITY_SCALE_KEYS = [
  "0", "5", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100",
] as const;
export type OpacityScaleKey = KeyOf<typeof OPACITY_SCALE_KEYS>;
export type OpacityScale = Scale<OpacityScaleKey, number>;

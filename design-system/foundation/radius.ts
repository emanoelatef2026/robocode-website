/**
 * Foundation — Radius category.
 *
 * Answers: "how rounded are corners, and does that vary by context?"
 * Already differentiated (10px admin buttons vs. rounded-full marketing
 * CTAs, DESIGN.md §1) — kept as its own axis so the differentiation stays
 * intentional. See DSA §4 "Radius".
 */
import type { KeyOf, Scale } from "./types";

export const RADIUS_SCALE_KEYS = ["none", "sm", "md", "lg", "xl", "full"] as const;
export type RadiusScaleKey = KeyOf<typeof RADIUS_SCALE_KEYS>;
export type RadiusScale = Scale<RadiusScaleKey>;

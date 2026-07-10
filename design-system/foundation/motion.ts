/**
 * Foundation — Motion category.
 *
 * Answers: "what timing/easing families exist for state changes?" Robocode
 * runs three motion philosophies (expressive marketing, quiet admin,
 * celebratory gamification) under one category, governed by the Motion
 * Philosophy (DSA §14). This file defines the duration/easing primitives
 * only — *when* each tier applies is a Semantic-layer decision.
 */
import type { KeyOf, Scale } from "./types";

/** DSA §14.3 — least to most expressive. */
export const MOTION_TIER_KEYS = ["state-change", "component", "page", "celebratory"] as const;
export type MotionTierKey = KeyOf<typeof MOTION_TIER_KEYS>;

export const MOTION_DURATION_KEYS = ["instant", "fast", "base", "slow", "slower"] as const;
export type MotionDurationKey = KeyOf<typeof MOTION_DURATION_KEYS>;

export const MOTION_EASING_KEYS = ["linear", "standard", "decelerate", "accelerate", "spring"] as const;
export type MotionEasingKey = KeyOf<typeof MOTION_EASING_KEYS>;

export interface MotionScale {
  duration: Scale<MotionDurationKey>;
  easing: Scale<MotionEasingKey>;
}

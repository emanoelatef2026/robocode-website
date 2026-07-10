/**
 * Foundation — Elevation category.
 *
 * Answers: "what visually implies 'above' vs. 'flat with the page'?" Kept
 * distinct per-surface (flat navy-tinted shadows for admin, colored glows
 * for marketing, DESIGN.md §4) so the split stays a deliberate, documented
 * choice. See DSA §4 "Elevation".
 */
import type { KeyOf, Scale } from "./types";

export const ELEVATION_SURFACES = ["admin", "marketing"] as const;
export type ElevationSurface = KeyOf<typeof ELEVATION_SURFACES>;

export const ELEVATION_SCALE_KEYS = ["none", "sm", "card", "md", "lg"] as const;
export type ElevationScaleKey = KeyOf<typeof ELEVATION_SCALE_KEYS>;

export type ElevationScale = Record<ElevationSurface, Scale<ElevationScaleKey>>;

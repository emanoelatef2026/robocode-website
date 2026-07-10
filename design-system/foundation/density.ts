/**
 * Foundation — Density category.
 *
 * Answers: "how much information is shown per unit of screen space,
 * independent of viewport?" Distinct from Breakpoints — a Team Leader on a
 * tablet and an Instructor on a phone are both "mobile-tier" by breakpoint
 * but need different density. See DSA §4 "Density" and §9 (four densities:
 * Dense/Comfortable/Compact/Touch).
 */
import type { KeyOf, Scale } from "./types";

export const DENSITY_KEYS = ["dense", "comfortable", "compact", "touch"] as const;
export type DensityKey = KeyOf<typeof DENSITY_KEYS>;

/** Multiplier applied to the Sizing/Spacing primitives when this density is active. */
export type DensityScale = Scale<DensityKey, number>;

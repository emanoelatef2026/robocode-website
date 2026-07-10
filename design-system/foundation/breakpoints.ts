/**
 * Foundation — Breakpoints category.
 *
 * Answers: "at what viewport widths does layout behavior change?" Directly
 * inherited from blueprint §16.1's three-tier persona split. The join point
 * between Layout Architecture (DSA §8) and Information Density (DSA §9).
 * See DSA §4 "Breakpoints".
 */
import type { KeyOf, Scale } from "./types";

export const BREAKPOINT_KEYS = ["mobile", "tablet", "desktop", "wide"] as const;
export type BreakpointKey = KeyOf<typeof BREAKPOINT_KEYS>;
export type BreakpointScale = Scale<BreakpointKey, number>;

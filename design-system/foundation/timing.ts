/**
 * Foundation — Timing category.
 *
 * Answers: "what are the standard durations for state transitions,
 * auto-dismiss, and debounce?" Distinct from Motion (which governs *how*
 * something moves) — Timing governs *how long things wait*: toast
 * auto-dismiss (blueprint §12), inline-validation debounce, autosave
 * interval. See DSA §4 "Timing".
 */
import type { KeyOf, Scale } from "./types";

export const TIMING_KEYS = [
  "toastAutoDismiss", "inlineValidationDebounce", "autosaveInterval", "searchDebounce", "refreshInterval",
] as const;
export type TimingKey = KeyOf<typeof TIMING_KEYS>;

/** Milliseconds. */
export type TimingScale = Scale<TimingKey, number>;

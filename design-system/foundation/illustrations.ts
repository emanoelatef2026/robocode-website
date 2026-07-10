/**
 * Foundation — Illustrations category.
 *
 * Answers: "what imagery fills empty/onboarding/celebratory states?"
 * Illustration tone is a Foundation-level decision because it must vary by
 * *who's looking* (a Student's empty portfolio invites; an Admin's empty
 * finance queue calmly confirms), not by which screen. No image assets are
 * chosen here — this is the tone taxonomy those future assets slot into.
 * See DSA §4 "Illustrations".
 */
import type { KeyOf } from "./types";

export const ILLUSTRATION_TONE_KEYS = ["inviting", "neutral", "celebratory", "cautionary"] as const;
export type IllustrationToneKey = KeyOf<typeof ILLUSTRATION_TONE_KEYS>;

export const ILLUSTRATION_CONTEXT_KEYS = ["empty", "onboarding", "error", "celebratory"] as const;
export type IllustrationContextKey = KeyOf<typeof ILLUSTRATION_CONTEXT_KEYS>;

/** Which tone applies for a given context — filled per-persona at the Application Token layer. */
export type IllustrationToneMap = Record<IllustrationContextKey, IllustrationToneKey>;

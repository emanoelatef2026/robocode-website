/**
 * Foundation — Typography category.
 *
 * Answers: "what text styles exist, and for what role?" Robocode runs two
 * typographic idioms (Orbitron display / Poppins body) plus an Arabic/Cairo
 * companion (DESIGN.md §2) — kept as its own category so a future third
 * idiom never touches admin type. See DSA §4 "Typography".
 */
import type { KeyOf, Scale } from "./types";

/** The role a font family plays — never a specific family name here. */
export const TYPE_FAMILY_ROLES = ["display", "body", "arabic"] as const;
export type TypeFamilyRole = KeyOf<typeof TYPE_FAMILY_ROLES>;

export const TYPE_SIZE_KEYS = [
  "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl",
] as const;
export type TypeSizeKey = KeyOf<typeof TYPE_SIZE_KEYS>;

export const FONT_WEIGHT_KEYS = [
  "light", "regular", "medium", "semibold", "bold", "extrabold",
] as const;
export type FontWeightKey = KeyOf<typeof FONT_WEIGHT_KEYS>;

export const LINE_HEIGHT_KEYS = ["tight", "snug", "normal", "relaxed", "loose"] as const;
export type LineHeightKey = KeyOf<typeof LINE_HEIGHT_KEYS>;

export const LETTER_SPACING_KEYS = ["tighter", "tight", "normal", "wide", "wider", "widest"] as const;
export type LetterSpacingKey = KeyOf<typeof LETTER_SPACING_KEYS>;

export interface TypographyScale {
  family: Scale<TypeFamilyRole>;
  size: Scale<TypeSizeKey>;
  weight: Record<FontWeightKey, number>;
  lineHeight: Record<LineHeightKey, number>;
  letterSpacing: Scale<LetterSpacingKey>;
}

/**
 * Semantic Tokens — Spacing. Purpose-named references to Primitive spacing.
 */
import { PRIMITIVE_SPACING } from "../primitive/spacing";

export const SEMANTIC_SPACING = {
  none: PRIMITIVE_SPACING.none,
  fieldGap: PRIMITIVE_SPACING["3"],
  sectionGap: PRIMITIVE_SPACING["6"],
  pageGutter: PRIMITIVE_SPACING["4"],
  cardPadding: PRIMITIVE_SPACING["4"],
  stackTight: PRIMITIVE_SPACING["1"],
  stackDefault: PRIMITIVE_SPACING["2"],
  stackLoose: PRIMITIVE_SPACING["4"],
} as const;

export type SemanticSpacingTokens = typeof SEMANTIC_SPACING;

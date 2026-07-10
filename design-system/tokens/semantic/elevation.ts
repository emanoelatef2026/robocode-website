/**
 * Semantic Tokens — Elevation. Purpose-named references to Primitive
 * shadow values, split admin (recede) vs. marketing (announce) per
 * DESIGN.md §4.
 */
import { PRIMITIVE_SHADOW } from "../primitive/shadow";

export const SEMANTIC_ELEVATION = {
  cardResting: PRIMITIVE_SHADOW.admin.card,
  cardRaised: PRIMITIVE_SHADOW.admin.md,
  modal: PRIMITIVE_SHADOW.admin.lg,
  marketingCard: PRIMITIVE_SHADOW.marketing.card,
  marketingCta: PRIMITIVE_SHADOW.marketing.md,
} as const;

export type SemanticElevationTokens = typeof SEMANTIC_ELEVATION;

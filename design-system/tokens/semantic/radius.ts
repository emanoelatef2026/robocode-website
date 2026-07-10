/**
 * Semantic Tokens — Radius. Purpose-named references to Primitive radius,
 * split by surface per DESIGN.md §1 (admin flat vs. marketing pill).
 */
import { PRIMITIVE_RADIUS } from "../primitive/radius";

export const SEMANTIC_RADIUS = {
  card: PRIMITIVE_RADIUS.lg,
  input: PRIMITIVE_RADIUS.sm,
  adminButton: PRIMITIVE_RADIUS.sm,
  marketingButton: PRIMITIVE_RADIUS.full,
  chip: PRIMITIVE_RADIUS.full,
  modal: PRIMITIVE_RADIUS.lg,
} as const;

export type SemanticRadiusTokens = typeof SEMANTIC_RADIUS;

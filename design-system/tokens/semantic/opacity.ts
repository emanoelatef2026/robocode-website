/**
 * Semantic Tokens — Opacity. Purpose-named references to Primitive
 * opacity. Per blueprint §6.1 rule 3, `disabled` must always be paired with
 * a stated reason by the consuming Component — this token supplies the
 * visual value only, never the reason text.
 */
import { PRIMITIVE_OPACITY } from "../primitive/opacity";

export const SEMANTIC_OPACITY = {
  disabled: PRIMITIVE_OPACITY["40"],
  scrim: PRIMITIVE_OPACITY["50"],
  overlayBackdrop: PRIMITIVE_OPACITY["60"],
  hoverDim: PRIMITIVE_OPACITY["80"],
  full: PRIMITIVE_OPACITY["100"],
} as const;

export type SemanticOpacityTokens = typeof SEMANTIC_OPACITY;

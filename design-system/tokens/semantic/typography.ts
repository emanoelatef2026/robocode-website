/**
 * Semantic Tokens — Typography. Purpose-named references to Primitive
 * typography, keyed by role (heading/body/label), not by raw scale step.
 */
import { PRIMITIVE_TYPOGRAPHY } from "../primitive/typography";

export interface TypeStyle {
  family: string;
  size: string;
  weight: number;
  lineHeight: number;
  letterSpacing: string;
}

export const SEMANTIC_TYPOGRAPHY = {
  displayLg: {
    family: PRIMITIVE_TYPOGRAPHY.family.display,
    size: PRIMITIVE_TYPOGRAPHY.size["5xl"],
    weight: PRIMITIVE_TYPOGRAPHY.weight.extrabold,
    lineHeight: PRIMITIVE_TYPOGRAPHY.lineHeight.tight,
    letterSpacing: PRIMITIVE_TYPOGRAPHY.letterSpacing.tight,
  },
  headingLg: {
    family: PRIMITIVE_TYPOGRAPHY.family.display,
    size: PRIMITIVE_TYPOGRAPHY.size["3xl"],
    weight: PRIMITIVE_TYPOGRAPHY.weight.bold,
    lineHeight: PRIMITIVE_TYPOGRAPHY.lineHeight.snug,
    letterSpacing: PRIMITIVE_TYPOGRAPHY.letterSpacing.tight,
  },
  headingSm: {
    family: PRIMITIVE_TYPOGRAPHY.family.display,
    size: PRIMITIVE_TYPOGRAPHY.size.lg,
    weight: PRIMITIVE_TYPOGRAPHY.weight.bold,
    lineHeight: PRIMITIVE_TYPOGRAPHY.lineHeight.snug,
    letterSpacing: PRIMITIVE_TYPOGRAPHY.letterSpacing.normal,
  },
  eyebrow: {
    family: PRIMITIVE_TYPOGRAPHY.family.body,
    size: PRIMITIVE_TYPOGRAPHY.size.xs,
    weight: PRIMITIVE_TYPOGRAPHY.weight.bold,
    lineHeight: PRIMITIVE_TYPOGRAPHY.lineHeight.normal,
    letterSpacing: PRIMITIVE_TYPOGRAPHY.letterSpacing.widest,
  },
  body: {
    family: PRIMITIVE_TYPOGRAPHY.family.body,
    size: PRIMITIVE_TYPOGRAPHY.size.base,
    weight: PRIMITIVE_TYPOGRAPHY.weight.regular,
    lineHeight: PRIMITIVE_TYPOGRAPHY.lineHeight.relaxed,
    letterSpacing: PRIMITIVE_TYPOGRAPHY.letterSpacing.normal,
  },
  bodySm: {
    family: PRIMITIVE_TYPOGRAPHY.family.body,
    size: PRIMITIVE_TYPOGRAPHY.size.sm,
    weight: PRIMITIVE_TYPOGRAPHY.weight.regular,
    lineHeight: PRIMITIVE_TYPOGRAPHY.lineHeight.normal,
    letterSpacing: PRIMITIVE_TYPOGRAPHY.letterSpacing.normal,
  },
  label: {
    family: PRIMITIVE_TYPOGRAPHY.family.body,
    size: PRIMITIVE_TYPOGRAPHY.size.sm,
    weight: PRIMITIVE_TYPOGRAPHY.weight.medium,
    lineHeight: PRIMITIVE_TYPOGRAPHY.lineHeight.normal,
    letterSpacing: PRIMITIVE_TYPOGRAPHY.letterSpacing.normal,
  },
} satisfies Record<string, TypeStyle>;

export type SemanticTypographyKey = keyof typeof SEMANTIC_TYPOGRAPHY;

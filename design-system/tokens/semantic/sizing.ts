/**
 * Semantic Tokens — Sizing. Purpose-named references to Primitive sizing,
 * consumed by the Density Application Token layer (DSA §9.2) — a Table's
 * row-height Component Token resolves through this, never a hardcoded px.
 */
import { PRIMITIVE_SIZING } from "../primitive/sizing";
import type { DensityKey } from "../../foundation/density";

export const SEMANTIC_TARGET_SIZE_BY_DENSITY: Record<DensityKey, string> = {
  dense: PRIMITIVE_SIZING.target.dense,
  comfortable: PRIMITIVE_SIZING.target.comfortable,
  compact: PRIMITIVE_SIZING.target.compact,
  touch: PRIMITIVE_SIZING.target.touch,
};

export const SEMANTIC_SIZING = {
  iconInline: PRIMITIVE_SIZING.icon.sm,
  iconButton: PRIMITIVE_SIZING.icon.md,
  avatar: PRIMITIVE_SIZING.icon.xl,
  contentMaxWidth: PRIMITIVE_SIZING.container.lg,
} as const;

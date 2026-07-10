/**
 * Foundation — Z-index category.
 *
 * Answers: "what is the fixed stacking order across every overlay type?" A
 * single canonical scale is the only way to guarantee a drawer never opens
 * beneath a toast, or a command palette beneath a modal, product-wide. See
 * DSA §4 "Z-index".
 */
import type { KeyOf, Scale } from "./types";

export const Z_INDEX_LAYER_KEYS = [
  "base", "dropdown", "sticky", "backdrop", "drawer",
  "modal", "popover", "toast", "commandPalette", "tooltip",
] as const;
export type ZIndexLayerKey = KeyOf<typeof Z_INDEX_LAYER_KEYS>;
export type ZIndexScale = Scale<ZIndexLayerKey, number>;

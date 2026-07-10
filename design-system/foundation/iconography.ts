/**
 * Foundation — Iconography category.
 *
 * Answers: "what visual language represents actions and entities?" One icon
 * set must read as professional-but-approachable everywhere — never split
 * into a "kid" set and an "adult" set (DSA §4 "Iconography"). This category
 * defines size/stroke schema only; no icon library is chosen here — that is
 * a Primitive-component decision for a future sprint.
 */
import type { KeyOf, Scale } from "./types";
import type { IconSizeKey } from "./sizing";

export const ICON_STROKE_KEYS = ["thin", "regular", "bold"] as const;
export type IconStrokeKey = KeyOf<typeof ICON_STROKE_KEYS>;

export interface IconographyScale {
  size: Scale<IconSizeKey>;
  stroke: Scale<IconStrokeKey, number>;
}

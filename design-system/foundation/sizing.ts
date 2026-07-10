/**
 * Foundation — Sizing category.
 *
 * Answers: "what are the standard dimensions for interactive targets and
 * containers?" The single most consequence-bearing category for Robocode's
 * front-line roles — an Instructor's live-classroom tap target has a hard
 * physical minimum (44×44px, blueprint §16.6) an HQ admin's mouse-driven
 * row action does not need. See DSA §4 "Sizing".
 */
import type { KeyOf, Scale } from "./types";

export const TARGET_SIZE_KEYS = ["dense", "comfortable", "compact", "touch"] as const;
export type TargetSizeKey = KeyOf<typeof TARGET_SIZE_KEYS>;

export const ICON_SIZE_KEYS = ["xs", "sm", "md", "lg", "xl"] as const;
export type IconSizeKey = KeyOf<typeof ICON_SIZE_KEYS>;

export const CONTAINER_SIZE_KEYS = ["sm", "md", "lg", "xl", "full"] as const;
export type ContainerSizeKey = KeyOf<typeof CONTAINER_SIZE_KEYS>;

/** Minimum touch target, unconditional per blueprint §16.6 — never overridden. */
export const MIN_TOUCH_TARGET_PX = 44;

export interface SizingScale {
  target: Scale<TargetSizeKey>;
  icon: Scale<IconSizeKey>;
  container: Scale<ContainerSizeKey>;
}

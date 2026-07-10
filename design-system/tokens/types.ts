/**
 * Token Architecture — shared cross-layer types.
 *
 * See `docs/design/design-system-architecture.md` §5 for the five-layer
 * token model (Primitive → Semantic → Component → Application → Theme).
 */

/** The five portals + Studio + Public Site (blueprint §1.3, D-08). */
export const PORTAL_KEYS = [
  "admin", "teamLeader", "instructor", "parent", "student", "studio", "public",
] as const;
export type PortalKey = (typeof PORTAL_KEYS)[number];

export const COLOR_SCHEME_KEYS = ["light", "dark"] as const;
export type ColorSchemeKey = (typeof COLOR_SCHEME_KEYS)[number];

/** `"system"` resolves to the OS/browser preference at runtime. */
export type ColorSchemePreference = ColorSchemeKey | "system";

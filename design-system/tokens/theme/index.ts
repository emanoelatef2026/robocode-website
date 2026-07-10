/**
 * Theme Tokens barrel — DSA §5.6.
 *
 * White Label (a future franchise-partner brand) is the same mechanism as
 * Dark Mode: a new object satisfying `ThemeTokens`, built from the
 * unchanged Foundation/Primitive/Semantic/Component stack (Architecture
 * Closure v1 CLS-H3). No white-label brand values are invented here —
 * that is a future business decision (out of scope, Architecture Closure
 * v1 §10) — `createTheme` demonstrates the extension mechanism only.
 */
import type { ThemeTokens } from "./types";

export * from "./types";
export { lightTheme } from "./light";
export { darkTheme } from "./dark";

import { lightTheme } from "./light";
import { darkTheme } from "./dark";

export const THEMES: Record<string, ThemeTokens> = {
  light: lightTheme,
  dark: darkTheme,
};

/**
 * Build a new Theme from a base Theme plus a partial override — the
 * mechanism a future white-label Theme (or any Theme variant) uses. Never
 * called with invented brand values by this sprint.
 */
export function createTheme(base: ThemeTokens, overrides: Partial<ThemeTokens>): ThemeTokens {
  return { ...base, ...overrides };
}

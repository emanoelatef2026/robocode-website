/**
 * Theme Tokens — type contract. DSA §5.6.
 *
 * A complete, swappable set of Semantic Token assignments. Any future
 * Theme (Dark Mode, or a franchise white-label brand) must satisfy this
 * exact shape — the contract is what makes a Theme swap safe: every
 * Component built against `ThemeTokens` renders correctly under any Theme
 * that type-checks against it.
 */
import type { SemanticColorTokens } from "../semantic/color";
import type { SemanticRadiusTokens } from "../semantic/radius";
import type { SemanticElevationTokens } from "../semantic/elevation";
import type { ColorSchemeKey } from "../types";

export interface ThemeTokens {
  /** Machine-readable id — e.g. `"light"`, `"dark"`, or a future white-label brand key. */
  id: string;
  colorScheme: ColorSchemeKey;
  color: SemanticColorTokens;
  radius: SemanticRadiusTokens;
  elevation: SemanticElevationTokens;
}

/**
 * Light Theme — the one shipped Theme today (DESIGN.md's current palette).
 */
import type { ThemeTokens } from "./types";
import { LIGHT_SEMANTIC_COLOR } from "../semantic/color";
import { SEMANTIC_RADIUS } from "../semantic/radius";
import { SEMANTIC_ELEVATION } from "../semantic/elevation";

export const lightTheme: ThemeTokens = {
  id: "light",
  colorScheme: "light",
  color: LIGHT_SEMANTIC_COLOR,
  radius: SEMANTIC_RADIUS,
  elevation: SEMANTIC_ELEVATION,
};

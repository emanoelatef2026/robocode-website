/**
 * Dark Theme — first pass. Structurally complete against `ThemeTokens`;
 * visual review is deferred to `DESIGN.md`'s domain (Architecture Closure
 * v1 §10). Real usage condition, not a preference toggle: an Instructor in
 * a projector-dimmed classroom, an evening-use Parent/Student (DSA §5.6).
 */
import type { ThemeTokens } from "./types";
import { DARK_SEMANTIC_COLOR } from "../semantic/color";
import { SEMANTIC_RADIUS } from "../semantic/radius";
import { SEMANTIC_ELEVATION } from "../semantic/elevation";

export const darkTheme: ThemeTokens = {
  id: "dark",
  colorScheme: "dark",
  color: DARK_SEMANTIC_COLOR,
  radius: SEMANTIC_RADIUS,
  elevation: SEMANTIC_ELEVATION,
};

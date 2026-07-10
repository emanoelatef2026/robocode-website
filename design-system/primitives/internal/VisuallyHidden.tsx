import type { ReactNode } from "react";
import { visuallyHiddenStyle } from "../../a11y";

/** Renders content for screen readers only, using the frozen `a11y.visuallyHiddenStyle` contract. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span style={visuallyHiddenStyle}>{children}</span>;
}

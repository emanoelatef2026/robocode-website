/**
 * Semantic content divider — `role="separator"` (WAI-ARIA separator
 * pattern), for dividing structural regions a screen reader should be able
 * to announce a boundary for (e.g. between groups of menu-like items).
 * `Divider` is the purely-decorative counterpart; use this one only when
 * the boundary itself is part of the content's meaning.
 */
import type { HTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import styles from "../primitives.module.css";

export interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  /** @default "horizontal" */
  orientation?: "horizontal" | "vertical";
  /** Marks the separator as decorative only, removing it from the accessibility tree. */
  decorative?: boolean;
}

export function Separator({ orientation = "horizontal", decorative = false, className, ...props }: SeparatorProps) {
  return (
    <div
      {...props}
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        orientation === "horizontal" ? styles.separatorHorizontal : styles.separatorVertical,
        className
      )}
    />
  );
}

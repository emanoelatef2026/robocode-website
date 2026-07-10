/**
 * Purely visual dividing line, with an optional centered label (the
 * familiar "or continue with" pattern). Always `aria-hidden` — it carries
 * no structural/semantic meaning of its own. For a semantically meaningful
 * divider between interactive regions, use `Separator` instead.
 */
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";
import styles from "../primitives.module.css";

export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  /** @default "horizontal" */
  orientation?: "horizontal" | "vertical";
  /** Centered text rendered between two line segments. Only supported for `orientation="horizontal"`. */
  label?: ReactNode;
}

export function Divider({ orientation = "horizontal", label, className, ...props }: DividerProps) {
  if (label && orientation === "horizontal") {
    return (
      <div {...props} aria-hidden="true" className={cn(styles.dividerWithLabel, className)}>
        {label}
      </div>
    );
  }

  return (
    <div
      {...props}
      aria-hidden="true"
      className={cn(
        styles.divider,
        orientation === "horizontal" ? styles.dividerHorizontal : styles.dividerVertical,
        className
      )}
    />
  );
}

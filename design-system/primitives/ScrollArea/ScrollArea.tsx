/**
 * Scrollable container with a themed, cross-browser thin scrollbar. A
 * plain overflow region is already keyboard-scrollable once focusable
 * (`tabIndex={0}` + native ArrowUp/Down/PageUp/Down/Home/End) — no custom
 * key handling is added on top of that native behavior.
 */
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import { focusRingClassName } from "../../a11y";
import styles from "../primitives.module.css";

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  /** @default "vertical" */
  axis?: "vertical" | "horizontal" | "both";
  /** Renders a card-style border + radius around the scroll region. */
  bordered?: boolean;
  maxHeight?: number | string;
  /** Accessible name for the scroll region — required so keyboard/AT users know what they're scrolling. */
  "aria-label": string;
}

const AXIS_CLASS: Record<NonNullable<ScrollAreaProps["axis"]>, string | undefined> = {
  vertical: styles.scrollAreaAxisVertical,
  horizontal: styles.scrollAreaAxisHorizontal,
  both: undefined,
};

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { axis = "vertical", bordered = false, maxHeight, className, style, children, ...props },
  ref
) {
  return (
    <div
      {...props}
      ref={ref}
      role="region"
      tabIndex={0}
      className={cn(styles.scrollArea, focusRingClassName, AXIS_CLASS[axis], bordered && styles.scrollAreaBordered, className)}
      style={{ maxHeight, ...style }}
    >
      {children}
    </div>
  );
});

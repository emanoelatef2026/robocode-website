"use client";

/**
 * Hover/focus-triggered text hint. A CSS-positioned overlay (no portal) —
 * appropriate at the Primitive layer since a Tooltip never traps focus or
 * blocks interaction, unlike the Overlay category's Modal/Drawer/Dialog.
 * Shows on hover *and* focus and hides on Escape, so the same information
 * reaches mouse and keyboard users alike (§12 Keyboard/Focus).
 */
import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import styles from "../primitives.module.css";

export const TOOLTIP_PLACEMENTS = ["top", "bottom", "left", "right"] as const;
export type TooltipPlacement = (typeof TOOLTIP_PLACEMENTS)[number];

const PLACEMENT_CLASS: Record<TooltipPlacement, string> = {
  top: styles.tooltipTop,
  bottom: styles.tooltipBottom,
  left: styles.tooltipLeft,
  right: styles.tooltipRight,
};

export interface TooltipProps {
  content: ReactNode;
  /** A single, already-focusable/hoverable element (Button, IconButton, a plain `<span tabIndex={0}>`, …). */
  children: ReactElement;
  /** @default "top" */
  placement?: TooltipPlacement;
  /** Hover/focus open delay, in ms. @default 300 */
  delay?: number;
}

export function Tooltip({ content, children, placement = "top", delay = 300 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tooltipId = useId();

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  function show() {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  }

  function hide() {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === "Escape") hide();
  }

  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, { "aria-describedby": tooltipId })
    : children;

  return (
    <span
      className={styles.tooltipWrapper}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={handleKeyDown}
    >
      {trigger}
      <span
        role="tooltip"
        id={tooltipId}
        className={cn(styles.tooltipContent, PLACEMENT_CLASS[placement], visible && styles.tooltipVisible)}
      >
        {content}
      </span>
    </span>
  );
}

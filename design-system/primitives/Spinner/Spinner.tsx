"use client";

/**
 * Indeterminate loading indicator — reserved for genuinely indeterminate
 * waits only (component-library-specification.md §4.1); a region-level
 * fetch uses Skeleton instead (DSA §12 State Architecture: "Loading is
 * always a Skeleton, never a spinner replacing a whole region").
 */
import type { SVGProps } from "react";
import { cn } from "../../utils/cn";
import { liveRegionProps, visuallyHiddenStyle } from "../../a11y";
import type { PrimitiveSize } from "../internal/types";
import styles from "../primitives.module.css";

export interface SpinnerProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** @default "md" */
  size?: PrimitiveSize;
  /**
   * Announced to screen readers via an `aria-live` region. Pass an empty
   * string to render a purely decorative spinner (e.g. inside a Button
   * that already announces its own busy state via `aria-busy`).
   * @default "Loading"
   */
  label?: string;
}

const SIZE_CLASS: Record<PrimitiveSize, string> = {
  sm: styles.spinnerSm,
  md: styles.spinnerMd,
  lg: styles.spinnerLg,
};

export function Spinner({ size = "md", label = "Loading", className, ...props }: SpinnerProps) {
  const svg = (
    <svg
      {...props}
      className={cn(styles.spinner, SIZE_CLASS[size], className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );

  if (!label) return svg;

  return (
    <span role="status" {...liveRegionProps("polite")} style={{ display: "inline-flex", alignItems: "center" }}>
      {svg}
      <span style={visuallyHiddenStyle}>{label}</span>
    </span>
  );
}

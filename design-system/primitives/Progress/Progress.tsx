/**
 * Determinate (or indeterminate) linear progress bar — `role="progressbar"`
 * with the standard `aria-value*` triad. Distinct from `Spinner`: Progress
 * communicates *how much* of a known-length task is done; Spinner
 * communicates only *that* an indeterminate wait is happening.
 */
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";
import type { PrimitiveSize } from "../internal/types";
import styles from "../primitives.module.css";

const TRACK_SIZE_CLASS: Record<PrimitiveSize, string> = {
  sm: styles.progressTrackSm,
  md: styles.progressTrackMd,
  lg: styles.progressTrackLg,
};

export interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Ignored when `indeterminate` is true. */
  value?: number;
  min?: number;
  max?: number;
  /** @default "md" */
  size?: PrimitiveSize;
  /** Renders an animated, unbounded fill instead of `value` — for a task whose length isn't known yet. */
  indeterminate?: boolean;
  /** Accessible label for the progressbar region (e.g. "Uploading roster.csv"). */
  label?: ReactNode;
  /** Shows the numeric `value/max` alongside `label`. */
  showValue?: boolean;
}

export function Progress({
  value = 0,
  min = 0,
  max = 100,
  size = "md",
  indeterminate = false,
  label,
  showValue = false,
  className,
  ...props
}: ProgressProps) {
  const clamped = Math.min(max, Math.max(min, value));
  const percent = max > min ? ((clamped - min) / (max - min)) * 100 : 0;

  return (
    <div>
      {label || showValue ? (
        <div className={styles.progressLabel}>
          {label ? <span>{label}</span> : <span />}
          {showValue && !indeterminate ? (
            <span>
              {clamped}/{max}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        {...props}
        role="progressbar"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={indeterminate ? undefined : clamped}
        aria-valuetext={indeterminate ? "Loading" : undefined}
        aria-label={typeof label === "string" ? label : undefined}
        className={cn(styles.progressTrack, TRACK_SIZE_CLASS[size], className)}
      >
        <div
          className={cn(styles.progressFill, indeterminate && styles.progressIndeterminate)}
          style={indeterminate ? undefined : { width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

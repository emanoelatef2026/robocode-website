/**
 * Generic label chip — distinct from the ~30-status, business-scoped
 * `StatusBadge` (component-library-specification.md §4.5, §17), which is a
 * Business Component built on top of this Primitive in a later sprint.
 * `Badge` only knows the six Semantic status buckets, never a specific
 * business status string.
 */
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";
import type { PrimitiveSize, PrimitiveTone } from "../internal/types";
import { PRIMITIVE_TONE_KEYS } from "../internal/types";
import styles from "../primitives.module.css";

export { PRIMITIVE_TONE_KEYS as BADGE_TONES };

const TONE_CLASS: Record<PrimitiveTone, string> = {
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger,
  info: styles.badgeInfo,
  neutral: styles.badgeNeutral,
  special: styles.badgeSpecial,
};

const SIZE_CLASS: Record<PrimitiveSize, string> = {
  sm: styles.badgeSm,
  md: styles.badgeMd,
  lg: styles.badgeLg,
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** @default "neutral" */
  tone?: PrimitiveTone;
  /** @default "md" */
  size?: PrimitiveSize;
  /** Renders a small leading status dot alongside the label — never the only signal (non-color-alone, §12.1 AA+). */
  dot?: boolean;
  children: ReactNode;
}

export function Badge({ tone = "neutral", size = "md", dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span {...props} className={cn(styles.badge, TONE_CLASS[tone], SIZE_CLASS[size], className)}>
      {dot ? <span className={styles.badgeDot} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/**
 * Loading placeholder that telegraphs the shape of the eventual content —
 * the only sanctioned Loading treatment for a region (DSA §12 State
 * Architecture: "Loading is always a Skeleton, never a spinner replacing a
 * whole region").
 */
import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import styles from "../primitives.module.css";

export const SKELETON_VARIANTS = ["text", "circle", "rect"] as const;
export type SkeletonVariant = (typeof SKELETON_VARIANTS)[number];

const VARIANT_CLASS: Record<SkeletonVariant, string> = {
  text: styles.skeletonText,
  circle: styles.skeletonCircle,
  rect: styles.skeletonRect,
};

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  /** @default "text" */
  variant?: SkeletonVariant;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
}

export function Skeleton({ variant = "text", width, height, className, style, ...props }: SkeletonProps) {
  return (
    <span
      {...props}
      aria-hidden="true"
      className={cn(styles.skeleton, VARIANT_CLASS[variant], className)}
      style={{ width, height, ...style }}
    />
  );
}

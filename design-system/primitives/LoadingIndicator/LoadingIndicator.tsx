/**
 * A `Spinner` plus an optional message, for a block/region-level waiting
 * state where a full `Skeleton` shape isn't available yet (e.g. an
 * in-flight action whose result will replace, rather than fill, the
 * region). `Spinner` alone stays reserved for icon-level, inline waits
 * (§4.1); this composes it for the slightly larger, message-bearing case.
 */
import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import type { PrimitiveSize } from "../internal/types";
import { Spinner } from "../Spinner/Spinner";
import styles from "../primitives.module.css";

export interface LoadingIndicatorProps {
  /** @default "md" */
  size?: PrimitiveSize;
  /** Message shown next to the spinner and announced via the live region. @default "Loading" */
  label?: ReactNode;
  /** Centers the indicator in a full-width, padded block — for a whole panel/page's loading state. */
  fullPage?: boolean;
  className?: string;
}

export function LoadingIndicator({ size = "md", label = "Loading", fullPage = false, className }: LoadingIndicatorProps) {
  const text = typeof label === "string" ? label : "Loading";

  return (
    <span className={cn(fullPage ? styles.loadingIndicatorFullPage : styles.loadingIndicator, className)}>
      <Spinner size={size} label={text} />
      {typeof label !== "string" ? label : <span aria-hidden="true">{label}</span>}
    </span>
  );
}
